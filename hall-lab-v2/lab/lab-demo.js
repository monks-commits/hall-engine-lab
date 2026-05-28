const LAB_HALL_SCHEMA = {
  sections: [
    {
      title: "Партер",
      zone: "Партер",
      prefix: "P",
      rows: [
        { row: 1, seats: 14, aisles: [8] },
        { row: 2, seats: 16, aisles: [9] },
        { row: 3, seats: 18, aisles: [10] },
        { row: 4, seats: 18, aisles: [10] },
        { row: 5, seats: 20, aisles: [11] }
      ]
    },
    {
      title: "Амфітеатр",
      zone: "Амфітеатр",
      prefix: "A",
      rows: [
        { row: 1, seats: 12, aisles: [7] },
        { row: 2, seats: 14, aisles: [8] },
        { row: 3, seats: 14, aisles: [8] }
      ]
    }
  ]
};

window.VA_LAB_APP = {
  selected: new Map(),

  state: {
    statuses: {
      "P1-M3": "sold",
      "P1-M4": "sold",
      "P2-M7": "hold",
      "P3-M12": "reserved",
      "A2-M5": "sold"
    }
  },

  init() {
    VA_applyTheme(window.VA_RUNTIME.theme);
    VA_GLOW.refresh();

    this.bindControls();
    this.render();
  },

  bindControls() {
    document.getElementById("themeSelect").addEventListener("change", e => {
      VA_applyTheme(e.target.value);
      VA_RUNTIME.set({ theme: e.target.value });
    });

    document.getElementById("glowToggle").addEventListener("change", e => {
      VA_RUNTIME.set({ glow: e.target.checked });
    });

    document.getElementById("cartFxToggle").addEventListener("change", e => {
      VA_RUNTIME.set({ cartAnimation: e.target.checked });
    });
  },

  render() {
    VA_LAB_RENDERER.render(
      document.getElementById("hallRoot"),
      LAB_HALL_SCHEMA,
      this.state
    );
    this.refreshCart();
  },

  toggleSeat(key, seatEl) {
    const status = seatEl.dataset.status;

    if (status === "sold") return;
    if (status === "hold") return;
    if (status === "reserved") return;

    if (this.selected.has(key)) {
      this.selected.delete(key);
      seatEl.classList.remove("va-seat--selected");
      seatEl.classList.add("va-seat--free");
      seatEl.dataset.status = "free";
    } else {
      this.selected.set(key, {
        key,
        zone: seatEl.dataset.zone,
        row: seatEl.dataset.row,
        seat: seatEl.dataset.seat,
        price: this.getPrice(seatEl.dataset.zone)
      });

      seatEl.classList.remove("va-seat--free");
      seatEl.classList.add("va-seat--selected");
      seatEl.dataset.status = "selected";

      VA_CART_FX.fly(seatEl);
    }

    this.refreshCart();
  },

  getPrice(zone) {
    if (zone === "Партер") return 350;
    if (zone === "Амфітеатр") return 280;
    return 250;
  },

  refreshCart() {
    const list = document.getElementById("cartList");
    const badge = document.getElementById("cartBadge");
    const items = Array.from(this.selected.values());

    badge.textContent = String(items.length);

    if (!items.length) {
      list.innerHTML = '<div class="va-empty">Оберіть місця на схемі</div>';
      return;
    }

    list.innerHTML = items.map(item => `
      <div class="va-cart-item">
        <div>
          <strong>${item.zone}</strong>
          <span>ряд ${item.row}, місце ${item.seat}</span>
        </div>
        <b>${item.price} грн</b>
      </div>
    `).join("");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  window.VA_LAB_APP.init();
});
