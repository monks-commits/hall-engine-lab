// Cart animation FX.
// Используется после выбора места: VA_CART_FX.fly(seatEl)

window.VA_CART_FX = {
  fly(sourceEl) {
    if (!window.VA_RUNTIME.cartAnimation) return;
    if (!window.VA_RUNTIME.cartFx.flyToCart) return;

    const cartBadge = document.getElementById("cartBadge");
    if (!sourceEl || !cartBadge) return;

    const from = sourceEl.getBoundingClientRect();
    const to = cartBadge.getBoundingClientRect();

    const ghost = sourceEl.cloneNode(true);
    ghost.classList.add("va-seat-ghost");

    ghost.style.left = `${from.left}px`;
    ghost.style.top = `${from.top}px`;
    ghost.style.width = `${from.width}px`;
    ghost.style.height = `${from.height}px`;

    document.body.appendChild(ghost);

    requestAnimationFrame(() => {
      ghost.style.transform = `
        translate(${to.left - from.left}px, ${to.top - from.top}px)
        scale(0.35)
      `;
      ghost.style.opacity = "0";
    });

    window.setTimeout(() => ghost.remove(), 520);

    if (window.VA_RUNTIME.cartFx.badgePulse) {
      cartBadge.classList.remove("va-pulse");
      void cartBadge.offsetWidth;
      cartBadge.classList.add("va-pulse");
    }
  }
};
