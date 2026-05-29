window.VA_PRESETS = {
  presets: {
    theatre: { bodyClass: "preset-theatre", glow: true, cartAnimation: true },
    kids: { bodyClass: "preset-kids", glow: true, cartAnimation: true },
    club: { bodyClass: "preset-club", glow: true, cartAnimation: true },
    minimal: { bodyClass: "preset-minimal", glow: false, cartAnimation: false }
  },

  apply(name) {
    const p = this.presets[name] || this.presets.theatre;
    document.body.classList.remove("preset-theatre", "preset-kids", "preset-club", "preset-minimal");
    document.body.classList.add(p.bodyClass);
    VA_RUNTIME.setGlow(p.glow);
    VA_RUNTIME.setCartAnimation(p.cartAnimation);
    glowToggle.checked = p.glow;
    cartFxToggle.checked = p.cartAnimation;
  }
};
