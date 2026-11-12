let CURRENT_RECOVERY_EVENT_ID = "";

const $ = (id) => document.getElementById(id);

function show(id, text){
  const el = $(id);
  if (el) el.textContent = text || "";
}

function removeInvisibleTokenChars(value){
  return String(value || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function decodeTokenOnce(value){
  const raw = removeInvisibleTokenChars(value).trim();

  if (!/%[0-9A-Fa-f]{2}/.test(raw)) return raw;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function parseVaQrToken(value){
  const raw = decodeTokenOnce(value);
  const compact = /^order\s*:/i.test(raw)
    ? raw.replace(/\s+/g, "")
    : raw.trim();

  const fields = {};

  for (const part of compact.split("|")) {
    const i = part.indexOf(":");
    if (i < 1) continue;

    const key = part.slice(0, i).trim().toLowerCase();
    const itemValue = part.slice(i + 1).trim();

    if (key) fields[key] = itemValue;
  }

  const order_id = String(fields.order || "").trim();
  const seance_id = String(fields.seance || "").trim();
  const show_slug = String(fields.show || "").trim();
  const seat_label = String(fields.seat || "").trim();

  return {
    raw,
    compact,
    order_id,
    seance_id,
    show_slug,
    seat_label,
    structured:Boolean(order_id && seat_label)
  };
}

function canonicalToken(value){
  const parsed = parseVaQrToken(value);

  if (!parsed.structured) {
    return parsed.compact;
  }

  const middle = parsed.seance_id
    ? `seance:${parsed.seance_id}`
    : parsed.show_slug
      ? `show:${parsed.show_slug}`
      : "";

  return [
    `order:${parsed.order_id}`,
    middle,
    `seat:${parsed.seat_label}`
  ].filter(Boolean).join("|");
}

function normalizeToken(value){
  return canonicalToken(value);
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

// All Recovery data access is now server-authorized.
// No direct public SELECT of recovery_tokens or tickets from this cabinet.
async function supaInsert(table, body){
  if (table !== "recovery_events") throw new Error("Direct Recovery token INSERT is disabled");
  if (!window.VAAdminOps) throw new Error("VA Admin Operations client не завантажено");
  const payload = {
    title:body.title,
    original_event:body.original_event,
    recovery_event:body.recovery_event,
    venue_name:body.venue_name,
    locality:body.locality,
    event_scope:body.event_scope,
    incident_type:body.incident_type,
    incident_reason:body.incident_reason,
    incident_note:body.incident_note,
    operational_status:body.operational_status
  };
  const row = await VAAdminOps.request("recovery.external_create_event", payload);
  return [row];
}

async function activateRecoveryToken(rawToken, fallback = {}){
  const token = normalizeToken(rawToken);
  if (!token) throw new Error("empty token");
  if (!CURRENT_RECOVERY_EVENT_ID) throw new Error("Спочатку створіть recovery-подію");
  if (!window.VAAdminOps) throw new Error("VA Admin Operations client не завантажено");

  // Server performs VA ticket lookup, duplicate search and legacy QR repair.
  const result = await VAAdminOps.request("recovery.external_create_token", {
    event_id: CURRENT_RECOVERY_EVENT_ID,
    token,
    seat_label: normalizeText(fallback.seat_label),
    owner_name: normalizeText(fallback.owner_name),
    owner_email: normalizeText(fallback.owner_email)
  });
  return {
    status: result.status === "exists" ? "exists" : "inserted",
    row: result.row,
    source: result.source || "external"
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

    const parsed = parseVaQrToken(row.token || token);

    // Text-only output: never interpret untrusted CSV or DB fields as HTML.
    $("quickResult").textContent = [
      result.status === "exists" ? "↻ Recovery вже було активовано" : "✅ Recovery активовано",
      "",
      `Token: ${row.token || token}`,
      `Джерело: ${result.source}`,
      `Order: ${parsed.order_id || "—"}`,
      `Місце: ${row.seat_label || parsed.seat_label || "—"}`,
      `Глядач: ${row.owner_name || "—"}`,
      `Email: ${row.owner_email || "—"}`
    ].join("\n");

  } catch(e){
    console.error(e);
    $("quickResult").textContent = "❌ " + String(e.message || e);
  }
}
