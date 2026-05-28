window.VA_RENDERERS = window.VA_RENDERERS || {};

window.VA_RENDERERS.coordinate = {
  render(hall) {
    const layer = document.getElementById("seatLayer");
    const align = window.VA_RUNTIME.getAlign();

    layer.innerHTML = "";

    const seats = hall.seats || [];

    seats.forEach(rawSeat => {
      const key = window.VA_RUNTIME.getSeatKey(rawSeat);
      const status = window.VA_RUNTIME.getStatus(key, rawSeat);

      const btn = document.createElement("button");

      btn.type = "button";
      btn.className = "va-seat";
      btn.textContent = rawSeat.seat || "";

      btn.dataset.key = key;
      btn.dataset.zone = rawSeat.zone || "";
      btn.dataset.row = rawSeat.row || "";
      btn.dataset.seat = rawSeat.seat || "";
      btn.dataset.price = window.VA_RUNTIME.getPrice(rawSeat);

      btn.style.left = (Number(rawSeat.x) * align.scale + align.x) + "px";
      btn.style.top = (Number(rawSeat.y) * align.scale + align.y) + "px";
      btn.style.opacity = align.opacity;

      if (rawSeat.color) {
        btn.style.setProperty("--seat-source-color", rawSeat.color);
      }

      if (window.VA_RUNTIME.selected.has(key)) {
        window.VA_SEAT_STATE.applyToElement(btn, "selected");
      } else {
        window.VA_SEAT_STATE.applyToElement(btn, status);
      }

      btn.addEventListener("click", () => {
        window.VA_CART.toggle(key, btn);
      });

      layer.appendChild(btn);
    });

    window.VA_APP.updateAlignPanel();
    window.VA_CART.refresh();
  }
};
