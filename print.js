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
<<<<<<< HEAD
const highResIconCache = new Map();
=======
>>>>>>> 5beb763 (initial commit)

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
<<<<<<< HEAD
  if (!entry) return { name: "", iconUrl: "", profileUrl: "", role: "" };
  if (typeof entry === "string") {
    return { name: entry, iconUrl: "", profileUrl: "", role: "Listener" };
  }
=======
  if (!entry) return { name: "", iconUrl: "", role: "" };
  if (typeof entry === "string") return { name: entry, iconUrl: "", role: "Listener" };
>>>>>>> 5beb763 (initial commit)
  const name = typeof entry.name === "string" ? entry.name : "";
  return {
    name,
    iconUrl: typeof entry.iconUrl === "string" ? entry.iconUrl : "",
<<<<<<< HEAD
    profileUrl: typeof entry.profileUrl === "string" ? entry.profileUrl : "",
=======
>>>>>>> 5beb763 (initial commit)
    role: normalizeRole(entry.role, Boolean(name))
  };
}

<<<<<<< HEAD
function extractHighResAvatarFromProfileHtml(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const candidateSelectors = [
    ".user_profile_area img",
    ".profile_area img",
    "#side_area .image_link img",
    "#main .image_link img",
    ".avatar img",
    "a.image_link img",
    "img[src*='media.connpass.com/thumbs/']"
  ];

  let bestImgUrl = "";
  let bestSize = 0;

  for (const img of doc.querySelectorAll(candidateSelectors.join(", "))) {
    // ヘッダー内のログイン中ユーザーのアイコンや、イベント・グループ一覧のサムネイルは除外
    if (img.closest("header, #header, .header_area, nav, .global_header")) continue;
    if (
      img.closest(
        ".event_list, .group_list, .schedule_area, .concerned_area, .participation_table_area, table"
      )
    ) {
      continue;
    }

    const rawSrc = img.getAttribute("src") || "";
    if (!rawSrc || rawSrc.includes("connpass_logo")) continue;

    let resolvedSrc = rawSrc;
    try {
      resolvedSrc = new URL(rawSrc, baseUrl).href;
    } catch {
      resolvedSrc = rawSrc;
    }

    const w = Number(img.getAttribute("width")) || 0;
    const h = Number(img.getAttribute("height")) || 0;
    const size = Math.max(w, h);

    if (size > bestSize) {
      bestSize = size;
      bestImgUrl = resolvedSrc;
    } else if (!bestImgUrl && resolvedSrc.includes("media.connpass.com/thumbs/")) {
      bestImgUrl = resolvedSrc;
    }
  }

  if (bestImgUrl && bestSize >= 80) {
    return bestImgUrl;
  }

  // og:image / twitter:image から高解像度サムネイルを取得
  const ogImage =
    doc.querySelector("meta[property='og:image']")?.getAttribute("content") ||
    doc.querySelector("meta[name='twitter:image']")?.getAttribute("content") ||
    "";
  if (
    ogImage &&
    ogImage.includes("media.connpass.com/thumbs/") &&
    !ogImage.includes("connpass_logo")
  ) {
    return ogImage;
  }

  return bestImgUrl || "";
}

async function fetchHighResIconUrl(profileUrl) {
  if (!profileUrl) return "";
  if (highResIconCache.has(profileUrl)) {
    return highResIconCache.get(profileUrl);
  }

  // サブドメイン URL と connpass.com 本体 URL の両方を候補にする
  const urlsToTry = [profileUrl];
  try {
    const parsed = new URL(profileUrl);
    if (parsed.hostname.endsWith(".connpass.com")) {
      urlsToTry.unshift(`https://connpass.com${parsed.pathname}`);
    }
  } catch {
    // ignore
  }

  for (const url of urlsToTry) {
    try {
      const res = await fetch(url, { credentials: "omit" });
      if (!res.ok) continue;
      const html = await res.text();
      const highRes = extractHighResAvatarFromProfileHtml(html, url);
      if (highRes) {
        highResIconCache.set(profileUrl, highRes);
        return highRes;
      }
    } catch {
      // ignore and try next candidate
    }
  }

  highResIconCache.set(profileUrl, "");
  return "";
}

async function upgradeParticipantIconsToHighRes(participants, imgElementsByProfileUrl) {
  const targets = participants.filter(
    (p) => p && typeof p === "object" && p.profileUrl && !p.highResResolved
  );
  if (targets.length === 0) return;

  const CONCURRENCY = 5;
  let cursor = 0;
  let updatedAny = false;

  async function worker() {
    while (cursor < targets.length) {
      const target = targets[cursor++];
      const highResUrl = await fetchHighResIconUrl(target.profileUrl);
      target.highResResolved = true;
      if (highResUrl && highResUrl !== target.iconUrl) {
        target.iconUrl = highResUrl;
        updatedAny = true;
        const imgs = imgElementsByProfileUrl.get(target.profileUrl) || [];
        for (const imgEl of imgs) {
          imgEl.src = highResUrl;
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

=======
>>>>>>> 5beb763 (initial commit)
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
<<<<<<< HEAD
=======
    // #11: #3（右下背景の大きな透かし「田」）＋ #6（右上の大小散らし小紋＋左下の10色ランダム「田」）
>>>>>>> 5beb763 (initial commit)
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
<<<<<<< HEAD
  const imgElementsByProfileUrl = new Map();
=======
>>>>>>> 5beb763 (initial commit)

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
<<<<<<< HEAD
      const { name, iconUrl, profileUrl, role } = normalizeParticipant(slice[i]);
=======
      const { name, iconUrl, role } = normalizeParticipant(slice[i]);
>>>>>>> 5beb763 (initial commit)
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

      const nameEl = document.createElement("div");
      nameEl.className = "card-name";
      nameEl.textContent = name;
      card.appendChild(nameEl);

<<<<<<< HEAD
      if (name && (iconUrl || profileUrl)) {
        const iconEl = document.createElement("img");
        iconEl.className = "card-icon";
        if (iconUrl) {
          iconEl.src = iconUrl;
        }
=======
      if (name && iconUrl) {
        const iconEl = document.createElement("img");
        iconEl.className = "card-icon";
        iconEl.src = iconUrl;
>>>>>>> 5beb763 (initial commit)
        iconEl.alt = "";
        iconEl.addEventListener("error", () => {
          iconEl.remove();
        });
        card.appendChild(iconEl);
<<<<<<< HEAD

        if (profileUrl) {
          if (!imgElementsByProfileUrl.has(profileUrl)) {
            imgElementsByProfileUrl.set(profileUrl, []);
          }
          imgElementsByProfileUrl.get(profileUrl).push(iconEl);
        }
=======
>>>>>>> 5beb763 (initial commit)
      }

      sheet.appendChild(card);
    }

    sheetsContainer.appendChild(sheet);
  }
<<<<<<< HEAD

  upgradeParticipantIconsToHighRes(participants, imgElementsByProfileUrl);
=======
>>>>>>> 5beb763 (initial commit)
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
