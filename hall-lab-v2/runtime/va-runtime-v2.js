// VA Runtime V2 — presentation layer only.
// Не трогает продажи, оплаты, Supabase, QR, кассу.

window.VA_RUNTIME = {
  theme: "opera",
  glow: true,
  cartAnimation: true,

  seatFx: {
    hover: true,
    selectedPulse: true,
    holdPulse: true
  },

  cartFx: {
    flyToCart: true,
    badgePulse: true
  },

  set(nextConfig = {}) {
    Object.assign(this, nextConfig);
    document.dispatchEvent(new CustomEvent("va:runtime-change", {
      detail: { runtime: this }
    }));
  }
};
