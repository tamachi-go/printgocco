async function extractParticipantsFromDOM() {
  // 優先順位: Speaker > Organizer > Listener
  const ROLE_PRIORITY = {
    Listener: 1,
    Organizer: 2,
    Speaker: 3
  };

  function extractCleanTitleFromTh(th) {
    const ptype = th.querySelector(".label_ptype_name");
    if (ptype) {
      return (ptype.textContent || "").trim();
    }
    const clone = th.cloneNode(true);
    for (const el of clone.querySelectorAll(".participants_count, small, a")) {
      el.remove();
    }
    return (clone.textContent || "").trim();
  }

  function getHeaderTitleForRow(row) {
    // 1. 同じ tbody 内でこの行より上にある th ヘッダー行を探す
    let prevRow = row.previousElementSibling;
    while (prevRow) {
      const th = prevRow.querySelector("th");
      if (th) return extractCleanTitleFromTh(th);
      prevRow = prevRow.previousElementSibling;
    }

    // 2. この行が属する tbody の直前の thead を探す（1つの table に複数 thead/tbody がある場合に対応）
    const tbody = row.closest("tbody");
    if (tbody) {
      let prevSection = tbody.previousElementSibling;
      while (prevSection) {
        if (prevSection.tagName === "THEAD") {
          const th = prevSection.querySelector("th");
          if (th) return extractCleanTitleFromTh(th);
        }
        const th = prevSection.querySelector?.("th");
        if (th) return extractCleanTitleFromTh(th);
        prevSection = prevSection.previousElementSibling;
      }
    }

    // 3. table 内の thead th
    const table = row.closest("table");
    if (table) {
      const th = table.querySelector("thead th, tr:first-child th");
      if (th) return extractCleanTitleFromTh(th);
    }

    // 4. .participation_table_area 内の .label_ptype_name
    const area = row.closest(".participation_table_area");
    if (area) {
      const ptype = area.querySelector(".label_ptype_name");
      if (ptype) return (ptype.textContent || "").trim();
    }

    return "";
  }

  function detectRoleFromHeaderTitle(headerTitle) {
    const title = headerTitle.trim();
    // Organizerは「管理者」の表にいる人
    if (/^管理者/.test(title)) {
      return "Organizer";
    }
    // Speakerは「発表者」の表にいる人
    if (/^発表者/.test(title)) {
      return "Speaker";
    }
    // その他はそれ以外
    return "Listener";
  }

  function parseHighResAvatarFromProfileHtml(html, username, baseUrl) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const candidates = [];

    for (const img of doc.querySelectorAll("img")) {
      // ヘッダー・フッター内のログイン中ユーザーアイコン等を除外
      if (
        img.closest(
          "header, #header, .header_area, nav, .global_header, footer, #footer"
        )
      ) {
        continue;
      }
      // イベント一覧やグループ一覧内のサムネイルを除外
      if (
        img.closest(
          ".event_list, .group_list, .schedule_area, .concerned_area, .participation_table_area"
        )
      ) {
        continue;
      }

      const rawSrc = img.getAttribute("src") || "";
      if (!rawSrc || !rawSrc.includes("/thumbs/") || rawSrc.includes("connpass_logo")) {
        continue;
      }

      const parentLink = img.closest("a[href]");
      if (parentLink) {
        try {
          const linkUrl = new URL(parentLink.getAttribute("href"), baseUrl);
          // イベントへのリンク画像は除外
          if (linkUrl.pathname.includes("/event/")) continue;
          // グループトップページへのリンク画像は除外
          if (linkUrl.pathname === "/" || linkUrl.pathname === "") continue;
          // 別ユーザーへのリンク画像は除外
          if (
            username &&
            linkUrl.pathname.includes("/user/") &&
            !linkUrl.pathname.toLowerCase().includes(`/user/${username.toLowerCase()}`)
          ) {
            continue;
          }
        } catch {
          // ignore URL parse error
        }
      }

      let resolvedSrc = rawSrc;
      try {
        resolvedSrc = new URL(rawSrc, baseUrl).href;
      } catch {
        resolvedSrc = rawSrc;
      }

      candidates.push(resolvedSrc);
    }

    if (candidates.length > 0) {
      return candidates[0];
    }

    const ogImage =
      doc.querySelector("meta[property='og:image']")?.getAttribute("content") ||
      doc.querySelector("meta[name='twitter:image']")?.getAttribute("content") ||
      "";
    if (ogImage && ogImage.includes("/thumbs/") && !ogImage.includes("connpass_logo")) {
      return ogImage;
    }

    return "";
  }

  const participantMap = new Map();

  // 参加者テーブル内の各ユーザー行を走査
  const rows = document.querySelectorAll(
    ".concerned_area .participants_table tbody tr, #participants .participation_table_area tbody tr, .participation_table_area tbody tr, .participants_table tbody tr"
  );

  for (const row of rows) {
    // 「もっと見る」行やヘッダー行は除外
    if (row.classList.contains("empty") || row.querySelector("th")) continue;
    // キャンセル枠・補欠枠は除外
    if (row.closest(".cancel_table_area, .waitlist_table_area, .cancelled_table_area")) {
      continue;
    }

    const headerTitle = getHeaderTitleForRow(row);
    if (/^(キャンセル|補欠)|cancel|waitlist/i.test(headerTitle)) {
      continue;
    }

    const a = row.querySelector(".display_name a");
    if (!a) continue;

    const name = (a.textContent || "").trim();
    if (!name) continue;

    const rawHref =
      a.getAttribute("href") ||
      row.querySelector("a.image_link")?.getAttribute("href") ||
      "";
    const userMatch = rawHref.match(/\/user\/([^/?#]+)/);
    const username = userMatch ? userMatch[1] : "";
    const key = username ? `user:${username.toLowerCase()}` : `name:${name}`;

    let profileUrl = "";
    if (username) {
      profileUrl = `${location.origin}/user/${username}/`;
    } else if (rawHref) {
      try {
        profileUrl = new URL(rawHref, location.origin).href;
      } catch {
        profileUrl = "";
      }
    }

    const role = detectRoleFromHeaderTitle(headerTitle);
    const img = row.querySelector("td.user_info img, .image_link img, .user_image img, img");
    const iconUrl = img?.src || "";

    if (participantMap.has(key)) {
      const existing = participantMap.get(key);
      // 両方に登録がある場合は Speaker > Organizer > Listener の順で上書きし、重複エントリを作らない
      if ((ROLE_PRIORITY[role] || 0) > (ROLE_PRIORITY[existing.role] || 0)) {
        existing.role = role;
      }
      if (!existing.iconUrl && iconUrl) {
        existing.iconUrl = iconUrl;
      }
      if (!existing.profileUrl && profileUrl) {
        existing.profileUrl = profileUrl;
      }
    } else {
      participantMap.set(key, {
        name,
        username,
        iconUrl,
        profileUrl,
        role,
        highResResolved: false
      });
    }
  }

  const participants = Array.from(participantMap.values());

  // 同一オリジン（現在のconnpassタブ内）からプロフィールページを並列取得して高解像度アイコンに差し替える
  const targets = participants.filter((p) => p.profileUrl);
  const CONCURRENCY = 6;
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const target = targets[cursor++];
      const urlsToTry = [target.profileUrl];
      if (target.username) {
        const mainUrl = `https://connpass.com/user/${target.username}/`;
        if (!urlsToTry.includes(mainUrl)) {
          urlsToTry.push(mainUrl);
        }
      }

      for (const url of urlsToTry) {
        try {
          const res = await fetch(url, { credentials: "same-origin" });
          if (!res.ok) continue;
          const html = await res.text();
          const highRes = parseHighResAvatarFromProfileHtml(
            html,
            target.username,
            url
          );
          if (highRes) {
            target.iconUrl = highRes;
            target.highResResolved = true;
            break;
          }
        } catch {
          // クロスオリジンリダイレクト等で失敗した場合は print.js 側でリトライ
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker())
  );

  return participants;
}

function isSupportedUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (url.hostname === "connpass.com" || url.hostname.endsWith(".connpass.com")) {
      return url.pathname.includes("/event/");
    }
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

async function init() {
  const statusEl = document.getElementById("status");
  const buttonEl = document.getElementById("open-print");

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !isSupportedUrl(tab.url)) {
    statusEl.textContent = "connpassの参加者一覧ページで開いてください。";
    return;
  }

  try {
    statusEl.textContent = "参加者と高解像度アイコンを取得中...";
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractParticipantsFromDOM
    });

    const participants = results?.[0]?.result || [];
    if (participants.length === 0) {
      statusEl.textContent = "参加者が見つかりませんでした。";
      return;
    }

    await chrome.storage.local.set({ participants });
    statusEl.textContent = `${participants.length} 名の参加者を取得しました。`;
    buttonEl.disabled = false;

    buttonEl.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("print.html") });
    });
  } catch (err) {
    statusEl.textContent = "参加者情報の取得に失敗しました。";
    console.error(err);
  }
}

init();
