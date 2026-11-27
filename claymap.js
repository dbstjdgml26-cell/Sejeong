/* ============================================================
   claymap.js — 클레이 자동차 전시장 맵 위에 캐릭터를 세웁니다.
   정적 배경(assets/showroom-map.png) + DOM 오버레이.
   app.js 의 Firebase 연동과는 느슨하게 연결됩니다:
   createClayMap({ root, zones, motion, onPersonClick })
     → { syncPeople(list), focusZone(id), setMotion(on), applyDecor(decor), dispose() }
   ============================================================ */

/* 배경 이미지 안에서 각 구역이 있는 자리 (퍼센트) */
const PLACE = {
  showroom: { x: 41, y: 84, tag: { x: 56, y: 73 } },
  desk:     { x: 21, y: 77, tag: { x: 15, y: 47 } },
  lounge:   { x: 69, y: 79, tag: { x: 84, y: 44 } }
};

const DEFAULT_PLACE = { x: 50, y: 83, tag: { x: 50, y: 50 } };

const DECOR_PROP_IDS = ["tree", "gifts", "carpet", "plants", "welcomeStand", "spotlights"];
const BANNER_DEFAULT = "PICKLE MOTORS";

/* ---------- 소품 그림 (SVG) ---------- */

const PROP_MARKUP = {
  tree: `
  <svg viewBox="0 0 100 160" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="clayTreeA" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3D9270"/><stop offset="1" stop-color="#1F6448"/>
      </linearGradient>
      <linearGradient id="clayTreeB" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4AA37E"/><stop offset="1" stop-color="#2A7756"/>
      </linearGradient>
    </defs>
    <path d="M50 8 l3.6 7.6 8.4 1.2 -6 6 1.4 8.4 -7.4 -4 -7.4 4 1.4 -8.4 -6 -6 8.4 -1.2 z" fill="#E6C48A"/>
    <path d="M50 26 L72 64 Q74 68 69 68 L31 68 Q26 68 28 64 Z" fill="url(#clayTreeB)"/>
    <path d="M50 42 L82 96 Q84 101 78 101 L22 101 Q16 101 18 96 Z" fill="url(#clayTreeA)"/>
    <path d="M50 60 L92 126 Q94 131 88 131 L12 131 Q6 131 8 126 Z" fill="url(#clayTreeB)"/>
    <path d="M50 60 L92 126 Q94 131 88 131 L50 131 Z" fill="#000" opacity=".07"/>
    <circle cx="34" cy="112" r="3.4" fill="#C0263C"/>
    <circle cx="62" cy="118" r="3.2" fill="#E6C48A"/>
    <circle cx="46" cy="88" r="3" fill="#C0263C"/>
    <circle cx="68" cy="82" r="2.8" fill="#E6C48A"/>
    <rect x="45" y="126" width="10" height="12" fill="#7A4A28"/>
    <rect x="30" y="134" width="40" height="11" rx="5" fill="#C9884F"/>
    <path d="M34 145 h32 l-3.5 13 q-.6 3.4 -4 3.4 h-17 q-3.4 0 -4 -3.4 z" fill="#B9743F"/>
    <path d="M34 145 h32 l-1 4 h-30 z" fill="#000" opacity=".08"/>
  </svg>`,

  carpet: `
  <svg viewBox="0 0 100 150" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id="clayCarpet" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#A8202E"/><stop offset="1" stop-color="#7A1220"/>
      </linearGradient>
    </defs>
    <path d="M31 2 H69 L100 148 H0 Z" fill="url(#clayCarpet)"/>
    <path d="M31 2 H69 L100 148 H0 Z" fill="none" stroke="#E6C48A" stroke-width="2.4" opacity=".72"/>
    <path d="M34 8 H66 L93 142 H7 Z" fill="none" stroke="#E6C48A" stroke-width="1" opacity=".45"/>
    <path d="M46 10 H54 L60 140 H40 Z" fill="#FFFFFF" opacity=".05"/>
    <path d="M31 2 H69 L100 148 H0 Z" fill="none" stroke="#5A0C16" stroke-width="1" opacity=".35" transform="translate(0,-1)"/>
  </svg>`,

  gifts: `
  <svg viewBox="0 0 120 100" aria-hidden="true" focusable="false">
    <path d="M62 40 L78 26 L104 26 L88 40 Z" fill="#D0405A"/>
    <path d="M88 40 L104 26 L104 72 L88 86 Z" fill="#8C1C2E"/>
    <path d="M62 40 L88 40 L88 86 L62 86 Z" fill="#B3263A"/>
    <path d="M74 40 h6 v46 h-6 z" fill="#E6C48A"/>
    <path d="M70 30 l6 -6 l6 6 l-6 5 z" fill="#E6C48A"/>
    <path d="M18 56 L34 44 L60 44 L44 56 Z" fill="#2C8163"/>
    <path d="M44 56 L60 44 L60 84 L44 96 Z" fill="#17553F"/>
    <path d="M18 56 L44 56 L44 96 L18 96 Z" fill="#1F6B4D"/>
    <path d="M29 56 h5 v40 h-5 z" fill="#E6C48A"/>
    <path d="M18 56 L44 56 L60 44 L34 44 Z" fill="#35996F" opacity=".55"/>
    <path d="M26 48 l5 -6 l5 6 l-5 5 z" fill="#E6C48A"/>
    <ellipse cx="52" cy="97" rx="42" ry="4" fill="#5A3520" opacity=".16"/>
    <ellipse cx="72" cy="88" rx="24" ry="3" fill="#5A3520" opacity=".14"/>
  </svg>`,

  plants: `
  <svg viewBox="0 0 100 130" aria-hidden="true" focusable="false">
    <g fill="#2F7D58">
      <path d="M50 78 C42 52 40 30 50 12 C60 30 58 52 50 78 Z"/>
      <path d="M50 78 C42 52 40 30 50 12 C60 30 58 52 50 78 Z" transform="rotate(-34 50 78)" fill="#1F6448"/>
      <path d="M50 78 C42 52 40 30 50 12 C60 30 58 52 50 78 Z" transform="rotate(34 50 78)" fill="#35885F"/>
      <path d="M50 78 C42 52 40 30 50 12 C60 30 58 52 50 78 Z" transform="rotate(-62 50 78)" fill="#2A7756"/>
      <path d="M50 78 C42 52 40 30 50 12 C60 30 58 52 50 78 Z" transform="rotate(62 50 78)" fill="#2A7756"/>
    </g>
    <rect x="30" y="74" width="40" height="11" rx="5" fill="#C9884F"/>
    <path d="M34 85 h32 l-3.5 27 q-.6 3.4 -4 3.4 h-17 q-3.4 0 -4 -3.4 z" fill="#B9743F"/>
    <path d="M34 85 h32 l-1 4 h-30 z" fill="#000" opacity=".08"/>
    <ellipse cx="50" cy="119" rx="22" ry="4" fill="#5A3520" opacity=".18"/>
  </svg>`,

  welcomeStand: `
  <svg viewBox="0 0 100 150" aria-hidden="true" focusable="false">
    <ellipse cx="50" cy="143" rx="17" ry="5" fill="#3A2A1E" opacity=".55"/>
    <rect x="47" y="70" width="6" height="70" rx="3" fill="#4A3A2C"/>
    <path d="M24 22 h52 a5 5 0 0 1 5 5 v50 a5 5 0 0 1 -5 5 h-52 a5 5 0 0 1 -5 -5 v-50 a5 5 0 0 1 5 -5 z" fill="#2B2B33"/>
    <path d="M27 27 h46 a3 3 0 0 1 3 3 v42 a3 3 0 0 1 -3 3 h-46 a3 3 0 0 1 -3 -3 v-42 a3 3 0 0 1 3 -3 z" fill="none" stroke="#E6C48A" stroke-width="1.6" opacity=".8"/>
    <text x="50" y="52" text-anchor="middle" font-family="Pretendard, system-ui, sans-serif" font-size="15" font-weight="700" fill="#F2DCAE" letter-spacing="1.2">WELCOME</text>
    <text x="50" y="66" text-anchor="middle" font-family="Pretendard, system-ui, sans-serif" font-size="6.4" font-weight="600" fill="#C9B79A" letter-spacing="1.6">PICKLE MOTORS</text>
  </svg>`
};

export function createClayMap(opts = {}) {
  const { root, zones = [], onPersonClick, motion = true } = opts;
  if (!root) throw new Error("claymap: root 가 필요합니다");

  const overlay = document.createElement("div");
  overlay.className = "map-overlay" + (motion ? "" : " is-still");

  /* ---------- 🎨 공간 꾸미기 레이어 ---------- */

  const decorLayer = document.createElement("div");
  decorLayer.className = "decor-layer" + (motion ? "" : " is-still");
  decorLayer.dataset.banner = BANNER_DEFAULT;
  decorLayer.innerHTML = `
    <div class="decor-spotlights" data-decor-prop="spotlights" aria-hidden="true">
      <span class="decor-beam b1"></span><span class="decor-beam b2"></span><span class="decor-beam b3"></span>
      <span class="decor-beam b4"></span>
      <span class="decor-pool p1"></span><span class="decor-pool p2"></span>
      <span class="decor-pool p3"></span><span class="decor-pool p4"></span>
    </div>
    <div class="decor-banner" data-decor-prop="banner">
      <span class="decor-banner-cord" aria-hidden="true"></span>
      <div class="decor-banner-board"><span class="decor-banner-text">${BANNER_DEFAULT}</span></div>
    </div>
    <div class="decor-car" aria-hidden="true">
      <span class="decor-car-paint"></span>
      <span class="decor-car-shade"></span>
    </div>
    <div class="decor-prop prop-carpet" data-decor-prop="carpet" aria-hidden="true">${PROP_MARKUP.carpet}</div>
    <div class="decor-prop prop-tree" data-decor-prop="tree" aria-hidden="true">${PROP_MARKUP.tree}</div>
    <div class="decor-prop prop-plants" data-decor-prop="plants" aria-hidden="true">
      <span class="plant p1">${PROP_MARKUP.plants}</span>
      <span class="plant p2">${PROP_MARKUP.plants}</span>
    </div>
    <div class="decor-prop prop-gifts" data-decor-prop="gifts" aria-hidden="true">${PROP_MARKUP.gifts}</div>
    <div class="decor-prop prop-welcome" data-decor-prop="welcomeStand" aria-hidden="true">${PROP_MARKUP.welcomeStand}</div>
  `;


  const carPaint = decorLayer.querySelector(".decor-car-paint");
  const carShade = decorLayer.querySelector(".decor-car-shade");
  const bannerText = decorLayer.querySelector(".decor-banner-text");
  const bannerBoard = decorLayer.querySelector(".decor-banner-board");
  const propEls = new Map();
  decorLayer.querySelectorAll("[data-decor-prop]").forEach((el) => {
    propEls.set(el.dataset.decorProp, el);
  });

  const layers = new Map();
  const tags = new Map();

  zones.forEach((zone) => {
    const place = PLACE[zone.id] || DEFAULT_PLACE;

    const layer = document.createElement("div");
    layer.className = "zone-layer";
    layer.dataset.zone = zone.id;
    layer.style.setProperty("--x", place.x + "%");
    layer.style.setProperty("--y", place.y + "%");
    overlay.appendChild(layer);
    layers.set(zone.id, layer);

    const tag = document.createElement("button");
    tag.type = "button";
    tag.className = "zone-tag";
    tag.dataset.zone = zone.id;
    tag.style.setProperty("--x", place.tag.x + "%");
    tag.style.setProperty("--y", place.tag.y + "%");
    tag.setAttribute("aria-label", `${zone.name} 보기`);
    tag.innerHTML = `<span aria-hidden="true">${zone.icon}</span><span>${zone.name}</span><b>0</b>`;
    tag.addEventListener("click", () => {
      focusZone(zone.id);
    });
    overlay.appendChild(tag);
    tags.set(zone.id, tag);
  });

  overlay.addEventListener("click", (e) => {
    const btn = e.target.closest(".clay-person");
    if (!btn) return;
    const person = personIndex.get(btn.dataset.pid);
    if (person && onPersonClick) onPersonClick(person);
  });

  root.appendChild(decorLayer);
  root.appendChild(overlay);

  let people = [];
  const personIndex = new Map();

  function figureHTML(p, i) {
    const img = p.characterImg;
    const status = p.statusLabel || "대기 중";
    const bubble = p.message
      ? `<span class="clay-bubble">${esc(p.message)}</span>`
      : "";
    const delay = `--d:${(i % 5) * 0.36}s`;
    const color = p.statusColor || "#A0876C";
    const ring = p.isMe ? " is-me" : "";
    const alt = img ? `${esc(p.name)}의 캐릭터` : "";
    const body = img
      ? `<img class="clay-fig" src="${esc(img)}" alt="${alt}" style="${delay}" draggable="false">`
      : `<span class="clay-fig clay-fig-fallback" style="${delay};--c:${esc(p.color || "#C9932F")}">
           <span class="eyes"></span><span class="consonant">${esc((p.consonant || "?").slice(0, 1))}</span>
         </span>`;
    return `<button class="clay-person${ring}" type="button" data-pid="${esc(p.pid)}"
              title="${esc(p.name)} · ${esc(status)}">
        ${bubble}
        ${body}
        <span class="clay-name"><i style="--sc:${esc(color)}"></i>${esc(p.name)}${p.isMe ? " · 나" : ""}</span>
      </button>`;
  }

  function syncPeople(list) {
    people = Array.isArray(list) ? list : [];
    personIndex.clear();
    const counts = new Map(zones.map((z) => [z.id, 0]));

    zones.forEach((zone) => {
      const layer = layers.get(zone.id);
      if (!layer) return;
      const members = people.filter((p) => (p.zone || "showroom") === zone.id);
      counts.set(zone.id, members.length);
      layer.innerHTML = members.map((p, i) => figureHTML(p, i)).join("");
      layer.classList.toggle("is-crowd", members.length > 3);
      layer.classList.toggle("is-sparse", members.length === 1);
    });

    people.forEach((p) => personIndex.set(String(p.pid), p));

    tags.forEach((tag, id) => {
      const n = counts.get(id) || 0;
      const b = tag.querySelector("b");
      if (b) b.textContent = String(n);
      tag.classList.toggle("is-here", n > 0);
      tag.setAttribute("aria-label", `${zones.find((z) => z.id === id).name} · ${n}명`);
    });
  }

  function focusZone(id) {
    tags.forEach((tag, key) => tag.classList.toggle("is-here", key === id));
    const layer = layers.get(id);
    if (!layer) return;
    layer.querySelectorAll(".clay-person").forEach((el) => {
      el.classList.remove("pop");
      // reflow so the animation can replay
      void el.offsetWidth;
      el.classList.add("pop");
      setTimeout(() => el.classList.remove("pop"), 1500);
    });
  }

  function setMotion(on) {
    overlay.classList.toggle("is-still", !on);
    decorLayer.classList.toggle("is-still", !on);
  }

  /* ---------- 🎨 꾸미기 적용 ---------- */

  function fitBanner() {
    const text = (decorLayer.dataset.banner || BANNER_DEFAULT).trim() || BANNER_DEFAULT;
    const w = bannerBoard.clientWidth;
    const h = bannerBoard.clientHeight;
    if (!w || !h) return;
    bannerText.textContent = text;
    let size = h * 0.56;
    bannerText.style.fontSize = size + "px";
    // 24자까지는 길이에 맞춰 글자를 줄여 한 줄에 담습니다
    let guard = 0;
    while (bannerText.scrollWidth > w * 0.88 && size > 7 && guard < 40) {
      size *= 0.92;
      bannerText.style.fontSize = size + "px";
      guard++;
    }
  }

  function applyDecor(raw) {
    const d = raw && typeof raw === "object" ? raw : {};

    if (typeof d.carColor === "string" && /^#[0-9a-fA-F]{6}$/.test(d.carColor)) {
      carPaint.style.setProperty("--car", d.carColor);
      carShade.style.setProperty("--car", d.carColor);
      const n = parseInt(d.carColor.slice(1), 16);
      const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      carShade.style.setProperty("--car-ink", lum < 0.34 ? "0.30" : lum < 0.6 ? "0.16" : "0.07");
    }

    if (typeof d.bannerText === "string") {
      decorLayer.dataset.banner = d.bannerText.trim().slice(0, 24) || BANNER_DEFAULT;
      fitBanner();
    }

    if (d.lightTone) root.dataset.tone = d.lightTone;

    if (d.props && typeof d.props === "object") {
      DECOR_PROP_IDS.forEach((id) => {
        const el = propEls.get(id);
        if (!el) return;
        el.classList.toggle("is-on", d.props[id] === true);
        el.setAttribute("aria-hidden", String(d.props[id] !== true));
      });
    }
  }

  /* 처음 한 번, 배너 글자를 판 크기에 맞추고 창 크기가 바뀌면 다시 맞춥니다 */
  if (typeof ResizeObserver === "function") {
    const ro = new ResizeObserver(() => fitBanner());
    ro.observe(bannerBoard);
    decorLayer._ro = ro;
  }

  function dispose() {
    if (decorLayer._ro) decorLayer._ro.disconnect();
    overlay.remove();
    decorLayer.remove();
    layers.clear();
    tags.clear();
    personIndex.clear();
  }

  return { syncPeople, focusZone, setMotion, applyDecor, dispose };
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
