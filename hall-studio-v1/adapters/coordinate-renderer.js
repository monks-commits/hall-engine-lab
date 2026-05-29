window.VA_RENDERERS = window.VA_RENDERERS || {};

window.VA_RENDERERS.coordinate = {
  async load() {
    const url = VA_RUNTIME.config.hall.json;
    if (!url) return { seats: [] };
    const res = await fetch(url + "?v=" + Date.now());
    return await res.json();
  },

  render(hallData) {
    const align = VA_RUNTIME.getAlign();
    seatLayer.innerHTML = "";

    (hallData.seats || []).forEach(rawSeat => {
      const key = VA_RUNTIME.getItemKey(rawSeat);
      const status = VA_RUNTIME.getStatus(key, rawSeat);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "va-seat";
      btn.textContent = rawSeat.seat || "";

      btn.dataset.key = key;
      btn.dataset.type = "seat";
      btn.dataset.zone = rawSeat.zone || "";
      btn.dataset.row = rawSeat.row || "";
      btn.dataset.seat = rawSeat.seat || "";
      btn.dataset.label = rawSeat.seat || "";
      btn.dataset.price = VA_RUNTIME.getPrice(rawSeat);

      btn.style.left = (Number(rawSeat.x) * align.scale + align.x) + "px";
      btn.style.top = (Number(rawSeat.y) * align.scale + align.y) + "px";
      btn.style.opacity = align.opacity;

      if (rawSeat.color) btn.style.setProperty("--seat-source-color", rawSeat.color);

      VA_SEAT_STATE.applyToElement(btn, VA_RUNTIME.selected.has(key) ? "selected" : status);

      btn.addEventListener("click", e => {
        if (e.shiftKey || e.altKey) {
          VA_STUDIO.inspectFromElement(btn);
          return;
        }
        VA_CART.toggle(key, btn);
      });

      btn.addEventListener("contextmenu", e => {
        e.preventDefault();
        VA_STUDIO.inspectFromElement(btn);
      });
      seatLayer.appendChild(btn);
    });

    if (window.VA_STUDIO) VA_STUDIO.highlightActive();
  }
};
