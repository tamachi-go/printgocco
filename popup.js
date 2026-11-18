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

  function parseSocialLink(a, baseUrl) {
    const rawHref = a.getAttribute("href") || "";
    if (!rawHref) return null;

    let url;
    try {
      url = new URL(rawHref, baseUrl || location.origin);
    } catch {
      return null;
    }

    const host = url.hostname.toLowerCase();
    const img = a.querySelector("img");
    let iconUrl = "";
    if (img) {
      const rawSrc = img.getAttribute("src") || "";
      if (rawSrc) {
        try {
          iconUrl = new URL(rawSrc, baseUrl || location.origin).href;
        } catch {
          iconUrl = rawSrc;
        }
      }
    }

    if (
      host === "twitter.com" ||
      host === "www.twitter.com" ||
      host === "x.com" ||
      host === "www.x.com"
    ) {
      const screenName = url.searchParams.get("screen_name");
      if (screenName) {
        return { type: "twitter", username: screenName.trim(), iconUrl };
      }
      const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
      const first = parts[0] || "";
      if (
        first &&
        !["intent", "share", "home", "search", "hashtag", "i"].includes(
          first.toLowerCase()
        )
      ) {
        return { type: "twitter", username: first.trim(), iconUrl };
      }
      return null;
    }

    if (host === "github.com" || host === "www.github.com") {
      const parts = url.pathname.replace(/^\/+|\/+$/g, "").split("/");
      const first = parts[0] || "";
      if (first) {
        return { type: "github", username: first.trim(), iconUrl };
      }
      return null;
    }

    return null;
  }

  function extractSocialsFromElement(root, selector, baseUrl) {
    const socials = [];
    const seen = new Set();
    for (const a of root.querySelectorAll(selector)) {
      const item = parseSocialLink(a, baseUrl);
      if (!item || !item.username) continue;
      const k = `${item.type}:${item.username.toLowerCase()}`;
      if (!seen.has(k)) {
        seen.add(k);
        socials.push(item);
      }
    }
    return socials;
  }

  function mergeSocials(existingSocials, newSocials) {
    const map = new Map();
    for (const s of [...(existingSocials || []), ...(newSocials || [])]) {
      if (!s || !s.username) continue;
      const k = `${s.type}:${s.username.toLowerCase()}`;
      if (!map.has(k)) {
        map.set(k, s);
      }
    }
    return Array.from(map.values());
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
    if (rawHref) {
      try {
        profileUrl = new URL(rawHref, location.origin).href;
      } catch {
        profileUrl = "";
      }
    }
    if (!profileUrl && username) {
      profileUrl = `https://connpass.com/user/${username}/`;
    }

    const role = detectRoleFromHeaderTitle(headerTitle);
    const img = row.querySelector(
      ".avatar img, td.user_info img, .image_link img, .user_image img, img"
    );
    const iconUrl = img?.src || "";
    const socials = extractSocialsFromElement(
      row,
      "td.social a[href], .social a[href], a[href*='twitter.com'], a[href*='x.com'], a[href*='github.com']",
      location.origin
    );

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
      existing.socials = mergeSocials(existing.socials, socials);
    } else {
      participantMap.set(key, {
        name,
        username,
        iconUrl,
        profileUrl,
        role,
        socials,
        highResResolved: false
      });
    }
  }

  function extractProfileDataFromHtml(html, baseUrl) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    let avatarUrl = "";
    const avatarImg = doc.querySelector(".avatar img, img.avatar");
    if (avatarImg) {
      const rawSrc =
        avatarImg.getAttribute("src") || avatarImg.getAttribute("data-src") || "";
      if (rawSrc) {
        try {
          avatarUrl = new URL(rawSrc, baseUrl).href;
        } catch {
          avatarUrl = rawSrc;
        }
      }
    }

    const socials = extractSocialsFromElement(
      doc,
      ".social a[href], .user_info a[href*='twitter.com'], .user_info a[href*='x.com'], .user_info a[href*='github.com']",
      baseUrl
    );

    return { avatarUrl, socials };
  }

  const participants = Array.from(participantMap.values());
  const targets = participants.filter((p) => p.profileUrl || p.username);
  const CONCURRENCY = 6;
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const target = targets[cursor++];
      const urlsToTry = [];
      if (target.username) {
        urlsToTry.push(`${location.origin}/user/${target.username}/`);
      }
      if (target.profileUrl && !urlsToTry.includes(target.profileUrl)) {
        urlsToTry.push(target.profileUrl);
      }
      for (const url of urlsToTry) {
        try {
          const res = await fetch(url);
          if (!res.ok) continue;
          const html = await res.text();
          const { avatarUrl, socials } = extractProfileDataFromHtml(html, url);
          if (avatarUrl) {
            target.iconUrl = avatarUrl;
            target.highResResolved = true;
          }
          if (socials.length > 0) {
            target.socials = mergeSocials(target.socials, socials);
          }
          if (avatarUrl) break;
        } catch {
          // 拡張機能コンテキスト側 (popup.js / print.js) でフォールバック取得
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker())
  );

  return participants;
}

function extractAvatarFromProfileHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const avatarImg = doc.querySelector(".avatar img, img.avatar");
  if (!avatarImg) return "";

  const rawSrc =
    avatarImg.getAttribute("src") || avatarImg.getAttribute("data-src") || "";
  if (!rawSrc) return "";

  try {
    return new URL(rawSrc, baseUrl).href;
  } catch {
    return rawSrc;
  }
}

async function resolveAvatarForParticipant(participant) {
  if (participant.highResResolved) return;

  const urlsToTry = [];
  if (participant.profileUrl) {
    urlsToTry.push(participant.profileUrl);
  }
  if (participant.username) {
    const connpassUserUrl = `https://connpass.com/user/${participant.username}/`;
    if (!urlsToTry.includes(connpassUserUrl)) {
      urlsToTry.push(connpassUserUrl);
    }
  }

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const html = await res.text();
      const avatarUrl = extractAvatarFromProfileHtml(html, url);
      if (avatarUrl) {
        participant.iconUrl = avatarUrl;
        participant.highResResolved = true;
        return;
      }
    } catch {
      // ignore and try next candidate
    }
  }
}

async function enrichAvatarsInParallel(participants) {
  const targets = participants.filter(
    (p) => (p.profileUrl || p.username) && !p.highResResolved
  );
  if (targets.length === 0) return;

  const CONCURRENCY = 6;
  let cursor = 0;

  async function worker() {
    while (cursor < targets.length) {
      const target = targets[cursor++];
      await resolveAvatarForParticipant(target);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker())
  );
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
    statusEl.textContent = `${participants.length} 名のアイコンを取得中...`;
    buttonEl.disabled = false;

    buttonEl.addEventListener("click", () => {
      chrome.tabs.create({ url: chrome.runtime.getURL("print.html") });
    });

    await enrichAvatarsInParallel(participants);
    await chrome.storage.local.set({ participants });
    statusEl.textContent = `${participants.length} 名の参加者を取得しました。`;
  } catch (err) {
    statusEl.textContent = "参加者情報の取得に失敗しました。";
    console.error(err);
  }
}

init();
