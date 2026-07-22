"use strict";

let qr = null;
let cameraStarting = false;
let cameraRunning = false;

let lastToken = "";
let lastScanAt = 0;
let scanLocked = false;

const RECOVERY_SCAN_PARAMS = new URLSearchParams(location.search);

const RECOVERY_SCAN_SEANCE_ID =
  RECOVERY_SCAN_PARAMS.get("seance") ||
  RECOVERY_SCAN_PARAMS.get("seance_id") ||
  "";

const RECOVERY_TEST_MODE =
  RECOVERY_SCAN_PARAMS.get("test") === "1";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const CAMERA_CHANNEL_NAME = "va-recovery-camera-v1";
const CAMERA_STORAGE_KEY = "va_recovery_camera_request_v1";
const PAGE_ID = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

let cameraChannel = null;

try {
  if ("BroadcastChannel" in window) {
    cameraChannel = new BroadcastChannel(CAMERA_CHANNEL_NAME);

    cameraChannel.addEventListener("message", (event) => {
      const data = event.data || {};

      if (
        data.type === "release-camera" &&
        data.pageId !== PAGE_ID
      ) {
        emergencyReleaseCamera();
      }
    });
  }
} catch(e) {
  console.warn("BroadcastChannel init error", e);
}

window.addEventListener("storage", (event) => {
  if (
    event.key === CAMERA_STORAGE_KEY &&
    event.newValue
  ) {
    emergencyReleaseCamera();
  }
});

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

  const sourceValue =
    ticket.source_seance_label ||
    ticket.source_seance_id ||
    "";

  const usedValue =
    ticket.used_seance_label ||
    ticket.used_seance_id ||
    RECOVERY_SCAN_SEANCE_ID ||
    "";

  const sourceLine = sourceValue
    ? `Компенсація від: ${sourceValue}`
    : "";

  const usedLine = usedValue
    ? `Погашено на: ${usedValue}`
    : "";

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
      data.error === "duplicate_token" ? "Дублікат токена" : "Вже використано",
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
    setStatus(
      "bad",
      "Помилка",
      data.message || data.error || `HTTP ${res.status}`,
      token
    );
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

  if (token === lastToken && now - lastScanAt < 8000) {
    return;
  }

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

function stopVisibleVideoTracks(){
  document.querySelectorAll("#reader video").forEach(video => {
    try {
      const stream = video.srcObject;

      if (stream && typeof stream.getTracks === "function") {
        stream.getTracks().forEach(track => {
          try { track.stop(); } catch {}
        });
      }

      video.srcObject = null;
    } catch(e) {
      console.warn("video track cleanup error", e);
    }
  });
}

async function releaseCamera(options = {}){
  const {
    showStatus = false,
    preserveButtons = false
  } = options;

  stopVisibleVideoTracks();

  const instance = qr;
  qr = null;

  cameraStarting = false;
  cameraRunning = false;
  scanLocked = false;

  if (instance) {
    try { await instance.stop(); } catch {}
    try { await instance.clear(); } catch {}
  }

  stopVisibleVideoTracks();

  const reader = $("reader");
  if (reader) reader.innerHTML = "";

  if (!preserveButtons) {
    $("btnStart").disabled = false;
    $("btnStop").disabled = true;
  }

  if (showStatus) {
    setStatus("", "Камеру зупинено", "Можна запустити повторно.", "");
  }
}

function emergencyReleaseCamera(){
  stopVisibleVideoTracks();

  releaseCamera({
    showStatus:false,
    preserveButtons:false
  }).catch(() => {});
}

async function askOtherRecoveryTabsToReleaseCamera(){
  try {
    cameraChannel?.postMessage({
      type:"release-camera",
      pageId:PAGE_ID,
      at:Date.now()
    });
  } catch {}

  try {
    localStorage.setItem(
      CAMERA_STORAGE_KEY,
      JSON.stringify({
        pageId:PAGE_ID,
        at:Date.now()
      })
    );
  } catch {}

  await sleep(350);
}

function waitForVideoFrame(timeoutMs = 8000){
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
        reject(
          new Error(
            "Камера відкрилася, але відеокадр не з'явився. " +
            "Потік звільнено — натисніть «Запустити камеру» повторно."
          )
        );
        return;
      }

      requestAnimationFrame(check);
    };

    check();
  });
}

async function startScanner(){
  if (cameraStarting || cameraRunning) return;

  cameraStarting = true;

  $("btnStart").disabled = true;
  $("btnStop").disabled = true;

  initAudio();

  try {
    await askOtherRecoveryTabsToReleaseCamera();
    await releaseCamera({
      showStatus:false,
      preserveButtons:true
    });

    await sleep(250);

    qr = new Html5Qrcode("reader", { verbose:false });

    await qr.start(
      { facingMode:"environment" },
      {
        fps:10,
        qrbox:(viewWidth, viewHeight) => {
          const edge = Math.max(
            180,
            Math.min(
              280,
              Math.floor(Math.min(viewWidth, viewHeight) * 0.72)
            )
          );

          return { width:edge, height:edge };
        },
        disableFlip:false
      },
      onScanSuccess,
      () => {}
    );

    const video = await waitForVideoFrame();

    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.muted = true;

    try { await video.play(); } catch {}

    cameraStarting = false;
    cameraRunning = true;

    $("btnStart").disabled = true;
    $("btnStop").disabled = false;

    const modeLine = RECOVERY_TEST_MODE ? "ТЕСТ • " : "";

    setStatus(
      RECOVERY_TEST_MODE ? "warn" : "",
      "Камера працює",
      RECOVERY_SCAN_SEANCE_ID
        ? `${modeLine}Сканування на сеансі: ${RECOVERY_SCAN_SEANCE_ID}`
        : `${modeLine}Скануйте QR або штрихкод компенсаційного квитка.`,
      ""
    );
  } catch(e) {
    await releaseCamera({
      showStatus:false,
      preserveButtons:false
    });

    setStatus(
      "bad",
      "Помилка камери",
      String(e?.message || e),
      ""
    );
  }
}

async function stopScanner(){
  await releaseCamera({
    showStatus:true,
    preserveButtons:false
  });
}

window.addEventListener("load", () => {
  $("btnStart").addEventListener("click", startScanner);
  $("btnStop").addEventListener("click", stopScanner);

  if (RECOVERY_SCAN_SEANCE_ID) {
    setStatus(
      RECOVERY_TEST_MODE ? "warn" : "",
      RECOVERY_TEST_MODE ? "Тестовий сканер готовий" : "Сканер готовий",
      `Погашення буде зафіксовано на сеансі: ${RECOVERY_SCAN_SEANCE_ID}`,
      ""
    );
  }
});

window.addEventListener("pagehide", emergencyReleaseCamera);
window.addEventListener("beforeunload", emergencyReleaseCamera);

document.addEventListener("visibilitychange", () => {
  if (
    document.hidden &&
    (cameraRunning || cameraStarting)
  ) {
    emergencyReleaseCamera();
  }
});

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    emergencyReleaseCamera();

    setStatus(
      "warn",
      "Камеру було звільнено",
      "Після повернення на сторінку запустіть камеру повторно.",
      ""
    );
  }
});
