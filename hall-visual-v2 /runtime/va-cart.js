window.VA_CART = {
  toggle(key, el) {
    const status = el.dataset.status;
    if (VA_SEAT_STATE.isLocked(status)) return;

    if (VA_RUNTIME.selected.has(key)) {
      VA_RUNTIME.selected.delete(key);
      VA_SEAT_STATE.applyToElement(el, "free");
    } else {
      VA_RUNTIME.selected.set(key, {
        key,
        type: el.dataset.type || "seat",
        zone: el.dataset.zone,
        row: el.dataset.row,
        seat: el.dataset.seat,
        label: el.dataset.label,
        price: Number(el.dataset.price || 0)
      });

      VA_SEAT_STATE.applyToElement(el, "selected");
      this.flyToCart(el);
    }

    this.refresh();
  },

  refresh() {
    const items = Array.from(VA_RUNTIME.selected.values());
    const sum = items.reduce((acc, item) => acc + Number(item.price || 0), 0);

    cartBadge.textContent = String(items.length);
    cartTotal.textContent = sum + " грн";

    if (!items.length) {
      cartList.innerHTML = '<div class="va-empty">Оберіть місця на схемі</div>';
      return;
    }

    cartList.innerHTML = items.map(item => {
      const title = item.type === "table"
        ? `Стіл ${item.label || item.key}`
        : item.type === "entry"
          ? "Вхідний квиток"
          : `${item.zone || "Зона"} · ряд ${item.row || "-"} · місце ${item.seat || "-"}`;

      return `<div class="va-cart-item"><span>${title}</span><b>${item.price || 0} грн</b></div>`;
    }).join("");
  },

  clear() {
    VA_RUNTIME.selected.clear();
    VA_APP.renderCurrent();
    this.refresh();
  },

  flyToCart(sourceEl) {
    if (!VA_RUNTIME.config.cartAnimation) return;

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
      ghost.style.transform = `translate(${to.left - from.left}px,${to.top - from.top}px) scale(.35)`;
      ghost.style.opacity = "0";
    });

    setTimeout(() => ghost.remove(), 540);

    cartBadge.classList.remove("pulse");
    void cartBadge.offsetWidth;
    cartBadge.classList.add("pulse");
  }
};
