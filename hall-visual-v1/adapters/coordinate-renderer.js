window.VA_RENDERERS = window.VA_RENDERERS || {};

window.VA_RENDERERS.coordinate = {
  render(hall) {
    const layer = document.getElementById("seatLayer");

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

      // ВАЖНО:
      // места теперь НЕ двигаем и НЕ масштабируем
      // они стоят ровно по координатам из hall.json
      btn.style.left = Number(rawSeat.x) + "px";
      btn.style.top = Number(rawSeat.y) + "px";
      btn.style.opacity = 1;

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

    if (window.VA_APP.applyBackgroundAlign) {
      window.VA_APP.applyBackgroundAlign();
    }

    window.VA_APP.updateAlignPanel();
    window.VA_CART.refresh();
  }
};
