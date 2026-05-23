let CURRENT_RECOVERY_EVENT_ID = "";

const RECOVERY_SUPABASE_KEY =
  "sb_publishable_nCCfptJOb8Lzy1uAwGBJzA_OJtDneTS";

const $ = (id) => document.getElementById(id);

function show(id, text){
  $(id).textContent = text;
}

function parseCsv(text){

  const lines = String(text || "")
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0]
    .split(",")
    .map(x => x.trim());

  return lines.slice(1).map(line => {

    const cols = line
      .split(",")
      .map(x => x.trim());

    const row = {};

    headers.forEach((h, i) => {
      row[h] = cols[i] || "";
    });

    return row;
  });
}

async function supaInsert(table, body){

  const res = await fetch(
    `${RECOVERY_SUPABASE_URL}/rest/v1/${table}`,
    {
      method:"POST",
      headers:{
        apikey: RECOVERY_SUPABASE_KEY,
        Authorization:"Bearer " + RECOVERY_SUPABASE_KEY,
        "Content-Type":"application/json",
        Prefer:"return=representation"
      },
      body:JSON.stringify(body)
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt);
  }

  return await res.json();
}

async function createRecoveryEvent(){

  try {

    const title =
      $("title").value.trim();

    const original_event =
      $("originalEvent").value.trim();

    const recovery_event =
      $("recoveryEvent").value.trim();

    if (!title) {
      alert("Вкажіть назву події");
      return;
    }

    const rows = await supaInsert(
      "recovery_events",
      {
        title,
        original_event,
        recovery_event
      }
    );

    const event = rows[0];

    CURRENT_RECOVERY_EVENT_ID = event.id;

    show(
      "eventResult",
      `✅ Recovery-подію створено\nID: ${event.id}\n${event.title}`
    );

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
      alert("Спочатку створіть recovery-подію");
      return;
    }

    const rows =
      parseCsv($("csvInput").value);

    if (!rows.length) {
      alert("CSV порожній або некоректний");
      return;
    }

    const payload = rows
      .filter(r => r.token)
      .map(r => ({
        recovery_event_id:
          CURRENT_RECOVERY_EVENT_ID,

        token:
          String(r.token || "").trim(),

        seat_label:
          r.seat_label || "",

        owner_name:
          r.owner_name || "",

        compensation_allowed:true,
        compensation_used:false
      }));

    if (!payload.length) {
      alert("Немає token для імпорту");
      return;
    }

    const inserted =
      await supaInsert("recovery_tokens", payload);

    show(
      "importResult",
      `✅ Компенсацію активовано\nІмпортовано квитків: ${inserted.length}\n\n` +
      inserted.map(x =>
        `${x.token} — ${x.seat_label || ""} — ${x.owner_name || ""}`
      ).join("\n")
    );

  } catch(e){

    console.error(e);

    show(
      "importResult",
      "❌ Помилка імпорту:\n" +
      String(e.message || e)
    );
  }
}
async function quickActivateRecovery(){

  try {

    if (!CURRENT_RECOVERY_EVENT_ID) {
      alert("Спочатку створіть recovery-подію");
      return;
    }

    const token =
      document.getElementById("quickToken")
      .value
      .trim();

    if (!token) {
      alert("Введіть token");
      return;
    }

    const inserted = await supaInsert(
      "recovery_tokens",
      {
        recovery_event_id:
          CURRENT_RECOVERY_EVENT_ID,

        token,

        seat_label:"—",
        owner_name:"Recovery Client",

        compensation_allowed:true,
        compensation_used:false
      }
    );

    document.getElementById("quickResult").innerHTML = `
      ✅ Recovery активовано<br><br>
      Token: ${inserted[0].token}
    `;

  } catch(e){

    console.error(e);

    document.getElementById("quickResult").innerHTML =
      "❌ " + String(e.message || e);
  }
}
