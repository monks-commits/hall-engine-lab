window.VA_CART = {
  toggle(key, seatEl) {
    const status = seatEl.dataset.status;

    if (window.VA_SEAT_STATE.isLocked(status)) return;

    if (window.VA_RUNTIME.selected.has(key)) {
      window.VA_RUNTIME.selected.delete(key);
      window.VA_SEAT_STATE.applyToElement(seatEl, "free");
    } else {
      window.VA_RUNTIME.selected.set(key, {
        key,
        zone: seatEl.dataset.zone,
        row: seatEl.dataset.row,
        seat: seatEl.dataset.seat,
        price: Number(seatEl.dataset.price || 0)
      });

      window.VA_SEAT_STATE.applyToElement(seatEl, "selected");
      this.flyToCart(seatEl);
    }

    this.refresh();
  },

  refresh() {
    const items = Array.from(window.VA_RUNTIME.selected.values());

    const list = document.getElementById("cartList");
    const badge = document.getElementById("cartBadge");
    const total = document.getElementById("cartTotal");

    const sum = items.reduce((acc, item) => acc + Number(item.price || 0), 0);

    badge.textContent = String(items.length);
    total.textContent = sum + " грн";

    if (!items.length) {
      list.innerHTML = '<div class="va-empty">Оберіть місця на схемі</div>';
      return;
    }

    list.innerHTML = items.map(item => `
      <div class="va-cart-item">
        <span>${item.zone || "Зона"} · ряд ${item.row || "-"} · місце ${item.seat || "-"}</span>
        <b>${item.price || 0} грн</b>
      </div>
    `).join("");
  },

  clear() {
    window.VA_RUNTIME.selected.clear();

    if (window.VA_RUNTIME.hall) {
      window.VA_RENDERERS.coordinate.render(window.VA_RUNTIME.hall);
    }

    this.refresh();
  },

  flyToCart(sourceEl) {
    if (!window.VA_RUNTIME.config.cartAnimation) return;

    const cartBadge = document.getElementById("cartBadge");
    const from = sourceEl.getBoundingClientRect();
    const to = cartBadge.getBoundingClientRect();

    const ghost = sourceEl.cloneNode(true);
    ghost.classList.add("va-seat-ghost");

    ghost.style.left = from.left + "px";
    ghost.style.top = from.top + "px";
    ghost.style.width = from.width + "px";
    ghost.style.height = from.height + "px";

    document.body.appendChild(ghost);

    requestAnimationFrame(() => {
      ghost.style.transform =
        `translate(${to.left - from.left}px,${to.top - from.top}px) scale(.35)`;
      ghost.style.opacity = "0";
    });

    setTimeout(() => ghost.remove(), 540);

    cartBadge.classList.remove("pulse");
    void cartBadge.offsetWidth;
    cartBadge.classList.add("pulse");
  }
};
