const CARDS_PER_PAGE = 10; // 2列 × 5段

// #11 左下の「田」シンボル用の10色パレット
const TA_RANDOM_COLORS = [
  "#c8161d", // 朱色（落款レッド）
  "#00b8d4", // Gopherシアン
  "#007d9c", // Gopherティール
  "#fb8c00", // アンバーオレンジ
  "#43a047", // リーフグリーン
  "#8e24aa", // パープル
  "#d81b60", // マゼンタピンク
  "#3949ab", // インディゴブルー
  "#8d4e2a", // 酒瓶ブラウン
  "#fdd835"  // ゴールドイエロー
];

let cachedParticipants = [];
const highResIconCache = new Map();

function pickRandomTaColor() {
  const index = Math.floor(Math.random() * TA_RANDOM_COLORS.length);
  return TA_RANDOM_COLORS[index];
}

function normalizeRole(role, hasName) {
  if (!hasName) return "";
  if (typeof role === "string") {
    const lower = role.toLowerCase();
    if (lower === "organizer") return "Organizer";
    if (lower === "speaker") return "Speaker";
  }
  return "Listener";
}

function normalizeParticipant(entry) {
  if (!entry) {
    return {
      name: "",
      username: "",
      iconUrl: "",
      profileUrl: "",
      role: "",
      socials: []
    };
  }
  if (typeof entry === "string") {
    return {
      name: entry,
      username: "",
      iconUrl: "",
      profileUrl: "",
      role: "Listener",
      socials: []
    };
  }
  const name = typeof entry.name === "string" ? entry.name : "";
  const profileUrl = typeof entry.profileUrl === "string" ? entry.profileUrl : "";
  let username = typeof entry.username === "string" ? entry.username : "";
  if (!username && profileUrl) {
    const m = profileUrl.match(/\/user\/([^/?#]+)/);
    if (m) username = m[1];
  }
  const socials = Array.isArray(entry.socials) ? entry.socials : [];
  return {
    name,
    username,
    iconUrl: typeof entry.iconUrl === "string" ? entry.iconUrl : "",
    profileUrl,
    role: normalizeRole(entry.role, Boolean(name)),
    socials
  };
}

function pickPrimarySocial(socials) {
  if (!Array.isArray(socials) || socials.length === 0) return null;
  const valid = socials.filter((s) => s && typeof s.username === "string" && s.username.trim());
  if (valid.length === 0) return null;
  const xAccount = valid.find((s) => {
    const t = (s.type || "").toLowerCase();
    return t === "twitter" || t === "x";
  });
  return xAccount || valid[0];
}

function createSocialIconElement(social) {
  const ns = "http://www.w3.org/2000/svg";
  const type = (social?.type || "").toLowerCase();

  if (type === "twitter" || type === "x") {
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("card-social-icon");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute(
      "d",
      "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
    );
    svg.appendChild(path);
    return svg;
  }

  if (type === "github") {
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("card-social-icon");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("fill", "currentColor");
    path.setAttribute(
      "d",
      "M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
    );
    svg.appendChild(path);
    return svg;
  }

  if (social?.iconUrl) {
    const img = document.createElement("img");
    img.className = "card-social-icon";
    img.src = social.iconUrl;
    img.alt = "";
    return img;
  }

  return null;
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

async function fetchHighResIconUrl(profileUrl, username) {
  if (!profileUrl && !username) return "";
  const cacheKey = username || profileUrl;
  if (highResIconCache.has(cacheKey)) {
    return highResIconCache.get(cacheKey);
  }

  const urlsToTry = [];
  if (profileUrl) {
    urlsToTry.push(profileUrl);
  }
  if (username) {
    const connpassUserUrl = `https://connpass.com/user/${username}/`;
    if (!urlsToTry.includes(connpassUserUrl)) {
      urlsToTry.push(connpassUserUrl);
    }
  }

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const html = await res.text();
      const highRes = extractAvatarFromProfileHtml(html, url);
      if (highRes) {
        highResIconCache.set(cacheKey, highRes);
        return highRes;
      }
    } catch {
      // try next candidate
    }
  }

  highResIconCache.set(cacheKey, "");
  return "";
}

async function upgradeParticipantIconsToHighRes(participants, imgElementsByKey) {
  const targets = participants.filter(
    (p) =>
      p &&
      typeof p === "object" &&
      (p.profileUrl || p.username) &&
      !p.highResResolved
  );
  if (targets.length === 0) return;

  const CONCURRENCY = 6;
  let cursor = 0;
  let updatedAny = false;

  async function worker() {
    while (cursor < targets.length) {
      const target = targets[cursor++];
      const key = target.username || target.profileUrl;
      const highResUrl = await fetchHighResIconUrl(
        target.profileUrl,
        target.username
      );
      if (highResUrl) {
        target.highResResolved = true;
        if (highResUrl !== target.iconUrl) {
          target.iconUrl = highResUrl;
          updatedAny = true;
          const imgs = imgElementsByKey.get(key) || [];
          for (const imgEl of imgs) {
            imgEl.src = highResUrl;
          }
        }
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, targets.length) }, () => worker())
  );

  if (updatedAny && typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ participants });
  }
}

function getBadgeModifierClass(role) {
  if (role === "Organizer") return "card-badge--organizer";
  if (role === "Speaker") return "card-badge--speaker";
  return "card-badge--listener";
}

function createTaSymbolSvg(variant = "default") {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("ta-symbol");

  if (variant === "multicolor") {
    const cells = [
      { x: 2, y: 2, fill: "#00b8d4" },
      { x: 13, y: 2, fill: "#c8161d" },
      { x: 2, y: 13, fill: "#8d4e2a" },
      { x: 13, y: 13, fill: "#007d9c" }
    ];
    for (const c of cells) {
      const rect = document.createElementNS(ns, "rect");
      rect.setAttribute("x", String(c.x));
      rect.setAttribute("y", String(c.y));
      rect.setAttribute("width", "9");
      rect.setAttribute("height", "9");
      rect.setAttribute("rx", "1.8");
      rect.setAttribute("fill", c.fill);
      svg.appendChild(rect);
    }
    return svg;
  }

  const outer = document.createElementNS(ns, "rect");
  outer.setAttribute("x", "2.5");
  outer.setAttribute("y", "2.5");
  outer.setAttribute("width", "19");
  outer.setAttribute("height", "19");
  outer.setAttribute("rx", "2.5");
  outer.setAttribute("fill", "none");
  outer.setAttribute("stroke", "currentColor");
  outer.setAttribute("stroke-width", "2.6");

  const vLine = document.createElementNS(ns, "line");
  vLine.setAttribute("x1", "12");
  vLine.setAttribute("y1", "2.5");
  vLine.setAttribute("x2", "12");
  vLine.setAttribute("y2", "21.5");
  vLine.setAttribute("stroke", "currentColor");
  vLine.setAttribute("stroke-width", "2.4");

  const hLine = document.createElementNS(ns, "line");
  hLine.setAttribute("x1", "2.5");
  hLine.setAttribute("y1", "12");
  hLine.setAttribute("x2", "21.5");
  hLine.setAttribute("y2", "12");
  hLine.setAttribute("stroke", "currentColor");
  hLine.setAttribute("stroke-width", "2.4");

  svg.append(outer, vLine, hLine);
  return svg;
}

function appendPatternDecorations(card, patternNumber) {
  card.classList.add(`card--pattern-${patternNumber}`);

  const decor = document.createElement("div");
  decor.className = "card-decor";

  if (patternNumber === 1) {
    const stamp = createTaSymbolSvg();
    stamp.classList.add("ta-pos-1a");
    const sub = createTaSymbolSvg();
    sub.classList.add("ta-pos-1b");
    decor.append(stamp, sub);
  } else if (patternNumber === 2) {
    for (const cls of ["ta-pos-2a", "ta-pos-2b", "ta-pos-2c"]) {
      const s = createTaSymbolSvg();
      s.classList.add(cls);
      decor.appendChild(s);
    }
  } else if (patternNumber === 3) {
    const big = createTaSymbolSvg();
    big.classList.add("ta-pos-3a");
    const small = createTaSymbolSvg();
    small.classList.add("ta-pos-3b");
    decor.append(big, small);
  } else if (patternNumber === 4) {
    const tile1 = createTaSymbolSvg("multicolor");
    tile1.classList.add("ta-pos-4a");
    const tile2 = createTaSymbolSvg("multicolor");
    tile2.classList.add("ta-pos-4b");
    decor.append(tile1, tile2);
  } else if (patternNumber === 5) {
    const topEmb = document.createElement("span");
    topEmb.className = "ta-slit ta-pos-5a";
    topEmb.appendChild(createTaSymbolSvg());

    const bottomEmb = document.createElement("span");
    bottomEmb.className = "ta-slit ta-pos-5b";
    bottomEmb.appendChild(createTaSymbolSvg());

    decor.append(topEmb, bottomEmb);
  } else if (patternNumber === 6) {
    for (const cls of ["ta-pos-6a", "ta-pos-6b", "ta-pos-6c"]) {
      const s = createTaSymbolSvg();
      s.classList.add(cls);
      decor.appendChild(s);
    }
  } else if (patternNumber === 7) {
    for (const cls of ["ta-pos-7a", "ta-pos-7b", "ta-pos-7c", "ta-pos-7d"]) {
      const s = createTaSymbolSvg();
      s.classList.add(cls);
      decor.appendChild(s);
    }
  } else if (patternNumber === 8) {
    for (const cls of ["ta-pos-8a", "ta-pos-8b", "ta-pos-8c", "ta-pos-8d"]) {
      const s = createTaSymbolSvg();
      s.classList.add(cls);
      decor.appendChild(s);
    }
  } else if (patternNumber === 9) {
    for (const cls of ["ta-pos-9a", "ta-pos-9b", "ta-pos-9c"]) {
      const s = createTaSymbolSvg();
      s.classList.add(cls);
      decor.appendChild(s);
    }
  } else if (patternNumber === 10) {
    const grid = document.createElement("div");
    grid.className = "ta-grid-10";
    for (let k = 0; k < 6; k++) {
      grid.appendChild(createTaSymbolSvg());
    }
    const accent = createTaSymbolSvg();
    accent.classList.add("ta-pos-10a");
    decor.append(grid, accent);
  } else if (patternNumber === 11) {
    const watermark = createTaSymbolSvg();
    watermark.classList.add("ta-pos-3a");

    const scatterLarge = createTaSymbolSvg();
    scatterLarge.classList.add("ta-pos-6a");

    const scatterSmall = createTaSymbolSvg();
    scatterSmall.classList.add("ta-pos-6b");

    const bottomLeft = createTaSymbolSvg();
    bottomLeft.classList.add("ta-pos-11-bl");
    bottomLeft.style.color = pickRandomTaColor();

    decor.append(watermark, scatterLarge, scatterSmall, bottomLeft);
  }

  card.appendChild(decor);
}

function renderSheets(participants) {
  const sheetsContainer = document.getElementById("sheets");
  const summaryEl = document.getElementById("summary");
  const patternSelect = document.getElementById("pattern-select");
  const patternNumber = Number(patternSelect?.value) || 11;

  sheetsContainer.innerHTML = "";
  const imgElementsByKey = new Map();

  const totalPages = Math.max(1, Math.ceil(participants.length / CARDS_PER_PAGE));
  summaryEl.textContent = `参加者 ${participants.length} 名 / A4縦 ${totalPages} ページ（1ページ10枚）`;

  for (let page = 0; page < totalPages; page++) {
    const sheet = document.createElement("section");
    sheet.className = "sheet";

    const slice = participants.slice(
      page * CARDS_PER_PAGE,
      (page + 1) * CARDS_PER_PAGE
    );

    for (let i = 0; i < CARDS_PER_PAGE; i++) {
      const { name, username, iconUrl, profileUrl, role, socials } =
        normalizeParticipant(slice[i]);
      const card = document.createElement("div");
      card.className = "card";

      appendPatternDecorations(card, patternNumber);

      const headerEl = document.createElement("div");
      headerEl.className = "card-header";

      const logoEl = document.createElement("img");
      logoEl.className = "card-logo";
      logoEl.src = "assets/logo.png";
      logoEl.alt = "tamachi.go";
      headerEl.appendChild(logoEl);

      if (name && role) {
        const badgeEl = document.createElement("span");
        badgeEl.className = `card-badge ${getBadgeModifierClass(role)}`;
        badgeEl.textContent = role;
        headerEl.appendChild(badgeEl);
      }

      card.appendChild(headerEl);

      const mainEl = document.createElement("div");
      mainEl.className = "card-main";

      const primarySocial = pickPrimarySocial(socials);
      if (name && primarySocial) {
        const socialsEl = document.createElement("div");
        socialsEl.className = "card-socials";

        const itemEl = document.createElement("span");
        itemEl.className = "card-social-item";

        const iconNode = createSocialIconElement(primarySocial);
        if (iconNode) {
          itemEl.appendChild(iconNode);
        }

        const handleEl = document.createElement("span");
        handleEl.className = "card-social-handle";
        handleEl.textContent = primarySocial.username;
        itemEl.appendChild(handleEl);

        socialsEl.appendChild(itemEl);
        mainEl.appendChild(socialsEl);
      }

      const nameEl = document.createElement("div");
      nameEl.className = "card-name";
      nameEl.textContent = name;
      mainEl.appendChild(nameEl);

      card.appendChild(mainEl);

      if (name && (iconUrl || profileUrl || username)) {
        const iconEl = document.createElement("img");
        iconEl.className = "card-icon";
        if (iconUrl) {
          iconEl.src = iconUrl;
        }
        iconEl.alt = "";
        iconEl.addEventListener("error", () => {
          iconEl.remove();
        });
        card.appendChild(iconEl);

        const key = username || profileUrl;
        if (key) {
          if (!imgElementsByKey.has(key)) {
            imgElementsByKey.set(key, []);
          }
          imgElementsByKey.get(key).push(iconEl);
        }
      }

      sheet.appendChild(card);
    }

    sheetsContainer.appendChild(sheet);
  }

  upgradeParticipantIconsToHighRes(participants, imgElementsByKey);
}

document.getElementById("print-btn").addEventListener("click", () => {
  window.print();
});

document.getElementById("pattern-select")?.addEventListener("change", () => {
  renderSheets(cachedParticipants);
});

async function loadParticipants() {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.get(["participants"], (res) => {
      cachedParticipants = Array.isArray(res?.participants) ? res.participants : [];
      renderSheets(cachedParticipants);
    });
    return;
  }

  // localhost等での直接プレビュー時は sample/participants.json を読み込む
  try {
    const res = await fetch("./sample/participants.json");
    if (res.ok) {
      const data = await res.json();
      cachedParticipants = Array.isArray(data.participants) ? data.participants : [];
      renderSheets(cachedParticipants);
      return;
    }
  } catch (err) {
    console.error(err);
  }
  cachedParticipants = [];
  renderSheets([]);
}

loadParticipants();
