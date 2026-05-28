window.VA_RUNTIME = {
  config: null,
  hall: null,
  selected: new Map(),

  init(config) {
    this.config = structuredClone(config);
    this.hall = null;
    this.selected.clear();
    this.applyDom();
  },

  applyDom() {
    const cfg = this.config;
    venueTitle.textContent = cfg.venueTitle || "VA Hall Visual FX Engine";

    hall.style.width = (cfg.hall.width || 1200) + "px";
    hall.style.height = (cfg.hall.height || 900) + "px";

    hallBg.src = cfg.hall.background || "";
    hallBg.alt = cfg.venueTitle || "";
    hallBg.style.display = cfg.hall.background ? "block" : "none";

    themeSelect.value = cfg.theme || "opera";
    presetSelect.value = cfg.preset || "theatre";
    glowToggle.checked = Boolean(cfg.glow);
    cartFxToggle.checked = Boolean(cfg.cartAnimation);

    this.setTheme(cfg.theme || "opera");
    this.setGlow(cfg.glow);
  },

  setTheme(theme) {
    this.config.theme = theme;
    themeCss.href = `./themes/${theme}.css`;
  },

  setPreset(preset) {
    this.config.preset = preset;
    VA_PRESETS.apply(preset);
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
    VA_APP.renderCurrent();
  },

  getAlign() {
    return this.config.hall.align;
  },

  getStatus(key, rawItem) {
    return VA_SEAT_STATE.getStatus(key, rawItem);
  },

  getPrice(rawItem) {
    return Number(rawItem.price || rawItem.deposit || rawItem.amount || rawItem.ticket_price || rawItem.value || 0);
  },

  getItemKey(rawItem) {
    return rawItem.key || rawItem.seat_key || rawItem.id || `${rawItem.zone || "Z"}-${rawItem.row || 0}-M${rawItem.seat}`;
  }
};
