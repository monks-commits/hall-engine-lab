let qr = null;
let lastToken = "";
let lastScanAt = 0;
const cooldownMs = 1400;

const $ = (id) => document.getElementById(id);

function setStatus(kind, title, details, token){
  const box = $("status");

  box.classList.remove("ok","bad","warn");
  if (kind) box.classList.add(kind);

  $("statusTitle").textContent = title || "";
  $("statusDetails").textContent = details || "";
  $("tokenText").textContent = token || "—";
}

async function sendToken(token){

  const secret =
  RECOVERY_SCANNER_SECRET || $("secret").value.trim();
  const scanned_by = $("gate").value.trim() || "recovery-gate"; 

  const res = await fetch(RECOVERY_SCAN_ENDPOINT, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-scanner-secret": secret
    },
    body: JSON.stringify({
      token,
      scanned_by
    })
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    setStatus(
      "bad",
      "Доступ заборонено",
      "Невірний scanner secret.",
      token
    );
    return;
  }

  if (res.status === 404) {
    setStatus(
      "bad",
      "Квиток не знайдено",
      "Цього квитка немає у compensation pool.",
      token
    );
    return;
  }

  if (res.status === 409) {
    setStatus(
      "warn",
      "Вже використано",
      "Компенсаційний прохід уже був зафіксований.",
      token
    );
    return;
  }

  if (!res.ok || data.ok === false) {
    setStatus(
      "bad",
      "Помилка",
      data.error || `HTTP ${res.status}`,
      token
    );
    return;
  }

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

async function onScanSuccess(decodedText){

  const now = Date.now();

  const token = normalizeToken(decodedText);
  if (!token) return;

  if (
    token === lastToken &&
    now - lastScanAt < 3000
  ) {
    return;
  }

  lastToken = token;
  lastScanAt = now;

  await sendToken(token);
}

async function startScanner(){

  $("btnStart").disabled = true;

  try {

    qr = new Html5Qrcode("reader");

    await qr.start(
      { facingMode:"environment" },
      {
        fps:12,
        qrbox:{
          width:280,
          height:280
        }
      },
      onScanSuccess
    );

    $("btnStop").disabled = false;

    setStatus(
      "",
      "Камера працює",
      "Скануйте QR або штрихкод компенсаційного квитка.",
      ""
    );

  } catch(e){

    $("btnStart").disabled = false;
    $("btnStop").disabled = true;

    setStatus(
      "bad",
      "Помилка камери",
      String(e?.message || e),
      ""
    );
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

    setStatus(
      "",
      "Камеру зупинено",
      "Можна запустити повторно.",
      ""
    );

  } catch(e){

    $("btnStart").disabled = false;

    setStatus(
      "warn",
      "Камеру зупинено з попередженням",
      String(e?.message || e),
      ""
    );
  }
}

window.addEventListener("load", () => {
  $("btnStart").addEventListener("click", startScanner);
  $("btnStop").addEventListener("click", stopScanner);
});
