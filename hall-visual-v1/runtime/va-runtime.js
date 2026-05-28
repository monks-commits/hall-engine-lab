window.VA_RUNTIME = {
  config: null,
  hall: null,

  selected: new Map(),

  init(config) {
    this.config = structuredClone(config);
    this.applyInitialDom();
  },

  applyInitialDom() {
    const cfg = this.config;

    document.getElementById("venueTitle").textContent =
      cfg.venueTitle || "VA Hall Visual FX Engine";

    const hall = document.getElementById("hall");
    hall.style.width = (cfg.hall.width || 1200) + "px";
    hall.style.height = (cfg.hall.height || 1400) + "px";

    const bg = document.getElementById("hallBg");
    bg.src = cfg.hall.background || "";
    bg.alt = cfg.venueTitle || "";

    document.body.classList.toggle("fx-glow", Boolean(cfg.glow));

    const themeSelect = document.getElementById("themeSelect");
    themeSelect.value = cfg.theme || "opera";

    const presetSelect = document.getElementById("presetSelect");
    presetSelect.value = cfg.preset || "theatre";

    document.getElementById("glowToggle").checked = Boolean(cfg.glow);
    document.getElementById("cartFxToggle").checked = Boolean(cfg.cartAnimation);

    this.setTheme(cfg.theme || "opera");
  },

  setTheme(theme) {
    this.config.theme = theme;
    document.getElementById("themeCss").href = `./themes/${theme}.css`;
  },

  setPreset(preset) {
    this.config.preset = preset;
    window.VA_PRESETS.apply(preset);
  },

  setGlow(enabled) {
    this.config.glow = Boolean(enabled);
    document.body.classList.toggle("fx-glow", this.config.glow);
  },

  setCartAnimation(enabled) {
    this.config.cartAnimation = Boolean(enabled);
  },

  setAlign(key, value) {
    this.config.hall.align[key] = Number(value);
    if (this.hall) {
      window.VA_RENDERERS.coordinate.render(this.hall);
    }
  },

  getAlign() {
    return this.config.hall.align;
  },

  getStatus(key, rawSeat) {
    return window.VA_SEAT_STATE.getStatus(key, rawSeat);
  },

  getPrice(rawSeat) {
    return Number(
      rawSeat.price ||
      rawSeat.amount ||
      rawSeat.ticket_price ||
      rawSeat.value ||
      0
    );
  },

  getSeatKey(rawSeat) {
    return (
      rawSeat.key ||
      rawSeat.seat_key ||
      rawSeat.id ||
      `${rawSeat.zone || "Z"}-${rawSeat.row || 0}-M${rawSeat.seat}`
    );
  }
};
