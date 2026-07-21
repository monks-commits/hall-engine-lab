"use strict";

let qr = null;
let scannerStarting = false;
let scannerRunning = false;
let scanLocked = false;

let lastToken = "";
let lastScanAt = 0;

const PARAMS = new URLSearchParams(location.search);
const REQUESTED_SEANCE_ID =
  PARAMS.get("seance") ||
  PARAMS.get("seance_id") ||
  "";

const RECOVERY_TEST_MODE = PARAMS.get("test") === "1";
const LAUNCH_TS = Number(PARAMS.get("launch_ts") || 0);
const LAUNCH_MAX_AGE_MS = 10 * 60 * 1000;

let RECOVERY_SCAN_SEANCE_ID = "";
let RECOVERY_SCAN_SEANCE = null;

const $ = id => document.getElementById(id);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let audioCtx = null;

function initAudio(){
  try {
    audioCtx =
      audioCtx ||
      new (window.AudioContext || window.webkitAudioContext)();

    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
  } catch(e) {
    console.warn("audio init error", e);
  }
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

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start(t);
      osc.stop(t + duration + 0.03);
    };

    if (type === "success") {
      beep(900, 0, 0.12);
      beep(1200, 0.16, 0.12);
      return;
    }

    if (type === "used") {
      beep(260, 0, 0.45, 0.22);
      return;
    }

    beep(320, 0, 0.12);
    beep(220, 0.16, 0.12);
  } catch(e) {
    console.warn("scan sound error", e);
  }
}

function setStatus(kind, title, details, token){
  const box = $("status");
  box.classList.remove("ok","bad","warn");
  if (kind) box.classList.add(kind);

  $("statusTitle").textContent = title || "";
  $("statusDetails").textContent = details || "";
  $("tokenText").textContent = token || "—";
}

function localDateKey(date = new Date()){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function seanceDateTime(s){
  const date = String(s?.date || "").trim();
  const time = String(s?.time || "00:00").slice(0,5);
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function seanceText(s){
  if (!s) return "";
  return [
    s.show || "",
    s.date || "",
    s.time || "",
    s.venue_id || ""
  ].filter(Boolean).join(" • ");
}

async function loadSeances(){
  const url =
    `${RECOVERY_SUPABASE_URL}/rest/v1/seances` +
    `?select=id,show,date,time,venue_id,active,archived` +
    `&order=date.asc,time.asc`;

  const res = await fetch(url, {
    headers:{
      apikey:RECOVERY_SUPABASE_KEY,
      Authorization:`Bearer ${RECOVERY_SUPABASE_KEY}`
    },
    cache:"no-store"
  });

  if (!res.ok) throw new Error(await res.text());

  const rows = await res.json();

  return (Array.isArray(rows) ? rows : [])
    .filter(s => s.archived !== true && s.active !== false);
}

async function resolveScanSeance(){
  const rows = await loadSeances();
  const now = new Date();

  const requested = rows.find(
    s => String(s.id) === String(REQUESTED_SEANCE_ID)
  ) || null;

  /*
    Тестовый сеанс принимается только по свежей ссылке из gate-control.
    Старый адрес из истории браузера (например Дон Жуан) отвергается.
  */
  if (RECOVERY_TEST_MODE) {
    const freshLaunch =
      Number.isFinite(LAUNCH_TS) &&
      LAUNCH_TS > 0 &&
      Math.abs(Date.now() - LAUNCH_TS) <= LAUNCH_MAX_AGE_MS;

    if (requested && freshLaunch) {
      RECOVERY_SCAN_SEANCE = requested;
      RECOVERY_SCAN_SEANCE_ID = String(requested.id);
      return requested;
    }

    throw new Error(
      "Тестовий сеанс не передано або посилання застаріло. Поверніться у «Вхідний контроль», оберіть сеанс і відкрийте Recovery знову."
    );
  }

  const today = localDateKey(now);

  const currentMatches = rows
    .filter(s => String(s.date || "") === today)
    .map(s => {
      const dt = seanceDateTime(s);
      const diffMin = dt
        ? Math.round((dt.getTime() - now.getTime()) / 60000)
        : 999999;

      return {
        seance:s,
        diffMin,
        abs:Math.abs(diffMin)
      };
    })
    .filter(x => x.diffMin <= 120 && x.diffMin >= -240)
    .sort((a,b) => a.abs - b.abs);

  /*
    Переданный gate-control сеанс используется только если он действительно
    находится в текущем рабочем окне.
  */
  if (requested) {
    const validRequested = currentMatches.find(
      x => String(x.seance.id) === String(requested.id)
    );

    if (validRequested) {
      RECOVERY_SCAN_SEANCE = validRequested.seance;
      RECOVERY_SCAN_SEANCE_ID = String(validRequested.seance.id);
      return validRequested.seance;
    }
  }

  if (currentMatches.length) {
    RECOVERY_SCAN_SEANCE = currentMatches[0].seance;
    RECOVERY_SCAN_SEANCE_ID = String(currentMatches[0].seance.id);
    return currentMatches[0].seance;
  }

  throw new Error("Зараз немає поточного сеансу у робочому вікні входу.");
}

function scannerSecret(){
  if (
    typeof RECOVERY_SCANNER_SECRET !== "undefined" &&
    RECOVERY_SCANNER_SECRET
  ) {
    return RECOVERY_SCANNER_SECRET;
  }

  return $("secret").value.trim();
}

async function sendToken(token){
  if (!RECOVERY_SCAN_SEANCE_ID) {
    playScanSound("error");
    setStatus(
      "bad",
      "Сеанс не визначено",
      "Компенсаційний прохід не може бути погашено без поточного сеансу.",
      token
    );
    return;
  }

  const secret = scannerSecret();
  const scanned_by = $("gate").value.trim() || "recovery-gate";

  const endpoint =
    typeof RECOVERY_SCAN_ENDPOINT !== "undefined"
      ? RECOVERY_SCAN_ENDPOINT
      : "";

  if (!endpoint) {
    playScanSound("error");
    setStatus("bad", "Помилка", "RECOVERY_SCAN_ENDPOINT не задано.", token);
    return;
  }

  const res = await fetch(endpoint, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-scanner-secret":secret
    },
    body:JSON.stringify({
      token,
      scanned_by,
      scan_seance_id:RECOVERY_SCAN_SEANCE_ID
    })
  });

  const data = await res.json().catch(() => ({}));
  const ticket = data.ticket || {};

  const sourceLine = ticket.source_seance_id
    ? `Компенсація від: ${ticket.source_seance_id}`
    : "";

  const usedLine = ticket.used_seance_id
    ? `Погашено на: ${ticket.used_seance_id}`
    : `Погашено на: ${RECOVERY_SCAN_SEANCE_ID}`;

  const oldSeatLine = ticket.source_seat_label
    ? `Старе місце: ${ticket.source_seat_label}`
    : "";

  const viewerLine = ticket.owner_name
    ? `Глядач: ${ticket.owner_name}`
    : "";

  if (res.status === 401) {
    playScanSound("error");
    setStatus("bad", "Доступ заборонено", "Невірний scanner secret.", token);
    return;
  }

  if (res.status === 404) {
    playScanSound("error");
    setStatus(
      "bad",
      "Квиток не знайдено",
      "Цього квитка немає у compensation pool.",
      token
    );
    return;
  }

  if (res.status === 409 || data.error === "already_used") {
    playScanSound(data.error === "duplicate_token" ? "error" : "used");

    setStatus(
      data.error === "duplicate_token" ? "bad" : "warn",
      data.error === "duplicate_token"
        ? "Дублікат токена"
        : "Вже використано",
      data.error === "duplicate_token"
        ? "У recovery_tokens знайдено кілька однакових token."
        : [
            "Компенсаційний прохід уже був зафіксований.",
            viewerLine,
            sourceLine,
            usedLine,
            oldSeatLine
          ].filter(Boolean).join(" • "),
      token
    );
    return;
  }

  if (!res.ok || data.ok === false) {
    playScanSound("error");
    setStatus("bad", "Помилка", data.error || `HTTP ${res.status}`, token);
    return;
  }

  playScanSound("success");

  setStatus(
    "ok",
    "КОМПЕНСАЦІЮ ПІДТВЕРДЖЕНО",
    [
      viewerLine,
      sourceLine,
      usedLine,
      oldSeatLine
    ].filter(Boolean).join(" • ") || "Компенсаційний прохід дозволено.",
    token
  );
}

function normalizeToken(text){
  return String(text || "").trim();
}

async function onScanSuccess(decodedText){
  if (scanLocked) return;

  const now = Date.now();
  const token = normalizeToken(decodedText);

  if (!token) return;
  if (token === lastToken && now - lastScanAt < 8000) return;

  scanLocked = true;
  lastToken = token;
  lastScanAt = now;

  try {
    await sendToken(token);
  } finally {
    setTimeout(() => {
      scanLocked = false;
    }, 8000);
  }
}

function stopVideoTracks(){
  document.querySelectorAll("video").forEach(video => {
    try {
      const stream = video.srcObject;
      if (stream && typeof stream.getTracks === "function") {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch {}
        });
      }
      video.srcObject = null;
    } catch {}
  });
}

async function releaseCamera({ showStatus = false } = {}){
  stopVideoTracks();

  const instance = qr;
  qr = null;
  scannerRunning = false;
  scannerStarting = false;

  if (instance) {
    try { await instance.stop(); } catch {}
    try { await instance.clear(); } catch {}
  }

  stopVideoTracks();

  const reader = $("reader");
  if (reader) reader.innerHTML = "";

  $("btnStart").disabled = !RECOVERY_SCAN_SEANCE_ID;
  $("btnStop").disabled = true;

  if (showStatus) {
    setStatus("", "Камеру звільнено", "Можна запустити повторно.", "");
  }
}

function chooseRearCamera(cameras){
  if (!Array.isArray(cameras) || !cameras.length) return null;

  const rearPattern =
    /(back|rear|environment|задн|основн|camera 0)/i;

  return (
    cameras.find(c => rearPattern.test(String(c.label || ""))) ||
    cameras[cameras.length - 1]
  );
}

function waitForVideoFrame(timeoutMs = 7000){
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const check = () => {
      const video = document.querySelector("#reader video");

      if (
        video &&
        video.srcObject &&
        video.readyState >= 2 &&
        video.videoWidth > 0 &&
        video.videoHeight > 0
      ) {
        resolve(video);
        return;
      }

      if (Date.now() - started >= timeoutMs) {
        reject(new Error(
          "Відеокадр не з'явився. Камеру звільнено; натисніть «Запустити камеру» повторно."
        ));
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
}

async function startQrEngine(){
  const scanConfig = {
    fps:10,
    qrbox:(viewWidth, viewHeight) => {
      const edge = Math.max(
        180,
        Math.min(280, Math.floor(Math.min(viewWidth, viewHeight) * 0.72))
      );
      return { width:edge, height:edge };
    },
    disableFlip:false
  };

  let instance = new Html5Qrcode("reader", { verbose:false });

  try {
    await instance.start(
      { facingMode:{ ideal:"environment" } },
      scanConfig,
      onScanSuccess,
      () => {}
    );
    return instance;
  } catch(firstError) {
    try { await instance.clear(); } catch {}
    stopVideoTracks();
    await sleep(350);

    const cameras = await Html5Qrcode.getCameras();
    const rear = chooseRearCamera(cameras);

    if (!rear?.id) throw firstError;

    instance = new Html5Qrcode("reader", { verbose:false });

    await instance.start(
      rear.id,
      scanConfig,
      onScanSuccess,
      () => {}
    );

    return instance;
  }
}

async function startScanner(){
  if (scannerStarting || scannerRunning) return;

  if (!RECOVERY_SCAN_SEANCE_ID) {
    setStatus(
      "bad",
      "Сеанс не визначено",
      "Поверніться у «Вхідний контроль» і відкрийте Recovery повторно.",
      ""
    );
    return;
  }

  scannerStarting = true;
  $("btnStart").disabled = true;
  $("btnStop").disabled = true;

  initAudio();

  try {
    await releaseCamera();
    await sleep(350);

    scannerStarting = true;
    $("btnStart").disabled = true;

    qr = await startQrEngine();

    const video = await waitForVideoFrame();

    video.setAttribute("playsinline", "");
    video.muted = true;

    try { await video.play(); } catch {}

    scannerRunning = true;
    scannerStarting = false;

    $("btnStop").disabled = false;

    setStatus(
      "",
      "Камера працює",
      `${RECOVERY_TEST_MODE ? "ТЕСТ • " : ""}${seanceText(RECOVERY_SCAN_SEANCE)}`,
      ""
    );

  } catch(e){
    await releaseCamera();

    setStatus(
      "bad",
      "Помилка камери",
      String(e?.message || e),
      ""
    );
  }
}

async function stopScanner(){
  await releaseCamera({ showStatus:true });
}

function emergencyRelease(){
  stopVideoTracks();
  releaseCamera().catch(() => {});
}

window.addEventListener("load", async () => {
  $("btnStart").disabled = true;
  $("btnStop").disabled = true;

  $("btnStart").addEventListener("click", startScanner);
  $("btnStop").addEventListener("click", stopScanner);

  try {
    const s = await resolveScanSeance();

    $("btnStart").disabled = false;

    setStatus(
      RECOVERY_TEST_MODE ? "warn" : "",
      RECOVERY_TEST_MODE ? "Тестовий сканер готовий" : "Сканер готовий",
      `Погашення буде зафіксовано на: ${seanceText(s)}`,
      ""
    );

  } catch(e) {
    RECOVERY_SCAN_SEANCE = null;
    RECOVERY_SCAN_SEANCE_ID = "";
    $("btnStart").disabled = true;

    setStatus(
      "bad",
      "Сеанс не визначено",
      String(e?.message || e),
      ""
    );
  }
});

window.addEventListener("pagehide", emergencyRelease);
window.addEventListener("beforeunload", emergencyRelease);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && (scannerRunning || scannerStarting)) {
    emergencyRelease();
  }
});

window.addEventListener("pageshow", event => {
  if (event.persisted) {
    emergencyRelease();

    setStatus(
      "warn",
      "Камеру було звільнено",
      "Після повернення на сторінку відкрийте Recovery з «Вхідного контролю» повторно.",
      ""
    );
  }
});
