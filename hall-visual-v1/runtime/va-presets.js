window.VA_PRESETS = {
  presets: {
    theatre: {
      bodyClass: "preset-theatre",
      glow: true,
      cartAnimation: true
    },

    kids: {
      bodyClass: "preset-kids",
      glow: true,
      cartAnimation: true
    },

    club: {
      bodyClass: "preset-club",
      glow: true,
      cartAnimation: true
    },

    minimal: {
      bodyClass: "preset-minimal",
      glow: false,
      cartAnimation: false
    }
  },

  apply(name) {
    const preset = this.presets[name] || this.presets.theatre;

    document.body.classList.remove(
      "preset-theatre",
      "preset-kids",
      "preset-club",
      "preset-minimal"
    );

    document.body.classList.add(preset.bodyClass);

    window.VA_RUNTIME.setGlow(preset.glow);
    window.VA_RUNTIME.setCartAnimation(preset.cartAnimation);

    document.getElementById("glowToggle").checked = preset.glow;
    document.getElementById("cartFxToggle").checked = preset.cartAnimation;
  }
};
