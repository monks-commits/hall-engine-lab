
// VA Admin Operations client — key held in memory ONLY, never in localStorage.
(function () {
  "use strict";
  const ENDPOINT = "https://fhusjlkneckbvnrdhbil.supabase.co/functions/v1/va-admin-operations";
  let adminKey = "";
  let pendingDialog = null;

  function keyDialog() {
    if (pendingDialog) return pendingDialog;
    pendingDialog = new Promise((resolve, reject) => {
      const overlay = document.createElement("div");
      overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(5,10,20,.88);display:flex;align-items:center;justify-content:center;padding:16px";
      const panel = document.createElement("div");
      panel.style.cssText = "background:#1d2d47;color:white;border:1px solid #51627d;border-radius:18px;padding:24px;width:min(440px,100%);font-family:Arial,sans-serif;box-shadow:0 25px 65px #0008";
      const title = document.createElement("h3");
      title.textContent = "VA • Адміністративна дія";
      title.style.cssText = "font-size:22px;margin:0 0 10px";
      const explanation = document.createElement("p");
      explanation.textContent = "Введіть секрет VA Admin Operations. Ключ залишається тільки в пам’яті цієї вкладки.";
      explanation.style.cssText = "line-height:1.5;color:#cbd5e1;margin:0 0 14px";
      const input = document.createElement("input");
      input.type = "password";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.placeholder = "64-символьний секрет";
      input.style.cssText = "width:100%;min-height:44px;padding:10px;border-radius:9px;border:1px solid #64748b;background:#0f172a;color:white;font-size:16px";
      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:10px;justify-content:flex-end;margin-top:18px";
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.textContent = "Скасувати";
      cancel.style.cssText = "border:0;border-radius:9px;background:#475569;color:white;padding:12px 18px;cursor:pointer";
      const submit = document.createElement("button");
      submit.type = "button";
      submit.textContent = "Продовжити";
      submit.style.cssText = "border:0;border-radius:9px;background:#2563eb;color:white;padding:12px 18px;cursor:pointer;font-weight:bold";
      actions.append(cancel, submit);
      panel.append(title, explanation, input, actions);
      overlay.append(panel);
      document.body.append(overlay);
      const done = (value) => { overlay.remove(); resolve(value); };
      const abort = () => { overlay.remove(); reject(new Error("Дію скасовано")); };
      cancel.addEventListener("click", abort, { once: true });
      submit.addEventListener("click", () => {
        const entered = input.value.trim();
        if (!/^[a-fA-F0-9]{64}$/.test(entered)) {
          input.setCustomValidity("Потрібно 64 шістнадцяткові символи");
          input.reportValidity();
          input.setCustomValidity("");
          return;
        }
        done(entered);
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") { event.preventDefault(); submit.click(); }
        if (event.key === "Escape") { event.preventDefault(); abort(); }
      });
      input.focus();
    }).finally(() => { pendingDialog = null; });
    return pendingDialog;
  }

  async function request(action, params = {}) {
    if (!adminKey) adminKey = await keyDialog();
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-va-admin-secret": adminKey },
        body: JSON.stringify({ action, params }),
        cache: "no-store",
      });
    } catch (error) {
      throw new Error("Немає зв’язку з VA Admin Operations: " + String(error?.message || error));
    }
    const answer = await res.json().catch(() => ({}));
    if (res.status === 401) adminKey = "";
    if (!res.ok || answer.ok !== true) {
      throw new Error(String(answer.error || `HTTP ${res.status}`));
    }
    return answer.result;
  }

  window.VAAdminOps = Object.freeze({
    request,
    rpc(name, params = {}) { return request("rpc." + name, params); },
    forgetKey() { adminKey = ""; },
  });
})();
