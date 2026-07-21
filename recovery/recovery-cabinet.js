"use strict";

let CURRENT_RECOVERY_EVENT_ID = "";
let CURRENT_SOURCE_SEANCE_ID = "";
let CURRENT_SOURCE_SEANCE_LABEL = "";

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

function parseLegacyVaQr(token){
  const out = {};

  for (const part of String(token || "").split("|")) {
    const i = part.indexOf(":");
    if (i === -1) continue;
    out[part.slice(0, i)] = part.slice(i + 1);
  }

  return {
    order_id: normalizeText(out.order),
    seance_id: normalizeText(out.seance),
    show_slug: normalizeText(out.show),
    seat_label: normalizeText(out.seat)
  };
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

async function supaPatch(table, id, body){
  const res = await fetch(
    `${RECOVERY_SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
    {
      method:"PATCH",
      headers:{
        apikey: RECOVERY_SUPABASE_KEY,
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

/*
  Создаём выбор исходного сеанса прямо из JS.
  HTML кабинета менять не требуется.
*/
function ensureSourceSeanceControl(){
  if ($("sourceSeanceId")) return $("sourceSeanceId");

  const originalInput = $("originalEvent");
  if (!originalInput || !originalInput.parentNode) return null;

  const label = document.createElement("label");
  label.setAttribute("for", "sourceSeanceId");
  label.textContent = "Сеанс-джерело компенсації";

  const select = document.createElement("select");
  select.id = "sourceSeanceId";
  select.style.width = "100%";
  select.style.boxSizing = "border-box";
  select.style.border = "1px solid rgba(255,255,255,.14)";
  select.style.background = "#10233f";
  select.style.color = "#fff";
  select.style.borderRadius = "14px";
  select.style.padding = "12px";
  select.style.font = "inherit";

  const first = document.createElement("option");
  first.value = "";
  first.textContent = "Завантаження сеансів...";
  select.appendChild(first);

  originalInput.insertAdjacentElement("afterend", select);
  select.insertAdjacentElement("beforebegin", label);

  select.addEventListener("change", () => {
    CURRENT_SOURCE_SEANCE_ID = normalizeText(select.value);

    const selected = select.options[select.selectedIndex];
    CURRENT_SOURCE_SEANCE_LABEL =
      normalizeText(selected?.dataset?.label) ||
      normalizeText(selected?.textContent);

    if (CURRENT_SOURCE_SEANCE_LABEL && originalInput) {
      originalInput.value = CURRENT_SOURCE_SEANCE_LABEL;
    }
  });

  return select;
}

async function loadSourceSeances(){
  const select = ensureSourceSeanceControl();
  if (!select) return;

  try {
    const rows = await supaFetch(
      "seances",
      "?select=id,show,date,time,venue_id,active,archived" +
      "&order=date.desc,time.desc"
    );

    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Оберіть перерваний / перенесений сеанс";
    select.appendChild(empty);

    for (const s of Array.isArray(rows) ? rows : []) {
      const option = document.createElement("option");
      option.value = normalizeText(s.id);

      const label = [
        normalizeText(s.show) || "Без назви",
        normalizeText(s.date),
        normalizeText(s.time),
        normalizeText(s.venue_id)
      ].filter(Boolean).join(" • ");

      option.textContent = label || s.id;
      option.dataset.label = label || s.id;
      select.appendChild(option);
    }

  } catch(e) {
    console.error("loadSourceSeances error", e);
    select.innerHTML = "";

    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Помилка завантаження сеансів";
    select.appendChild(option);
  }
}

async function findTicketByQrPayload(token){
  const rows = await supaFetch(
    "tickets",
    `?qr_payload=eq.${encodeURIComponent(token)}` +
    `&select=` +
      `id,order_id,seance_id,show_slug,seat_label,price,` +
      `buyer_name,buyer_email,qr_payload,checked_in_at` +
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

function buildSourceData(token, ticket, fallback = {}){
  const legacy = parseLegacyVaQr(token);

  return {
    source_ticket_id:
      normalizeText(ticket?.id) ||
      normalizeText(fallback.source_ticket_id) ||
      null,

    source_order_id:
      normalizeText(ticket?.order_id) ||
      normalizeText(legacy.order_id) ||
      normalizeText(fallback.source_order_id) ||
      null,

    source_seance_id:
      normalizeText(ticket?.seance_id) ||
      normalizeText(legacy.seance_id) ||
      normalizeText(fallback.source_seance_id) ||
      normalizeText(CURRENT_SOURCE_SEANCE_ID) ||
      null,

    source_show_slug:
      normalizeText(ticket?.show_slug) ||
      normalizeText(legacy.show_slug) ||
      normalizeText(fallback.source_show_slug) ||
      null,

    source_seat_label:
      normalizeText(ticket?.seat_label) ||
      normalizeText(legacy.seat_label) ||
      normalizeText(fallback.seat_label) ||
      null,

    source_checked_in_at:
      normalizeText(ticket?.checked_in_at) ||
      normalizeText(fallback.source_checked_in_at) ||
      null
  };
}

async function activateRecoveryToken(rawToken, fallback = {}){
  const token = normalizeToken(rawToken);

  if (!token) throw new Error("empty token");
  if (!CURRENT_RECOVERY_EVENT_ID) {
    throw new Error("Спочатку створіть recovery-подію");
  }

  const ticket = await findTicketByQrPayload(token);
  const source = buildSourceData(token, ticket, fallback);

  if (!source.source_seance_id) {
    throw new Error(
      "Не визначено сеанс-джерело. Оберіть перерваний / перенесений сеанс."
    );
  }

  const existing = await findExistingRecoveryToken(token);

  if (existing) {
    const patch = {};

    if (!existing.source_ticket_id && source.source_ticket_id) {
      patch.source_ticket_id = source.source_ticket_id;
    }
    if (!existing.source_order_id && source.source_order_id) {
      patch.source_order_id = source.source_order_id;
    }
    if (!existing.source_seance_id && source.source_seance_id) {
      patch.source_seance_id = source.source_seance_id;
    }
    if (!existing.source_show_slug && source.source_show_slug) {
      patch.source_show_slug = source.source_show_slug;
    }
    if (!existing.source_seat_label && source.source_seat_label) {
      patch.source_seat_label = source.source_seat_label;
    }
    if (!existing.source_checked_in_at && source.source_checked_in_at) {
      patch.source_checked_in_at = source.source_checked_in_at;
    }
    if (!existing.seat_label && (ticket?.seat_label || fallback.seat_label)) {
      patch.seat_label =
        normalizeText(ticket?.seat_label) ||
        normalizeText(fallback.seat_label);
    }
    if (!existing.owner_name && (ticket?.buyer_name || fallback.owner_name)) {
      patch.owner_name =
        normalizeText(ticket?.buyer_name) ||
        normalizeText(fallback.owner_name);
    }
    if (!existing.owner_email && (ticket?.buyer_email || fallback.owner_email)) {
      patch.owner_email =
        normalizeText(ticket?.buyer_email) ||
        normalizeText(fallback.owner_email) ||
        null;
    }

    if (Object.keys(patch).length) {
      const patched = await supaPatch("recovery_tokens", existing.id, patch);

      return {
        status:"updated",
        row:patched[0] || { ...existing, ...patch },
        source:ticket ? "tickets.qr_payload" : "recovery_event"
      };
    }

    return {
      status:"exists",
      row:existing,
      source:ticket ? "tickets.qr_payload" : "recovery_event"
    };
  }

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
    compensation_used:false,

    source_ticket_id:source.source_ticket_id,
    source_order_id:source.source_order_id,
    source_seance_id:source.source_seance_id,
    source_show_slug:source.source_show_slug,
    source_seat_label:source.source_seat_label,
    source_checked_in_at:source.source_checked_in_at
  };

  const inserted = await supaInsert("recovery_tokens", payload);

  return {
    status:"inserted",
    row:inserted[0],
    source:ticket ? "tickets.qr_payload" : "recovery_event"
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

    const sourceSelect = $("sourceSeanceId");
    CURRENT_SOURCE_SEANCE_ID = normalizeText(sourceSelect?.value);

    const selected = sourceSelect?.options?.[sourceSelect.selectedIndex];
    CURRENT_SOURCE_SEANCE_LABEL =
      normalizeText(selected?.dataset?.label) ||
      normalizeText(selected?.textContent);

    if (!title) return alert("Вкажіть назву події");
    if (!venue_name) return alert("Вкажіть майданчик");

    if (!CURRENT_SOURCE_SEANCE_ID) {
      return alert("Оберіть сеанс-джерело компенсації");
    }

    const rows = await supaInsert("recovery_events", {
      title,
      original_event: original_event || CURRENT_SOURCE_SEANCE_LABEL,
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
Компенсація від: ${CURRENT_SOURCE_SEANCE_LABEL}
Source seance ID: ${CURRENT_SOURCE_SEANCE_ID}
Майданчик: ${event.venue_name}
Тип: ${event.incident_type}
Причина: ${event.incident_reason}
${event.title}`);

  } catch(e){
    console.error(e);
    show(
      "eventResult",
      "❌ Помилка створення recovery-події:\n" +
      String(e.message || e)
    );
  }
}

async function importTokens(){
  try {
    if (!CURRENT_RECOVERY_EVENT_ID) {
      return alert("Спочатку створіть recovery-подію");
    }

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
          owner_email:r.owner_email,
          source_seance_id:
            r.source_seance_id || CURRENT_SOURCE_SEANCE_ID
        });

        results.push(result);
      } catch(e) {
        results.push({
          status:"error",
          token:r.token,
          error:String(e.message || e)
        });
      }
    }

    const inserted = results.filter(x => x.status === "inserted");
    const updated = results.filter(x => x.status === "updated");
    const exists = results.filter(x => x.status === "exists");
    const errors = results.filter(x => x.status === "error");

    show("importResult", `✅ Імпорт завершено
Нових активацій: ${inserted.length}
Доповнено джерело: ${updated.length}
Вже існували: ${exists.length}
Помилок: ${errors.length}

` + results.map(x => {
      if (x.status === "error") {
        return `❌ ${x.token}: ${x.error}`;
      }

      const row = x.row || {};
      const mark =
        x.status === "exists"
          ? "↻ вже було"
          : x.status === "updated"
            ? "🛠 доповнено"
            : "✅ активовано";

      return `${mark}: ${row.token} — ` +
        `${row.source_seance_id || "джерело не визначено"} — ` +
        `${row.seat_label || "—"} — ${row.owner_name || "—"} ` +
        `(${x.source})`;
    }).join("\n"));

  } catch(e){
    console.error(e);
    show(
      "importResult",
      "❌ Помилка імпорту:\n" + String(e.message || e)
    );
  }
}

async function quickActivateRecovery(){
  try {
    if (!CURRENT_RECOVERY_EVENT_ID) {
      return alert("Спочатку створіть recovery-подію");
    }

    const token = normalizeToken($("quickToken").value);
    if (!token) return alert("Введіть token / barcode / QR payload");

    const result = await activateRecoveryToken(token, {
      source_seance_id:CURRENT_SOURCE_SEANCE_ID
    });

    const row = result.row || {};

    $("quickResult").innerHTML = `
${result.status === "exists"
  ? "↻ Recovery вже було активовано"
  : result.status === "updated"
    ? "🛠 Recovery доповнено даними джерела"
    : "✅ Recovery активовано"}<br><br>
Token: ${row.token || token}<br>
Джерело даних: ${result.source}<br>
Компенсація від: ${row.source_seance_id || "—"}<br>
Місце: ${row.source_seat_label || row.seat_label || "—"}<br>
Глядач: ${row.owner_name || "—"}<br>
Email: ${row.owner_email || "—"}<br>
Первинне погашення: ${row.source_checked_in_at || "—"}
    `;

  } catch(e){
    console.error(e);
    $("quickResult").innerHTML = "❌ " + String(e.message || e);
  }
}

window.addEventListener("load", loadSourceSeances);
