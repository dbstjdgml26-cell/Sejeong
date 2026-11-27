/* ============================================================
   PICKLE MOTORS · SHOWROOM — 성희의 합동 비서실
   Front-end for a shared realtime showroom.
   Backend: Firebase Realtime Database (Spark, free).
   Fallback: localStorage when Firebase is unreachable.
   ============================================================ */

const firebaseConfig = {
  apiKey: "AIzaSyDqexhW4z-2b3lgSprlujU3LBzrV9YlQ1g",
  authDomain: "sejeong-pickle-office.firebaseapp.com",
  databaseURL: "https://sejeong-pickle-office-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sejeong-pickle-office",
  storageBucket: "sejeong-pickle-office.firebasestorage.app",
  messagingSenderId: "155846351235",
  appId: "1:155846351235:web:de655502a045cb8f59feb6"
};

/* ---------------- constants ---------------- */

const ROOM_TITLE = "성희의 합동 비서실";

const ZONES = [
  { id: "showroom", icon: "🚘", name: "메인 쇼룸",  hint: "전시 · 업무" },
  { id: "desk",     icon: "🤝", name: "상담 테이블", hint: "회의 · 미팅" },
  { id: "lounge",   icon: "☕", name: "고객 라운지", hint: "대기 · 모니터링" }
];

const STATUSES = [
  { id: "idle",    label: "대기 중",  color: "#5fa8ff" },
  { id: "working", label: "작업 중",  color: "#37d39b" },
  { id: "watching",label: "감시 중",  color: "#e6c48a" },
  { id: "meeting", label: "회의 중",  color: "#c08bff" },
  { id: "away",    label: "자리 비움", color: "#7c8598" }
];

const PALETTE = [
  "#8b5cf6", "#37d39b", "#ff7a59", "#5fa8ff",
  "#e6c48a", "#f06fa8", "#38c7c7", "#9aa3b2"
];

const TASK_COLUMNS = [
  { id: "todo",  title: "대기" },
  { id: "doing", title: "진행 중" },
  { id: "done",  title: "완료" }
];

const ME_KEY = "showroom.me.v1";
const LOCAL_KEY = "showroom.local.v1";
const MSG_LIMIT = 80;

/* ---------------- utils ---------------- */

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeRegExp(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function uid(prefix) {
  const rnd = (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rnd}`;
}

function zoneOf(id) { return ZONES.find(z => z.id === id) || ZONES[0]; }
function statusOf(id) { return STATUSES.find(s => s.id === id) || STATUSES[0]; }

/* '쇼룸으로' / '테이블로' / '라운지로' */
function josaRo(word) {
  const code = (word || "").charCodeAt((word || "").length - 1);
  if (!(code >= 0xac00 && code <= 0xd7a3)) return "로";
  const final = (code - 0xac00) % 28;
  return final === 0 || final === 8 ? "로" : "으로";
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function linkify(raw, names) {
  const list = (names || []).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!list.length || raw.indexOf("@") === -1) return escapeHtml(raw);
  const re = new RegExp("@(" + list.map(escapeRegExp).join("|") + ")", "g");
  let out = "", last = 0, m;
  while ((m = re.exec(raw)) !== null) {
    out += escapeHtml(raw.slice(last, m.index));
    out += `<span class="mention">@${escapeHtml(m[1])}</span>`;
    last = m.index + m[0].length;
  }
  out += escapeHtml(raw.slice(last));
  return out;
}

function avatarHTML(person, cls = "") {
  const color = person.color || "#8b5cf6";
  const consonant = (person.consonant || "?").slice(0, 2);
  return `<div class="critter ${cls}" style="--c:${escapeHtml(color)}" aria-hidden="true">
      <span class="eyes"></span><span class="consonant">${escapeHtml(consonant)}</span>
    </div>`;
}

let toastTimer = null;
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* fall through */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch (e) { return false; }
}

/* ---------------- state ---------------- */

const state = {
  me: null,             // {pid,name,consonant,color,zone,status,message}
  people: {},           // pid -> presence
  messages: [],         // newest last
  tasks: [],
  mode: "connecting",   // connecting | live | local
  connected: false,
  firstSync: false,
  pendingZoneRender: false
};

/* ---------------- backend: firebase ---------------- */

let FB = null; // {db, api}

async function connectFirebase() {
  const appMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js");
  const dbMod = await import("https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js");
  const app = appMod.initializeApp(firebaseConfig);
  const db = dbMod.getDatabase(app);
  FB = { db, api: dbMod };
  return FB;
}

function fbPresenceRef(pid) { return FB.api.ref(FB.db, `office/presence/${pid}`); }

async function fbStart() {
  const { api, db } = FB;

  api.onValue(api.ref(db, ".info/connected"), (snap) => {
    const on = snap.val() === true;
    state.connected = on;
    if (on && state.me) bindPresence();
    paintConn();
  });

  api.onValue(api.ref(db, "office/presence"), (snap) => {
    state.people = snap.val() || {};
    state.firstSync = true;
    renderZones(); renderMentions(); renderAssigneeOptions();
  }, onDbError);

  const msgQ = api.query(api.ref(db, "office/messages"), api.orderByChild("createdAt"), api.limitToLast(MSG_LIMIT));
  api.onValue(msgQ, (snap) => {
    const val = snap.val() || {};
    state.messages = Object.entries(val)
      .map(([id, m]) => ({ id, ...m }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    renderChat();
  }, onDbError);

  api.onValue(api.ref(db, "office/tasks"), (snap) => {
    const val = snap.val() || {};
    state.tasks = Object.entries(val)
      .map(([id, t]) => ({ id, ...t }))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    renderBoard();
  });
}

function onDbError(err) {
  console.warn("realtime read failed", err);
  if (state.mode === "live") startLocal((err && err.message) || "read failed");
}

let presenceBound = false;
function bindPresence() {
  const { api } = FB;
  const myRef = fbPresenceRef(state.me.pid);
  presenceBound = true;
  api.onDisconnect(myRef).remove();
  api.set(myRef, presencePayload());
}

function presencePayload() {
  const me = state.me;
  return {
    name: me.name,
    consonant: me.consonant,
    color: me.color,
    zone: me.zone,
    status: me.status,
    message: me.message || "",
    ts: FB.api.serverTimestamp()
  };
}

async function fbPatchPresence() {
  if (!state.me) return;
  try {
    await FB.api.update(fbPresenceRef(state.me.pid), presencePayload());
  } catch (e) {
    console.warn("presence update failed", e);
    toast("상태를 저장하지 못했어요");
  }
}

async function fbRemovePresence(pid) {
  try { await FB.api.remove(fbPresenceRef(pid)); } catch (e) { console.warn(e); }
}

async function fbPushMessage(msg) {
  await FB.api.push(FB.api.ref(FB.db, "office/messages"), msg);
}
async function fbPushTask(task) {
  await FB.api.push(FB.api.ref(FB.db, "office/tasks"), task);
}
async function fbPatchTask(id, patch) {
  await FB.api.update(FB.api.ref(FB.db, `office/tasks/${id}`), patch);
}
async function fbRemoveTask(id) {
  await FB.api.remove(FB.api.ref(FB.db, `office/tasks/${id}`));
}

/* ---------------- backend: local fallback ---------------- */

const LOCAL = { data: null, listeners: [] };

function localLoad() {
  try {
    LOCAL.data = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
  } catch (e) { LOCAL.data = null; }
  if (!LOCAL.data || typeof LOCAL.data !== "object") {
    LOCAL.data = { presence: {}, messages: {}, tasks: {} };
  }
  LOCAL.data.presence = LOCAL.data.presence || {};
  LOCAL.data.messages = LOCAL.data.messages || {};
  LOCAL.data.tasks = LOCAL.data.tasks || {};
}
function localSave() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(LOCAL.data)); } catch (e) { /* quota */ }
  localApply();
}
function localApply() {
  state.people = { ...LOCAL.data.presence };
  state.messages = Object.entries(LOCAL.data.messages)
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .slice(-MSG_LIMIT);
  state.tasks = Object.entries(LOCAL.data.tasks)
    .map(([id, t]) => ({ id, ...t }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  renderZones(); renderChat(); renderBoard(); renderMentions(); renderAssigneeOptions();
}

function startLocal(reason) {
  state.mode = "local";
  state.connected = false;
  state.firstSync = true;
  localLoad();
  paintConn();
  localApply();
  window.addEventListener("storage", (ev) => {
    if (ev.key === LOCAL_KEY) { localLoad(); localApply(); }
  });
  window.addEventListener("beforeunload", () => {
    if (state.me && LOCAL.data) { delete LOCAL.data.presence[state.me.pid]; localSave(); }
  });
  if (reason) console.warn("local mode:", reason);
}

/* ---------------- unified actions ---------------- */

async function savePresence() {
  if (!state.me) return;
  if (state.mode === "live") await fbPatchPresence();
  else if (state.mode === "local") {
    LOCAL.data.presence[state.me.pid] = {
      name: state.me.name, consonant: state.me.consonant, color: state.me.color,
      zone: state.me.zone, status: state.me.status, message: state.me.message || "",
      ts: Date.now()
    };
    localSave();
  }
}

async function sendMessage(text) {
  if (!state.me) { openJoin(); toast("먼저 입장해 주세요"); return; }
  const body = text.trim().slice(0, 500);
  if (!body) return;
  const msg = {
    name: state.me.name, pid: state.me.pid,
    consonant: state.me.consonant, color: state.me.color,
    text: body, createdAt: Date.now()
  };
  try {
    if (state.mode === "live") {
      await fbPushMessage({ ...msg, createdAt: FB.api.serverTimestamp() });
    } else {
      LOCAL.data.messages[uid("m")] = msg;
      localSave();
    }
  } catch (e) {
    console.warn(e);
    toast("메시지를 보내지 못했어요");
  }
}

async function addTask(title, assigneeName) {
  const clean = String(title || "").trim().slice(0, 200);
  if (!clean) return;
  const assignee = resolvePerson(assigneeName);
  const task = {
    title: clean,
    assignee: assignee.name,
    assigneeConsonant: assignee.consonant || "",
    assigneeColor: assignee.color || "#8b5cf6",
    status: "todo",
    createdBy: state.me ? state.me.name : "게스트",
    createdAt: Date.now()
  };
  try {
    if (state.mode === "live") {
      await fbPushTask({ ...task, createdAt: FB.api.serverTimestamp() });
    } else {
      LOCAL.data.tasks[uid("t")] = task;
      localSave();
    }
    toast("할 일 보드에 올렸습니다");
  } catch (e) {
    console.warn(e);
    toast("할 일을 추가하지 못했어요");
  }
}

async function advanceTask(task) {
  const order = ["todo", "doing", "done"];
  const next = order[(order.indexOf(task.status) + 1) % order.length];
  const patch = { status: next, updatedAt: Date.now() };
  try {
    if (state.mode === "live") await fbPatchTask(task.id, patch);
    else { LOCAL.data.tasks[task.id] = { ...LOCAL.data.tasks[task.id], ...patch }; localSave(); }
  } catch (e) { console.warn(e); toast("상태를 바꾸지 못했어요"); }
}

async function deleteTask(task) {
  try {
    if (state.mode === "live") await fbRemoveTask(task.id);
    else { delete LOCAL.data.tasks[task.id]; localSave(); }
  } catch (e) { console.warn(e); toast("할 일을 지우지 못했어요"); }
}

function resolvePerson(name) {
  const list = Object.values(state.people).concat(state.me ? [state.me] : []);
  const hit = list.find(p => p && p.name === name);
  if (hit) return hit;
  return { name: name || (state.me ? state.me.name : "성희"), consonant: "ㅅ", color: "#8b5cf6" };
}

/* ---------------- rendering ---------------- */

function paintConn() {
  const el = $("conn");
  const label = el.querySelector(".conn-label");
  el.classList.remove("is-live", "is-local", "is-off");
  if (state.mode === "live" && state.connected) {
    el.classList.add("is-live");
    label.textContent = "실시간 연결됨";
    el.title = "Firebase Realtime Database 와 실시간으로 동기화 중입니다";
  } else if (state.mode === "live") {
    el.classList.add("is-off");
    label.textContent = "연결 대기 중";
    el.title = "네트워크를 기다리는 중입니다";
  } else if (state.mode === "local") {
    el.classList.add("is-local");
    label.textContent = "로컬 모드";
    el.title = "실시간 연결에 실패해 이 브라우저에만 저장 중입니다";
  } else {
    label.textContent = "연결 중…";
  }
}

function participantList() {
  const list = Object.values(state.people).filter(Boolean).map(p => ({ ...p }));
  if (state.me) {
    const i = list.findIndex(p => p.pid === state.me.pid || p.name === state.me.name);
    const mine = { ...(i >= 0 ? list[i] : {}), ...state.me, pid: state.me.pid };
    if (i >= 0) list[i] = mine; else list.push(mine);
  }
  return list;
}

function renderZones() {
  const active = document.activeElement;
  if (active && active.classList && active.classList.contains("seat-msg-input")) {
    state.pendingZoneRender = true;
    return;
  }
  state.pendingZoneRender = false;

  const people = participantList();
  const host = $("zones");
  host.innerHTML = ZONES.map(zone => {
    const members = people
      .filter(p => (p.zone || "showroom") === zone.id)
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    const seats = members.map(p => seatHTML(p)).join("");
    return `<div class="zone" data-zone="${zone.id}">
      <div class="zone-head">
        <span class="zone-icon" aria-hidden="true">${zone.icon}</span>
        <span class="zone-name">${zone.name}</span>
        <span class="zone-hint">${zone.hint}</span>
        <span class="zone-count">${members.length}</span>
      </div>
      <div class="zone-floor">${seats || `<div class="seat-empty">${state.firstSync ? "아직 아무도 없어요" : "불러오는 중…"}</div>`}</div>
    </div>`;
  }).join("");

  host.querySelectorAll(".zone-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (!state.me) { openJoin(); toast("먼저 입장해 주세요"); return; }
      state.me.zone = btn.dataset.to;
      persistMe();
      savePresence();
      renderZones();
    });
  });
  host.querySelectorAll(".seat-select").forEach(sel => {
    sel.addEventListener("change", () => {
      state.me.status = sel.value;
      persistMe();
      savePresence();
    });
  });
  host.querySelectorAll(".seat-msg-input").forEach(inp => {
    inp.addEventListener("change", () => {
      state.me.message = inp.value.trim().slice(0, 140);
      persistMe();
      savePresence();
    });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") inp.blur(); });
    inp.addEventListener("blur", () => {
      if (state.pendingZoneRender) renderZones();
    });
  });
}

function seatHTML(p) {
  const isMe = !!(state.me && p.pid === state.me.pid);
  const st = statusOf(p.status);
  const zoneId = p.zone || "showroom";
  const msg = p.message ? `<div class="seat-msg">${escapeHtml(p.message)}</div>` : "";

  const controls = isMe ? `
    <div class="seat-ctrl">
      ${ZONES.map(z => `<button class="zone-btn" type="button" data-to="${z.id}"
          aria-pressed="${z.id === zoneId}" title="${z.name}${josaRo(z.name)} 이동" aria-label="${z.name}${josaRo(z.name)} 이동">${z.icon}</button>`).join("")}
    </div>
    <select class="seat-select" aria-label="내 상태">
      ${STATUSES.map(s => `<option value="${s.id}" ${s.id === st.id ? "selected" : ""}>${s.label}</option>`).join("")}
    </select>
    <input class="seat-msg-input" type="text" maxlength="140" placeholder="상태 메시지"
      value="${escapeHtml(p.message || "")}" aria-label="상태 메시지">` : "";

  return `<div class="seat${isMe ? " is-me" : ""}" data-pid="${escapeHtml(p.pid || "")}">
      ${avatarHTML(p)}
      <div class="seat-name" title="${escapeHtml(p.name || "")}">${escapeHtml(p.name || "이름 없음")}${isMe ? " · 나" : ""}</div>
      <span class="seat-status" style="--sc:${st.color}">${st.label}</span>
      ${msg}
      ${controls}
    </div>`;
}

function renderMentions() {
  const host = $("mentionChips");
  const people = participantList().filter(p => p.name);
  if (!people.length) { host.innerHTML = `<span class="head-hint">입장한 피클이 없습니다</span>`; return; }
  host.innerHTML = people.map(p => `
    <button class="mchip" type="button" data-name="${escapeHtml(p.name)}">
      <span class="dot-av" style="background:${escapeHtml(p.color || "#8b5cf6")}">${escapeHtml((p.consonant || "?").slice(0, 1))}</span>
      @${escapeHtml(p.name)}
    </button>`).join("");
  host.querySelectorAll(".mchip").forEach(chip => {
    chip.addEventListener("click", () => insertMention(chip.dataset.name));
  });
}

function insertMention(name) {
  const input = $("chatInput");
  const token = `@${name} `;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const pad = before && !/\s$/.test(before) ? " " : "";
  input.value = before + pad + token + after;
  const pos = (before + pad + token).length;
  input.focus();
  input.setSelectionRange(pos, pos);
}

let chatPinned = true;

function renderChat() {
  const feed = $("chatFeed");
  if (!state.messages.length) {
    feed.innerHTML = state.firstSync
      ? `<div class="chat-empty">아직 대화가 없습니다.<br>@이름 으로 첫 인사를 건네 보세요.</div>`
      : `<div class="chat-empty">대화를 불러오는 중…</div>`;
    return;
  }
  const names = participantList().map(p => p.name).filter(Boolean);
  const mePid = state.me ? state.me.pid : null;
  feed.innerHTML = state.messages.map(m => {
    const isMe = mePid && m.pid === mePid;
    return `<div class="msg${isMe ? " is-me" : ""}">
      ${avatarHTML({ color: m.color, consonant: m.consonant }, "sm")}
      <div class="msg-body">
        <div class="msg-top">
          <span class="msg-name">${escapeHtml(m.name || "익명")}</span>
          <span class="msg-time">${formatTime(m.createdAt)}</span>
        </div>
        <p class="msg-text">${linkify(m.text || "", names)}</p>
      </div>
      <div class="msg-tools">
        <button class="msg-tool" type="button" data-task="${escapeHtml(m.id)}" title="할 일 보드로 보내기">＋ 보드</button>
      </div>
    </div>`;
  }).join("");

  feed.querySelectorAll("[data-task]").forEach(btn => {
    btn.addEventListener("click", () => {
      const msg = state.messages.find(m => m.id === btn.dataset.task);
      if (!msg) return;
      const mentioned = names.find(n => (msg.text || "").includes("@" + n));
      const title = (msg.text || "").replace(/^(@\S+\s*)+/, "").trim() || msg.text;
      addTask(title, mentioned || msg.name);
    });
  });

  if (chatPinned) feed.scrollTop = feed.scrollHeight;
}

function renderAssigneeOptions() {
  const sel = $("taskAssignee");
  const people = participantList().filter(p => p.name);
  const names = people.map(p => p.name);
  const prev = sel.value;
  if (!names.length) names.push(state.me ? state.me.name : "성희");
  sel.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">@${escapeHtml(n)}</option>`).join("");
  if (names.includes(prev)) sel.value = prev;
}

function renderBoard() {
  const host = $("taskColumns");
  const counts = { todo: 0, doing: 0, done: 0 };
  state.tasks.forEach(t => { if (counts[t.status] != null) counts[t.status]++; });

  $("boardCount").textContent = state.tasks.length
    ? `${state.tasks.length}개 · 완료 ${counts.done}`
    : "0개";

  host.innerHTML = TASK_COLUMNS.map(col => {
    const items = state.tasks.filter(t => (t.status || "todo") === col.id);
    return `<div class="tcol" data-status="${col.id}">
      <div class="tcol-head">
        <span class="tcol-title">${col.title}</span>
        <span class="tcol-num">${items.length}</span>
      </div>
      <div class="tlist">
        ${items.length ? items.map(t => taskHTML(t)).join("") : `<div class="tempty">비어 있음</div>`}
      </div>
    </div>`;
  }).join("");

  host.querySelectorAll("[data-adv]").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = state.tasks.find(x => x.id === btn.dataset.adv);
      if (t) advanceTask(t);
    });
  });
  host.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const t = state.tasks.find(x => x.id === btn.dataset.del);
      if (t) deleteTask(t);
    });
  });
  host.querySelectorAll("[data-reopen]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const t = state.tasks.find(x => x.id === btn.dataset.reopen);
      if (!t) return;
      const patch = { status: "todo", updatedAt: Date.now() };
      if (state.mode === "live") await fbPatchTask(t.id, patch);
      else { LOCAL.data.tasks[t.id] = { ...LOCAL.data.tasks[t.id], ...patch }; localSave(); }
    });
  });
}

function taskHTML(t) {
  const done = t.status === "done";
  const statusLabel = { todo: "대기", doing: "진행 중", done: "완료" }[t.status || "todo"];
  return `<div class="tcard">
    <div class="tcard-top">
      <span class="tcard-title">${escapeHtml(t.title || "")}</span>
    </div>
    <div class="tcard-meta">
      <span class="tassignee">
        <span class="dot-av" style="background:${escapeHtml(t.assigneeColor || "#8b5cf6")}">${escapeHtml((t.assigneeConsonant || "?").slice(0, 1))}</span>
        @${escapeHtml(t.assignee || "미정")}
      </span>
      <span class="tcard-actions">
        ${done
          ? `<button class="ticon" type="button" data-reopen="${escapeHtml(t.id)}" title="다시 대기로" aria-label="다시 대기로">↺</button>`
          : `<button class="ticon" type="button" data-adv="${escapeHtml(t.id)}" title="${done ? "" : statusLabel + " → 다음 단계"}" aria-label="다음 단계로">▶</button>`}
        <button class="ticon del" type="button" data-del="${escapeHtml(t.id)}" title="삭제" aria-label="삭제">×</button>
      </span>
    </div>
  </div>`;
}

function renderMe() {
  const btn = $("meBtn");
  const av = $("meAvatar");
  const nm = $("meName");
  if (state.me) {
    av.textContent = (state.me.consonant || "?").slice(0, 1);
    av.style.background = state.me.color || "#8b5cf6";
    nm.textContent = state.me.name;
    btn.title = "내 프로필";
  } else {
    av.textContent = "?";
    av.style.background = "#4b5464";
    nm.textContent = "입장";
    btn.title = "쇼룸 입장";
  }
}

/* ---------------- identity ---------------- */

function persistMe() {
  try {
    if (state.me) localStorage.setItem(ME_KEY, JSON.stringify(state.me));
    else localStorage.removeItem(ME_KEY);
  } catch (e) { /* ignore */ }
}

function loadMe() {
  try {
    const raw = localStorage.getItem(ME_KEY);
    if (!raw) return null;
    const me = JSON.parse(raw);
    if (!me || !me.pid || !me.name) return null;
    return {
      pid: me.pid, name: me.name, consonant: me.consonant || "ㅅ",
      color: me.color || "#8b5cf6",
      zone: me.zone || "showroom", status: me.status || "idle", message: me.message || ""
    };
  } catch (e) { return null; }
}

/* ---------------- join modal ---------------- */

const joinDraft = { name: "성희", consonant: "ㅅ", color: PALETTE[0] };

function buildSwatches(host, selected, onPick) {
  host.innerHTML = PALETTE.map(c => `
    <button class="swatch" type="button" role="radio" aria-checked="${c === selected}"
      style="background:${c}" data-color="${c}" aria-label="색 ${c}"></button>`).join("");
  host.querySelectorAll(".swatch").forEach(sw => {
    sw.addEventListener("click", () => {
      host.querySelectorAll(".swatch").forEach(x => x.setAttribute("aria-checked", "false"));
      sw.setAttribute("aria-checked", "true");
      onPick(sw.dataset.color);
    });
  });
}

function paintJoinPreview() {
  $("joinPreview").style.setProperty("--c", joinDraft.color);
  $("joinPreview").querySelector(".consonant").textContent = (joinDraft.consonant || "?").slice(0, 2);
  $("joinPreviewText").textContent = `${joinDraft.name || "이름"} · ${joinDraft.consonant || "?"}`;
}

function openJoin(prefill) {
  const base = prefill || state.me || joinDraft;
  joinDraft.name = base.name || "성희";
  joinDraft.consonant = base.consonant || "ㅅ";
  joinDraft.color = base.color || PALETTE[0];
  $("joinName").value = joinDraft.name;
  $("joinConsonant").value = joinDraft.consonant;
  buildSwatches($("joinColors"), joinDraft.color, (c) => { joinDraft.color = c; paintJoinPreview(); });
  paintJoinPreview();
  $("joinTitle").textContent = state.me ? "내 자리 바꾸기" : "쇼룸 입장";
  $("joinSubmit").textContent = state.me ? "저장" : "입장하기";
  const dlg = $("joinModal");
  if (!dlg.open) dlg.showModal();
  setTimeout(() => $("joinName").focus(), 60);
}

async function commitJoin() {
  const name = ($("joinName").value || "").trim().slice(0, 12) || joinDraft.name;
  const consonant = ($("joinConsonant").value || "").trim().slice(0, 2) || "ㅅ";
  const prev = state.me;
  state.me = {
    pid: prev ? prev.pid : uid("p"),
    name, consonant, color: joinDraft.color,
    zone: prev ? prev.zone : "showroom",
    status: prev ? prev.status : "idle",
    message: prev ? prev.message : ""
  };
  persistMe();
  $("joinModal").close();
  renderMe(); renderZones(); renderMentions(); renderAssigneeOptions();
  await savePresence();
  toast(`${name} 님, 쇼룸에 섰습니다`);
}

/* ---------------- invite modal ---------------- */

function inviteURL() {
  const base = location.origin + location.pathname;
  return base;
}

function openInvite() {
  const url = inviteURL();
  $("inviteUrl").value = url;
  $("inviteText").value =
`안녕! 우리 피클들이 같이 쓰는 합동 쇼룸이야.

${url}

위 링크를 열고 네 이름·자음·색을 넣어 입장해 줘.
입장하면 세 구역을 오갈 수 있어.
· 🚘 메인 쇼룸 — 전시·메인 업무
· 🤝 상담 테이블 — 회의·미팅
· ☕ 고객 라운지 — 대기·모니터링

카드에서 내 상태(대기 중·작업 중·감시 중·회의 중·자리 비움)와 상태 메시지를 바꾸고,
채팅에서 "@이름 할 일" 처럼 멘션으로 서로 일을 시키면 돼.
채팅 메시지의 '＋ 보드' 를 누르면 할 일 보드로 바로 올라가.

지금은 ${ROOM_TITLE} 이야. 같이 하자!`;
  const dlg = $("inviteModal");
  if (!dlg.open) dlg.showModal();
}

/* ---------------- events ---------------- */

function wireEvents() {
  $("chatForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const input = $("chatInput");
    const text = input.value;
    if (!state.me) { openJoin(); return; }
    input.value = "";
    sendMessage(text);
  });

  $("chatInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      $("chatForm").requestSubmit();
    }
  });

  $("chatFeed").addEventListener("scroll", () => {
    const feed = $("chatFeed");
    chatPinned = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 60;
  });

  $("taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!state.me) { openJoin(); return; }
    const input = $("taskInput");
    const title = input.value;
    const assignee = $("taskAssignee").value;
    input.value = "";
    addTask(title, assignee);
  });

  $("inviteBtn").addEventListener("click", openInvite);
  $("inviteClose").addEventListener("click", () => $("inviteModal").close());

  $("meBtn").addEventListener("click", () => {
    if (!state.me) { openJoin(); return; }
    $("meNameInput").value = state.me.name;
    $("meConsonantInput").value = state.me.consonant;
    $("meModalSub").textContent = `${zoneOf(state.me.zone).name} · ${statusOf(state.me.status).label}`;
    buildSwatches($("meColors"), state.me.color, (c) => { state.me.color = c; });
    $("meModal").showModal();
  });
  $("meCancel").addEventListener("click", () => $("meModal").close());
  $("meSave").addEventListener("click", async () => {
    if (!state.me) return;
    const name = ($("meNameInput").value || "").trim().slice(0, 12) || state.me.name;
    const consonant = ($("meConsonantInput").value || "").trim().slice(0, 2) || state.me.consonant;
    state.me.name = name;
    state.me.consonant = consonant;
    persistMe();
    $("meModal").close();
    renderMe(); renderZones(); renderMentions();
    await savePresence();
    toast("프로필을 저장했습니다");
  });

  $("leaveBtn").addEventListener("click", async () => {
    if (!state.me) return;
    const pid = state.me.pid;
    if (state.mode === "live") await fbRemovePresence(pid);
    else if (LOCAL.data) { delete LOCAL.data.presence[pid]; localSave(); }
    state.me = null;
    persistMe();
    $("meModal").close();
    renderMe(); renderZones(); renderMentions(); renderAssigneeOptions();
    toast("쇼룸에서 나왔습니다");
  });

  $("joinForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    await commitJoin();
  });
  $("joinName").addEventListener("input", () => {
    joinDraft.name = $("joinName").value.trim();
    paintJoinPreview();
  });
  $("joinConsonant").addEventListener("input", () => {
    joinDraft.consonant = $("joinConsonant").value.trim();
    paintJoinPreview();
  });
  $("joinCancel").addEventListener("click", () => {
    $("joinModal").close();
    if (!state.me) {
      // stay as a reader; the join button reopens this dialog
      renderMe();
    }
  });

  document.querySelectorAll("[data-copy]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const target = $(btn.dataset.copy);
      const ok = await copyText(target.value);
      toast(ok ? "복사했습니다" : "복사하지 못했어요. 직접 선택해 주세요");
    });
  });

  $("inviteUrl").addEventListener("focus", (e) => e.target.select());
  $("inviteText").addEventListener("focus", (e) => e.target.select());

  // Enter로 모달이 닫히지 않게 (dialog 기본 동작 방지)
  document.querySelectorAll("dialog").forEach(d => {
    d.addEventListener("keydown", (e) => {
      if (e.key === "Escape") return;
    });
  });
}

/* ---------------- boot ---------------- */

function renderAll() {
  renderMe(); renderZones(); renderChat(); renderBoard(); renderMentions(); renderAssigneeOptions();
  paintConn();
}

async function boot() {
  wireEvents();
  state.me = loadMe();
  renderAll();

  try {
    await connectFirebase();
    state.mode = "live";
    await fbStart();
    paintConn();
    if (state.me) {
      // re-assert presence once connected
      fbPatchPresence();
    }
  } catch (e) {
    console.warn("Firebase unavailable, using local mode", e);
    startLocal(e && e.message);
  }

  if (!state.me) openJoin();
}

boot();
