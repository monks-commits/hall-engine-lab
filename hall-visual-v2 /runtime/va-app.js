window.VA_APP = {
  async init() {
    this.fillVenueSelect();
    this.bindControls();
    this.bindAlignControls();

    const venueId = VA_CONFIG_LOADER.getVenueIdFromUrl();
    await this.loadVenue(venueId);
  },

  fillVenueSelect() {
    venueSelect.innerHTML = Object.entries(VA_VENUES.items)
      .map(([id, item]) => `<option value="${id}">${item.label}</option>`)
      .join("");
  },

  async loadVenue(venueId) {
    VA_CONFIG_LOADER.setVenueUrl(venueId);
    const cfg = VA_CONFIG_LOADER.getConfigByVenueId(venueId);

    venueSelect.value = venueId;

    VA_RUNTIME.init(cfg);
    VA_RUNTIME.setPreset(cfg.preset || "theatre");

    this.syncAlignInputs();
    await this.loadHall();
  },

  async loadHall() {
    const rendererName = VA_RUNTIME.config.renderer || "coordinate";
    const renderer = VA_RENDERERS[rendererName];

    if (!renderer) throw new Error("Unknown renderer: " + rendererName);

    const hallData = await renderer.load();
    VA_RUNTIME.hall = hallData;
    this.renderCurrent();
  },

  renderCurrent() {
    const rendererName = VA_RUNTIME.config.renderer || "coordinate";
    const renderer = VA_RENDERERS[rendererName];
    if (!renderer || !VA_RUNTIME.hall) return;

    renderer.render(VA_RUNTIME.hall);
    this.updateAlignPanel();
    VA_CART.refresh();
  },

  bindControls() {
    venueSelect.addEventListener("change", e => this.loadVenue(e.target.value));
    themeSelect.addEventListener("change", e => VA_RUNTIME.setTheme(e.target.value));
    presetSelect.addEventListener("change", e => VA_RUNTIME.setPreset(e.target.value));
    glowToggle.addEventListener("change", e => VA_RUNTIME.setGlow(e.target.checked));
    cartFxToggle.addEventListener("change", e => VA_RUNTIME.setCartAnimation(e.target.checked));
    reloadBtn.addEventListener("click", () => this.loadHall());
    clearCartBtn.addEventListener("click", () => VA_CART.clear());

    copyAlignBtn.addEventListener("click", async () => {
      const a = VA_RUNTIME.getAlign();
      const txt = `"align": {\n  "scale": ${a.scale},\n  "x": ${a.x},\n  "y": ${a.y},\n  "opacity": ${a.opacity}\n}`;
      await navigator.clipboard.writeText(txt);
      alert("ALIGN COPIED");
    });

    copyConfigBtn.addEventListener("click", async () => {
      const cfg = structuredClone(VA_RUNTIME.config);
      const key = "VA_CONFIG_" + cfg.id.toUpperCase().replaceAll("-", "_");
      const txt = `window.${key} = ${JSON.stringify(cfg, null, 2)};`;
      await navigator.clipboard.writeText(txt);
      alert("VENUE CONFIG COPIED");
    });
  },

  bindAlignControls() {
    this.bindRange("scale", "scale");
    this.bindRange("x", "x");
    this.bindRange("y", "y");
    this.bindRange("opacity", "opacity");
  },

  bindRange(id, key) {
    const input = document.getElementById(id);
    const val = document.getElementById(id + "Val");

    input.addEventListener("input", () => {
      VA_RUNTIME.setAlign(key, input.value);
      val.textContent = input.value;
    });
  },

  syncAlignInputs() {
    const a = VA_RUNTIME.getAlign();
    scale.value = a.scale;
    x.value = a.x;
    y.value = a.y;
    opacity.value = a.opacity;
    this.updateAlignPanel();
  },

  updateAlignPanel() {
    const a = VA_RUNTIME.getAlign();
    scaleVal.textContent = a.scale;
    xVal.textContent = a.x;
    yVal.textContent = a.y;
    opacityVal.textContent = a.opacity;
  }
};

document.addEventListener("DOMContentLoaded", () => VA_APP.init());
