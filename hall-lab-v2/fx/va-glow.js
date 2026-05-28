// Glow FX module.
// Работает только через CSS-классы. Логику билетов не знает.

window.VA_GLOW = {
  refresh() {
    document.body.classList.toggle("va-glow-on", Boolean(window.VA_RUNTIME.glow));
    document.body.classList.toggle("va-glow-off", !window.VA_RUNTIME.glow);
  }
};

document.addEventListener("va:runtime-change", () => {
  window.VA_GLOW.refresh();
});
