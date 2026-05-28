window.VA_RENDERERS = window.VA_RENDERERS || {};

window.VA_RENDERERS.tables = {
  async load() {
    return { tables: VA_RUNTIME.config.hall.tables || [] };
  },

  render(hallData) {
    const align = VA_RUNTIME.getAlign();
    seatLayer.innerHTML = "";

    (hallData.tables || []).forEach(rawItem => {
      const key = VA_RUNTIME.getItemKey(rawItem);
      const status = VA_RUNTIME.getStatus(key, rawItem);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = rawItem.type === "entry" ? "va-table va-entry" : "va-table";
      btn.textContent = rawItem.label || key;

      btn.dataset.key = key;
      btn.dataset.type = rawItem.type === "entry" ? "entry" : "table";
      btn.dataset.zone = rawItem.zone || "Літник";
      btn.dataset.row = "";
      btn.dataset.seat = "";
      btn.dataset.label = rawItem.label || key;
      btn.dataset.price = VA_RUNTIME.getPrice(rawItem);

      btn.style.left = (Number(rawItem.x) * align.scale + align.x) + "px";
      btn.style.top = (Number(rawItem.y) * align.scale + align.y) + "px";
      btn.style.opacity = align.opacity;

      btn.title = rawItem.type === "entry"
        ? `Вхід · місткість ${rawItem.capacity || 0}`
        : `Стіл ${rawItem.label || key} · ${rawItem.seats || 0} місць`;

      VA_SEAT_STATE.applyToElement(btn, VA_RUNTIME.selected.has(key) ? "selected" : status);

      btn.addEventListener("click", () => VA_CART.toggle(key, btn));
      seatLayer.appendChild(btn);
    });
  }
};
