const ROLE_PRIORITY = {
  Listener: 1,
  Speaker: 2,
  Organizer: 3
};

function detectRoleFromSection(element) {
  const section = element.closest(".participation_table_area, .participants_table, table");
  const labelEl = section
    ? section.querySelector("thead .label_ptype_name") || section.querySelector("thead th")
    : null;
  const labelText = (labelEl?.textContent || "").trim();

  if (/管理者|運営|主催|スタッフ|organizer|staff|admin/i.test(labelText)) {
    return "Organizer";
  }
  if (/登壇|発表|LT|スピーカー|speaker|talk/i.test(labelText)) {
    return "Speaker";
  }
  if (element.closest(".concerned_area")) {
    return "Organizer";
  }
  return "Listener";
}

function extractParticipantsFromDOM() {
  const participantMap = new Map();

  // 関係者枠および #participants 配下の参加枠から参加者名・アイコン・枠種別を取得
  const selectors = [
    ".concerned_area .participants_table tbody .user .display_name a",
    "#participants .participation_table_area tbody .user .display_name a",
    ".participation_table_area tbody .user .display_name a"
  ];

  const anchors = document.querySelectorAll(selectors.join(", "));
  for (const a of anchors) {
    // キャンセル枠 (.cancel_table_area 等) があれば除外
    if (a.closest(".cancel_table_area, .waitlist_table_area")) continue;

    const name = (a.textContent || "").trim();
    const key = a.getAttribute("href") || name;
    if (!name) continue;

    const role = detectRoleFromSection(a);
    const row = a.closest("tr.user, tr, .user_info") || a.parentElement;
    const img = row
      ? row.querySelector("td.user_info img, .image_link img, .user_image img, img")
      : null;
    const iconUrl = img?.src || "";

    if (participantMap.has(key)) {
      const existing = participantMap.get(key);
      if ((ROLE_PRIORITY[role] || 0) > (ROLE_PRIORITY[existing.role] || 0)) {
        existing.role = role;
      }
      if (!existing.iconUrl && iconUrl) {
        existing.iconUrl = iconUrl;
      }
    } else {
      participantMap.set(key, { name, iconUrl, role });
    }
  }

  return Array.from(participantMap.values());
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
