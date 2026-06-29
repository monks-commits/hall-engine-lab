let CURRENT_RECOVERY_EVENT_ID = "";

const $ = (id) => document.getElementById(id);

function show(id, text){
  const el = $(id);
  if (el) el.textContent = text || "";
}

function normalizeToken(value){
  return String(value || "").trim();
}

function normalizeText(value){
  return String(value || "").trim();
}

function parseCsv(text){
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(x => x.trim());

  return lines.slice(1).map(line => {
    const cols = line.split(",").map(x => x.trim());
    const row = {};
    headers.forEach((h, i) => row[h] = cols[i] || "");
    return row;
  });
}

async function supaFetch(table, query = ""){
  const res = await fetch(`${RECOVERY_SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers:{
      apikey: RECOVERY_SUPABASE_KEY,
      Authorization:"Bearer " + RECOVERY_SUPABASE_KEY
    },
    cache:"no-store"
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function supaInsert(table, body){
  const res = await fetch(`${RECOVERY_SUPABASE_URL}/rest/v1/${table}`, {
    method:"POST",
    headers:{
      apikey: RECOVERY_SUPABASE_KEY,
      Authorization:"Bearer " + RECOVERY_SUPABASE_KEY,
      "Content-Type":"application/json",
      Prefer:"return=representation"
    },
    body:JSON.stringify(body)
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function findTicketByQrPayload(token){
  const rows = await supaFetch(
    "tickets",
    `?qr_payload=eq.${encodeURIComponent(token)}` +
    `&select=id,order_id,show_slug,seat_label,price,buyer_name,buyer_email,qr_payload` +
    `&limit=2`
  );

  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function findExistingRecoveryToken(token){
  const rows = await supaFetch(
    "recovery_tokens",
    `?recovery_event_id=eq.${encodeURIComponent(CURRENT_RECOVERY_EVENT_ID)}` +
    `&token=eq.${encodeURIComponent(token)}` +
    `&select=*` +
    `&limit=2`
  );

  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function activateRecoveryToken(rawToken, fallback = {}){
  const token = normalizeToken(rawToken);

  if (!token) throw new Error("empty token");
  if (!CURRENT_RECOVERY_EVENT_ID) throw new Error("Спочатку створіть recovery-подію");

  const existing = await findExistingRecoveryToken(token);

  if (existing) {
    return {
      status:"exists",
      row:existing,
      source:"recovery_tokens"
    };
  }

  const ticket = await findTicketByQrPayload(token);

  const payload = {
    recovery_event_id: CURRENT_RECOVERY_EVENT_ID,
    token,
    seat_label:
      normalizeText(ticket?.seat_label) ||
      normalizeText(fallback.seat_label) ||
      "",
    owner_name:
      normalizeText(ticket?.buyer_name) ||
      normalizeText(fallback.owner_name) ||
      "",
    owner_email:
      normalizeText(ticket?.buyer_email) ||
      normalizeText(fallback.owner_email) ||
      null,
    compensation_allowed:true,
    compensation_used:false
  };

  const inserted = await supaInsert("recovery_tokens", payload);

  return {
    status:"inserted",
    row:inserted[0],
    source:ticket ? "tickets.qr_payload" : "external"
  };
}

async function createRecoveryEvent(){
  try {
    const title = normalizeText($("title").value);
    const original_event = normalizeText($("originalEvent").value);
    const recovery_event = normalizeText($("recoveryEvent").value);
    const venue_name = normalizeText($("venueName").value);
    const locality = normalizeText($("locality").value);
    const event_scope = $("eventScope").value;
    const incident_type = $("incidentType").value;
    const incident_reason = $("incidentReason").value;
    const operational_status = $("operationalStatus").value;
    const incident_note = normalizeText($("incidentNote").value);

    if (!title) return alert("Вкажіть назву події");
    if (!venue_name) return alert("Вкажіть майданчик");

    const rows = await supaInsert("recovery_events", {
      title,
      original_event,
      recovery_event,
      venue_id: venue_name.toLowerCase().replaceAll(" ", "-"),
      venue_name,
      locality,
      event_scope,
      incident_type,
      incident_reason,
      incident_note,
      operational_status,
      status:"active"
    });

    const event = rows[0];
    CURRENT_RECOVERY_EVENT_ID = event.id;

    show("eventResult", `✅ Recovery-подію створено
ID: ${event.id}
Майданчик: ${event.venue_name}
Тип: ${event.incident_type}
Причина: ${event.incident_reason}
${event.title}`);

  } catch(e){
    console.error(e);
    show("eventResult", "❌ Помилка створення recovery-події:\n" + String(e.message || e));
  }
}

async function importTokens(){
  try {
    if (!CURRENT_RECOVERY_EVENT_ID) return alert("Спочатку створіть recovery-подію");

    const rows = parseCsv($("csvInput").value);
    if (!rows.length) return alert("CSV порожній або некоректний");

    const items = rows.filter(r => normalizeToken(r.token));
    if (!items.length) return alert("Немає token для імпорту");

    const results = [];

    for (const r of items) {
      try {
        const result = await activateRecoveryToken(r.token, {
          seat_label:r.seat_label,
          owner_name:r.owner_name,
          owner_email:r.owner_email
        });
        results.push(result);
      } catch(e) {
        results.push({ status:"error", token:r.token, error:String(e.message || e) });
      }
    }

    const inserted = results.filter(x => x.status === "inserted");
    const exists = results.filter(x => x.status === "exists");
    const errors = results.filter(x => x.status === "error");

    show("importResult", `✅ Імпорт завершено
Нових активацій: ${inserted.length}
Вже існували: ${exists.length}
Помилок: ${errors.length}

` + results.map(x => {
      if (x.status === "error") return `❌ ${x.token}: ${x.error}`;
      const row = x.row || {};
      const mark = x.status === "exists" ? "↻ вже було" : "✅ активовано";
      return `${mark}: ${row.token} — ${row.seat_label || "—"} — ${row.owner_name || "—"} (${x.source})`;
    }).join("\n"));

  } catch(e){
    console.error(e);
    show("importResult", "❌ Помилка імпорту:\n" + String(e.message || e));
  }
}

async function quickActivateRecovery(){
  try {
    if (!CURRENT_RECOVERY_EVENT_ID) return alert("Спочатку створіть recovery-подію");

    const token = normalizeToken($("quickToken").value);
    if (!token) return alert("Введіть token / barcode / QR payload");

    const result = await activateRecoveryToken(token);
    const row = result.row || {};

    $("quickResult").innerHTML = `
${result.status === "exists" ? "↻ Recovery вже було активовано" : "✅ Recovery активовано"}<br><br>
Token: ${row.token || token}<br>
Джерело: ${result.source}<br>
Місце: ${row.seat_label || "—"}<br>
Глядач: ${row.owner_name || "—"}<br>
Email: ${row.owner_email || "—"}
    `;

  } catch(e){
    console.error(e);
    $("quickResult").innerHTML = "❌ " + String(e.message || e);
  }
}
