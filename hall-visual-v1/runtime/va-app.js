window.VA_APP = {
  async init() {
    window.VA_RUNTIME.init(window.VA_CONFIG);
    this.bindControls();
    this.bindAlignControls();

    window.VA_RUNTIME.setPreset(window.VA_RUNTIME.config.preset || "theatre");

    await this.loadHall();
  },

  async loadHall() {
    const url = window.VA_RUNTIME.config.hall.json + "?v=" + Date.now();
    const res = await fetch(url);
    const hall = await res.json();

    window.VA_RUNTIME.hall = hall;

    const rendererName = window.VA_RUNTIME.config.renderer || "coordinate";
    const renderer = window.VA_RENDERERS[rendererName];

    if (!renderer) {
      throw new Error("Unknown renderer: " + rendererName);
    }

    renderer.render(hall);
  },

  bindControls() {
    document.getElementById("themeSelect").addEventListener("change", e => {
      window.VA_RUNTIME.setTheme(e.target.value);
    });

    document.getElementById("presetSelect").addEventListener("change", e => {
      window.VA_RUNTIME.setPreset(e.target.value);
    });

    document.getElementById("glowToggle").addEventListener("change", e => {
      window.VA_RUNTIME.setGlow(e.target.checked);
    });

    document.getElementById("cartFxToggle").addEventListener("change", e => {
      window.VA_RUNTIME.setCartAnimation(e.target.checked);
    });

    document.getElementById("reloadBtn").addEventListener("click", () => {
      this.loadHall();
    });

    document.getElementById("clearCartBtn").addEventListener("click", () => {
      window.VA_CART.clear();
    });

    document.getElementById("copyAlignBtn").addEventListener("click", async () => {
      const a = window.VA_RUNTIME.getAlign();

      const txt =
`"align": {
  "scale": ${a.scale},
  "x": ${a.x},
  "y": ${a.y},
  "opacity": ${a.opacity}
}`;

      await navigator.clipboard.writeText(txt);
      alert("ALIGN COPIED");
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

    input.value = window.VA_RUNTIME.getAlign()[key];

    const update = () => {
      window.VA_RUNTIME.setAlign(key, input.value);
      val.textContent = input.value;
    };

    input.addEventListener("input", update);
    update();
  },

  updateAlignPanel() {
    const a = window.VA_RUNTIME.getAlign();

    scaleVal.textContent = a.scale;
    xVal.textContent = a.x;
    yVal.textContent = a.y;
    opacityVal.textContent = a.opacity;
  }
};

document.addEventListener("DOMContentLoaded", () => {
  window.VA_APP.init();
});
