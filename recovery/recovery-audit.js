const RECOVERY_SUPABASE_KEY =
  "sb_publishable_nCCfptJOb8Lzy1uAwGBJzA_OJtDneTS";

const $ = (id) => document.getElementById(id);

function badge(result){
  if (result === "OK") {
    return `<span class="badge badge-ok">OK</span>`;
  }

  if (result === "ALREADY_USED") {
    return `<span class="badge badge-warn">ВЖЕ ВИКОРИСТАНО</span>`;
  }

  if (result === "NOT_FOUND") {
    return `<span class="badge badge-bad">НЕ ЗНАЙДЕНО</span>`;
  }

  return `<span class="badge">${result || "—"}</span>`;
}

async function loadAudit(){

  const res = await fetch(
    `${RECOVERY_SUPABASE_URL}/rest/v1/recovery_audit?select=*&order=created_at.desc&limit=100`,
    {
      headers:{
        apikey: RECOVERY_SUPABASE_KEY,
        Authorization:"Bearer " + RECOVERY_SUPABASE_KEY
      }
    }
  );

  if (!res.ok) {
    const txt = await res.text();
    $("auditBody").innerHTML =
      `<tr><td colspan="5">Помилка: ${txt}</td></tr>`;
    return;
  }

  const rows = await res.json();

  const total = rows.length;
  const ok = rows.filter(r => r.result === "OK").length;
  const used = rows.filter(r => r.result === "ALREADY_USED").length;
  const bad = rows.filter(r => r.result === "NOT_FOUND").length;

  $("totalCount").textContent = total;
  $("okCount").textContent = ok;
  $("usedCount").textContent = used;
  $("badCount").textContent = bad;

  if (!rows.length) {
    $("auditBody").innerHTML =
      `<tr><td colspan="5">Подій немає.</td></tr>`;
    return;
  }

  $("auditBody").innerHTML = rows.map(r => `
    <tr>
      <td>${new Date(r.created_at).toLocaleString()}</td>
      <td>${r.token || "—"}</td>
      <td>${badge(r.result)}</td>
      <td>${r.scanned_by || "—"}</td>
      <td>${r.action || "—"}</td>
    </tr>
  `).join("");
}

window.addEventListener("load", loadAudit);
