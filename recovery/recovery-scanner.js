let qr = null;
let lastToken = "";
let lastScanAt = 0;

const $ = (id) => document.getElementById(id);

let audioCtx = null;

function initAudio(){
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
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

async function sendToken(token){
  const secret = RECOVERY_SCANNER_SECRET || $("secret").value.trim();
  const scanned_by = $("gate").value.trim() || "recovery-gate";

  const res = await fetch(RECOVERY_SCAN_ENDPOINT, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-scanner-secret": secret
    },
    body: JSON.stringify({ token, scanned_by })
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    playScanSound("error");
    setStatus("bad", "Доступ заборонено", "Невірний scanner secret.", token);
    return;
  }

  if (res.status === 404) {
    playScanSound("error");
    setStatus("bad", "Квиток не знайдено", "Цього квитка немає у compensation pool.", token);
    return;
  }

  if (res.status === 409 || data.error === "already_used") {
    playScanSound(data.error === "duplicate_token" ? "error" : "used");
    setStatus(
      data.error === "duplicate_token" ? "bad" : "warn",
      data.error === "duplicate_token" ? "Дублікат токена" : "Вже використано",
      data.error === "duplicate_token"
        ? "У recovery_tokens знайдено кілька однакових token. Потрібно очистити дублікати."
        : "Компенсаційний прохід уже був зафіксований.",
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
      data.ticket?.seat_label ? `Місце: ${data.ticket.seat_label}` : "",
      data.ticket?.owner_name ? `Глядач: ${data.ticket.owner_name}` : ""
    ].filter(Boolean).join(" • ") || "Повторний прохід дозволено.",
    token
  );
}

function normalizeToken(text){
  return String(text || "").trim();
}

let scanLocked = false;

async function onScanSuccess(decodedText){
  if (scanLocked) return;
  const now = Date.now();
  const token = normalizeToken(decodedText);
  if (!token) return;

  if (token === lastToken && now - lastScanAt < 8000) return;

  scanLocked = true;
  lastToken = token;
  lastScanAt = now;

  await sendToken(token);

  setTimeout(() => {
    scanLocked = false;
  }, 8000);
}

async function startScanner(){
  $("btnStart").disabled = true;
  initAudio();

  try {
    qr = new Html5Qrcode("reader");
    await qr.start(
      { facingMode:"environment" },
      { fps:12, qrbox:{ width:280, height:280 } },
      onScanSuccess
    );
    $("btnStop").disabled = false;
    setStatus("", "Камера працює", "Скануйте QR або штрихкод компенсаційного квитка.", "");
  } catch(e){
    $("btnStart").disabled = false;
    $("btnStop").disabled = true;
    setStatus("bad", "Помилка камери", String(e?.message || e), "");
  }
}

async function stopScanner(){
  $("btnStop").disabled = true;

  try {
    if (qr) {
      await qr.stop();
      await qr.clear();
      qr = null;
    }
    $("btnStart").disabled = false;
    setStatus("", "Камеру зупинено", "Можна запустити повторно.", "");
  } catch(e){
    $("btnStart").disabled = false;
    setStatus("warn", "Камеру зупинено з попередженням", String(e?.message || e), "");
  }
}

window.addEventListener("load", () => {
  $("btnStart").addEventListener("click", startScanner);
  $("btnStop").addEventListener("click", stopScanner);
});
