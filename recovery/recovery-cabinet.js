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

function sameSeat(a, b){
  return String(a || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase() ===
    String(b || "")
      .replace(/\s+/g, "")
      .trim()
      .toUpperCase();
}

function equivalentVaToken(a, b){
  const aa = parseVaQrToken(a);
  const bb = parseVaQrToken(b);

  if (normalizeToken(a) === normalizeToken(b)) return true;

  if (aa.structured && bb.structured) {
    return (
      aa.order_id.toLowerCase() === bb.order_id.toLowerCase() &&
      sameSeat(aa.seat_label, bb.seat_label)
    );
  }

  return false;
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

async function supaUpdate(table, query, body){
  const res = await fetch(
    `${RECOVERY_SUPABASE_URL}/rest/v1/${table}${query}`,
    {
      method:"PATCH",
      headers:{
        apikey:RECOVERY_SUPABASE_KEY,
        Authorization:"Bearer " + RECOVERY_SUPABASE_KEY,
        "Content-Type":"application/json",
        Prefer:"return=representation"
      },
      body:JSON.stringify(body)
    }
  );

  if (!res.ok) throw new Error(await res.text());
  return await res.json();
}

async function findTicketByQrPayload(token){
  const canonical = normalizeToken(token);

  const exactRows = await supaFetch(
    "tickets",
    `?qr_payload=eq.${encodeURIComponent(canonical)}` +
    `&select=id,order_id,seance_id,show_slug,seat_label,price,buyer_name,buyer_email,qr_payload` +
    `&limit=2`
  );

  if (Array.isArray(exactRows) && exactRows.length) {
    return exactRows[0];
  }

  const parsed = parseVaQrToken(canonical);

  if (!parsed.structured) return null;

  /*
    Кассовый QR может содержать старое show:test, но order_id
    и seat_label всё равно однозначно определяют физический билет.
  */
  const rows = await supaFetch(
    "tickets",
    `?order_id=eq.${encodeURIComponent(parsed.order_id)}` +
    `&seat_label=eq.${encodeURIComponent(parsed.seat_label)}` +
    `&select=id,order_id,seance_id,show_slug,seat_label,price,buyer_name,buyer_email,qr_payload` +
    `&limit=2`
  );

  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0];
}

async function findExistingRecoveryToken(token){
  const canonical = normalizeToken(token);

  const exactRows = await supaFetch(
    "recovery_tokens",
    `?recovery_event_id=eq.${encodeURIComponent(CURRENT_RECOVERY_EVENT_ID)}` +
    `&token=eq.${encodeURIComponent(canonical)}` +
    `&select=*` +
    `&limit=2`
  );

  if (Array.isArray(exactRows) && exactRows.length) {
    return exactRows[0];
  }

  const parsed = parseVaQrToken(canonical);

  if (!parsed.structured) return null;

  /*
    Ищем старую запись этой Recovery-події по order_id.
    Затем сравниваем order_id + seat_label уже в JavaScript.
  */
  const tail = parsed.order_id.slice(-8) || parsed.order_id;

  const candidates = await supaFetch(
    "recovery_tokens",
    `?recovery_event_id=eq.${encodeURIComponent(CURRENT_RECOVERY_EVENT_ID)}` +
    `&token=ilike.${encodeURIComponent(`*${tail}*`)}` +
    `&select=*` +
    `&limit=100`
  );

  const equivalent = (Array.isArray(candidates) ? candidates : [])
    .find(row => equivalentVaToken(row?.token, canonical));

  if (!equivalent) return null;

  /*
    Старую строку с переносами/скрытыми символами сразу ремонтируем,
    чтобы дальнейшие сканы проходили обычным точным поиском.
  */
  if (String(equivalent.token || "") !== canonical) {
    const repaired = await supaUpdate(
      "recovery_tokens",
      `?id=eq.${encodeURIComponent(equivalent.id)}`,
      { token:canonical }
    );

    if (Array.isArray(repaired) && repaired.length) {
      return repaired[0];
    }
  }

  return equivalent;
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

  /*
    Если билет найден в tickets, источником истины становится
    сохранённый tickets.qr_payload. Для внешнего/несинхронизированного
    билета сохраняем каноническую строку, введённую оператором.
  */
  const storedToken = normalizeToken(ticket?.qr_payload || token);

  const payload = {
    recovery_event_id: CURRENT_RECOVERY_EVENT_ID,
    token:storedToken,
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

    const parsed = parseVaQrToken(row.token || token);

    $("quickResult").innerHTML = `
${result.status === "exists" ? "↻ Recovery вже було активовано" : "✅ Recovery активовано"}<br><br>
Token: ${row.token || token}<br>
Джерело: ${result.source}<br>
Order: ${parsed.order_id || "—"}<br>
Місце: ${row.seat_label || parsed.seat_label || "—"}<br>
Глядач: ${row.owner_name || "—"}<br>
Email: ${row.owner_email || "—"}
    `;

  } catch(e){
    console.error(e);
    $("quickResult").innerHTML = "❌ " + String(e.message || e);
  }
}
