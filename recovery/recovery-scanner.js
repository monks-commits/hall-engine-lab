"use strict";

let qr = null;
let cameraStarting = false;
let cameraRunning = false;
let lastToken = "";
let lastScanAt = 0;
let scanLocked = false;

const RECOVERY_SCAN_PARAMS = new URLSearchParams(location.search);
const URL_SEANCE_ID = RECOVERY_SCAN_PARAMS.get("seance") || RECOVERY_SCAN_PARAMS.get("seance_id") || "";
const RECOVERY_TEST_MODE = RECOVERY_SCAN_PARAMS.get("test") === "1";
const CHECK_ONLY_VALUE = "__check_only__";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const SEANCES = new Map();

const CAMERA_CHANNEL_NAME = "va-recovery-camera-v1";
const CAMERA_STORAGE_KEY = "va_recovery_camera_request_v1";
const SELECTED_MODE_STORAGE_KEY = "va_recovery_selected_mode_v1";
const PAGE_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let cameraChannel = null;

try {
  if ("BroadcastChannel" in window) {
    cameraChannel = new BroadcastChannel(CAMERA_CHANNEL_NAME);
    cameraChannel.addEventListener("message", (event) => {
      const data = event.data || {};
      if (data.type === "release-camera" && data.pageId !== PAGE_ID) emergencyReleaseCamera();
    });
  }
} catch(e) { console.warn("BroadcastChannel init error", e); }

window.addEventListener("storage", (event) => {
  if (event.key === CAMERA_STORAGE_KEY && event.newValue) emergencyReleaseCamera();
});

let audioCtx = null;
function initAudio(){
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
  } catch(e) { console.warn("audio init error", e); }
}

function playScanSound(type){
  try {
    initAudio();
    if (!audioCtx) return;
    const beep = (freq, start, duration, volume = 0.18) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = audioCtx.currentTime + start;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(t); osc.stop(t + duration + 0.03);
    };
    if (type === "success") { beep(900,0,.12); beep(1200,.16,.12); return; }
    if (type === "used") { beep(260,0,.45,.22); return; }
    beep(320,0,.12); beep(220,.16,.12);
  } catch(e) { console.warn("scan sound error", e); }
}

function setStatus(kind,title,details,token){
  const box = $("status");
  box.classList.remove("ok","bad","warn");
  if (kind) box.classList.add(kind);
  $("statusTitle").textContent = title || "";
  $("statusDetails").textContent = details || "";
  $("tokenText").textContent = token || "—";
}

function scannerSecret(){
  if (typeof RECOVERY_SCANNER_SECRET !== "undefined" && RECOVERY_SCANNER_SECRET) return RECOVERY_SCANNER_SECRET;
  return $("secret").value.trim();
}

function localDateLabel(value){
  const raw = String(value || "").trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : raw;
}

function seanceLabel(s){
  return [s?.show || "Без назви", localDateLabel(s?.date), String(s?.time || "").slice(0,5), s?.venue_id || ""].filter(Boolean).join(" • ");
}

function selectedModeValue(){ return String($("targetSeance").value || "").trim(); }
function isCheckOnlyMode(){ return selectedModeValue() === CHECK_ONLY_VALUE; }
function selectedSeanceId(){
  const value = selectedModeValue();
  return (!value || value === CHECK_ONLY_VALUE) ? "" : value;
}
function selectedSeanceLabel(){
  const id = selectedSeanceId();
  if (!id) return "";
  const row = SEANCES.get(id);
  return row ? seanceLabel(row) : id;
}

function storedModeValue(){
  try {
    return String(
      localStorage.getItem(SELECTED_MODE_STORAGE_KEY) || ""
    ).trim();
  } catch {
    return "";
  }
}

function rememberSelectedMode(){
  const value = selectedModeValue();

  try {
    if (value) {
      localStorage.setItem(SELECTED_MODE_STORAGE_KEY, value);
    } else {
      localStorage.removeItem(SELECTED_MODE_STORAGE_KEY);
    }
  } catch {}
}

function refreshModeUi(){
  const value = selectedModeValue();
  $("btnStart").disabled = !value || cameraStarting || cameraRunning;
  if (!value) {
    $("modeHint").textContent = "Оберіть конкретний сеанс погашення або режим перевірки без погашення.";
    setStatus("warn","Оберіть режим","Камера стане доступною після вибору.","");
    return;
  }
  if (isCheckOnlyMode()) {
    $("modeHint").textContent = "Камера працюватиме для пошуку й перевірки квитка. Компенсацію не буде погашено.";
    setStatus("warn","Режим перевірки","Квиток можна перевірити або підготувати до активації без фіксації проходу.","");
    return;
  }
  const label = selectedSeanceLabel();
  $("modeHint").textContent = `Компенсаційний прохід буде погашено на сеансі: ${label}`;
  setStatus("","Сеанс обрано",`Погашення буде зафіксовано на: ${label}`,"");
}

async function loadSeances(){
  const select = $("targetSeance");
  select.disabled = true;
  $("btnStart").disabled = true;
  try {
    if (typeof RECOVERY_SUPABASE_URL === "undefined" || typeof RECOVERY_SUPABASE_KEY === "undefined") {
      throw new Error("RECOVERY_SUPABASE_URL або RECOVERY_SUPABASE_KEY не задано.");
    }
    const query = "?select=id,show,date,time,venue_id,status,active,archived&order=date.asc&order=time.asc";
    const res = await fetch(`${RECOVERY_SUPABASE_URL}/rest/v1/seances${query}`, {
      headers:{apikey:RECOVERY_SUPABASE_KEY, Authorization:`Bearer ${RECOVERY_SUPABASE_KEY}`}, cache:"no-store"
    });
    if (!res.ok) throw new Error(await res.text());
    const rows = await res.json();
    const available = (Array.isArray(rows) ? rows : []).filter(row => row.archived !== true && row.active !== false);
    SEANCES.clear();
    select.innerHTML = "";
    select.add(new Option("Оберіть режим або сеанс", ""));
    select.add(new Option("Лише перевірка — без погашення", CHECK_ONLY_VALUE));
    available.forEach(row => {
      const id = String(row.id || "").trim();
      if (!id) return;
      SEANCES.set(id, row);
      select.add(new Option(seanceLabel(row), id));
    });
    const rememberedValue = storedModeValue();

    if (URL_SEANCE_ID) {
      if (!SEANCES.has(URL_SEANCE_ID)) {
        select.add(
          new Option(
            `Сеанс із посилання: ${URL_SEANCE_ID}`,
            URL_SEANCE_ID
          )
        );
      }

      select.value = URL_SEANCE_ID;
      rememberSelectedMode();
    } else if (
      rememberedValue === CHECK_ONLY_VALUE ||
      SEANCES.has(rememberedValue)
    ) {
      select.value = rememberedValue;
    } else {
      select.value = "";

      if (rememberedValue) {
        try {
          localStorage.removeItem(SELECTED_MODE_STORAGE_KEY);
        } catch {}
      }
    }

    select.disabled = false;
    refreshModeUi();
  } catch(e) {
    console.error("loadSeances error", e);
    select.innerHTML = '<option value="">Помилка завантаження</option>';
    select.disabled = true;
    $("btnStart").disabled = true;
    setStatus("bad","Не вдалося завантажити сеанси",String(e?.message || e),"");
  }
}

async function sendToken(token){
  const secret = scannerSecret();
  const scanned_by = $("gate").value.trim() || "recovery-gate";
  const endpoint = typeof RECOVERY_SCAN_ENDPOINT !== "undefined" ? RECOVERY_SCAN_ENDPOINT : "";
  const scanSeanceId = selectedSeanceId();
  if (!endpoint) { playScanSound("error"); setStatus("bad","Помилка","RECOVERY_SCAN_ENDPOINT не задано.",token); return; }

  const res = await fetch(endpoint, {
    method:"POST",
    headers:{"Content-Type":"application/json","x-scanner-secret":secret},
    body:JSON.stringify({token, scanned_by, scan_seance_id:scanSeanceId || null})
  });
  const data = await res.json().catch(() => ({}));
  const ticket = data.ticket || {};
  const sourceValue = ticket.source_seance_label || ticket.source_seance_id || "";
  const usedValue = ticket.used_seance_label || ticket.used_seance_id || selectedSeanceLabel() || "";
  const sourceLine = sourceValue ? `Компенсація від: ${sourceValue}` : "";
  const usedLine = usedValue ? `Погашено на: ${usedValue}` : "";
  const oldSeatLine = ticket.source_seat_label ? `Старе місце: ${ticket.source_seat_label}` : "";
  const viewerLine = ticket.owner_name ? `Глядач: ${ticket.owner_name}` : "";

  if (res.status === 401) { playScanSound("error"); setStatus("bad","Доступ заборонено","Невірний scanner secret.",token); return; }
  if (res.status === 404) { playScanSound("error"); setStatus("bad","Квиток не знайдено","Цього квитка немає у compensation pool.",token); return; }
  if (res.status === 400 && data.error === "scan_seance_id_required" && isCheckOnlyMode()) {
    playScanSound("success");
    setStatus("warn","Квиток активований",["Режим перевірки: компенсацію не погашено.",viewerLine,sourceLine,oldSeatLine].filter(Boolean).join(" • "),token);
    return;
  }
  if (res.status === 409 || data.error === "already_used") {
    playScanSound(data.error === "duplicate_token" ? "error" : "used");
    setStatus(
      data.error === "duplicate_token" ? "bad" : "warn",
      data.error === "duplicate_token" ? "Дублікат токена" : "Вже використано",
      data.error === "duplicate_token" ? "У recovery_tokens знайдено кілька однакових token." : ["Компенсаційний прохід уже був зафіксований.",viewerLine,sourceLine,usedLine,oldSeatLine].filter(Boolean).join(" • "),
      token
    );
    return;
  }
  if (!res.ok || data.ok === false) { playScanSound("error"); setStatus("bad","Помилка",data.message || data.error || `HTTP ${res.status}`,token); return; }
  playScanSound("success");
  setStatus("ok","КОМПЕНСАЦІЮ ПІДТВЕРДЖЕНО",[viewerLine,sourceLine,usedLine,oldSeatLine].filter(Boolean).join(" • ") || "Компенсаційний прохід дозволено.",token);
}

function normalizeToken(text){ return String(text || "").trim(); }
async function onScanSuccess(decodedText){
  if (scanLocked) return;

  const now = Date.now();
  const token = normalizeToken(decodedText);

  if (!token) return;

  /*
    Один и тот же QR не принимаем повторно 8 секунд,
    но другой билет можно сканировать почти сразу.
  */
  if (
    token === lastToken &&
    now - lastScanAt < 8000
  ) {
    return;
  }

  scanLocked = true;
  lastToken = token;
  lastScanAt = now;

  try {
    await sendToken(token);
  } finally {
    /*
      Камера не останавливается. Через короткую паузу
      сканер готов к следующему посетителю.
    */
    setTimeout(() => {
      scanLocked = false;
    }, 900);
  }
}

function stopVisibleVideoTracks(){
  document.querySelectorAll("#reader video").forEach(video => {
    try {
      const stream = video.srcObject;
      if (stream && typeof stream.getTracks === "function") stream.getTracks().forEach(track => { try { track.stop(); } catch {} });
      video.srcObject = null;
    } catch(e) { console.warn("video track cleanup error", e); }
  });
}

async function releaseCamera(options = {}){
  const {showStatus = false, preserveButtons = false} = options;
  stopVisibleVideoTracks();
  const instance = qr; qr = null;
  cameraStarting = false; cameraRunning = false; scanLocked = false;
  if (instance) { try { await instance.stop(); } catch {} try { await instance.clear(); } catch {} }
  stopVisibleVideoTracks();
  const reader = $("reader"); if (reader) reader.innerHTML = "";
  $("targetSeance").disabled = false;
  if (!preserveButtons) { $("btnStop").disabled = true; refreshModeUi(); }
  if (showStatus) setStatus("","Камеру зупинено","Можна змінити режим або сеанс і запустити камеру повторно.","");
}

function emergencyReleaseCamera(){
  stopVisibleVideoTracks();
  releaseCamera({showStatus:false,preserveButtons:false}).catch(() => {});
}

async function askOtherRecoveryTabsToReleaseCamera(){
  try { cameraChannel?.postMessage({type:"release-camera",pageId:PAGE_ID,at:Date.now()}); } catch {}
  try { localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify({pageId:PAGE_ID,at:Date.now()})); } catch {}
  await sleep(350);
}

function waitForVideoFrame(timeoutMs = 8000){
  return new Promise((resolve,reject) => {
    const started = Date.now();
    const check = () => {
      const video = document.querySelector("#reader video");
      if (video && video.srcObject && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) { resolve(video); return; }
      if (Date.now() - started >= timeoutMs) { reject(new Error("Камера відкрилася, але відеокадр не з'явився. Потік звільнено — натисніть «Запустити камеру» повторно.")); return; }
      requestAnimationFrame(check);
    };
    check();
  });
}

async function startScanner(){
  if (cameraStarting || cameraRunning) return;
  if (!selectedModeValue()) { setStatus("warn","Оберіть режим","Спочатку оберіть сеанс погашення або режим перевірки.",""); return; }
  cameraStarting = true;
  $("btnStart").disabled = true; $("btnStop").disabled = true; $("targetSeance").disabled = true;
  initAudio();
  try {
    await askOtherRecoveryTabsToReleaseCamera();
    await releaseCamera({showStatus:false,preserveButtons:true});
    $("targetSeance").disabled = true;
    await sleep(250);
    qr = new Html5Qrcode("reader", {verbose:false});
    await qr.start(
      {facingMode:"environment"},
      {fps:10, qrbox:(viewWidth,viewHeight) => { const edge = Math.max(180, Math.min(280, Math.floor(Math.min(viewWidth,viewHeight)*.72))); return {width:edge,height:edge}; }, disableFlip:false},
      onScanSuccess,
      () => {}
    );
    const video = await waitForVideoFrame();
    video.setAttribute("playsinline",""); video.setAttribute("autoplay",""); video.muted = true;
    try { await video.play(); } catch {}
    cameraStarting = false; cameraRunning = true;
    $("btnStart").disabled = true; $("btnStop").disabled = false; $("targetSeance").disabled = true;
    const modeLine = RECOVERY_TEST_MODE ? "ТЕСТ • " : "";
    setStatus(isCheckOnlyMode() ? "warn" : "", "Камера працює", isCheckOnlyMode() ? `${modeLine}Перевірка без погашення.` : `${modeLine}Погашення на: ${selectedSeanceLabel()}`, "");
  } catch(e) {
    await releaseCamera({showStatus:false,preserveButtons:false});
    setStatus("bad","Помилка камери",String(e?.message || e),"");
  }
}

async function stopScanner(){ await releaseCamera({showStatus:true,preserveButtons:false}); }

window.addEventListener("load", async () => {
  $("btnStart").addEventListener("click", startScanner);
  $("btnStop").addEventListener("click", stopScanner);
  $("targetSeance").addEventListener("change", () => {
    rememberSelectedMode();
    refreshModeUi();
  });

  await loadSeances();
});

window.addEventListener("pagehide", emergencyReleaseCamera);
window.addEventListener("beforeunload", emergencyReleaseCamera);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (cameraRunning || cameraStarting)) emergencyReleaseCamera();
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    emergencyReleaseCamera();
    setStatus("warn","Камеру було звільнено","Оберіть режим і запустіть камеру повторно.","");
  }
});
