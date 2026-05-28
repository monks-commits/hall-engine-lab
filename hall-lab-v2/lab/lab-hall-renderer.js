// Clean LAB renderer.
// Это НЕ замена рабочего universal renderer.
// Это песочница для visual FX.

window.VA_LAB_RENDERER = {
  render(root, hallSchema, state) {
    root.innerHTML = "";

    hallSchema.sections.forEach(section => {
      const sectionEl = document.createElement("section");
      sectionEl.className = "va-section";
      sectionEl.dataset.zone = section.zone;

      const title = document.createElement("h3");
      title.className = "va-section-title";
      title.textContent = section.title || section.zone;
      sectionEl.appendChild(title);

      section.rows.forEach(row => {
        const rowEl = document.createElement("div");
        rowEl.className = "va-row";

        const rowLabel = document.createElement("div");
        rowLabel.className = "va-row-label";
        rowLabel.textContent = row.row;
        rowEl.appendChild(rowLabel);

        for (let seat = 1; seat <= row.seats; seat++) {
          if ((row.aisles || []).includes(seat)) {
            const gap = document.createElement("div");
            gap.className = "va-aisle";
            rowEl.appendChild(gap);
          }

          const key = `${section.prefix}${row.row}-M${seat}`;
          const seatEl = document.createElement("button");

          seatEl.className = "va-seat";
          seatEl.type = "button";
          seatEl.textContent = seat;
          seatEl.dataset.key = key;
          seatEl.dataset.zone = section.zone;
          seatEl.dataset.row = row.row;
          seatEl.dataset.seat = seat;

          const status = state.statuses[key] || "free";
          seatEl.dataset.status = status;
          seatEl.classList.add(`va-seat--${status}`);

          if (status === "sold") {
            seatEl.disabled = true;
          }

          seatEl.addEventListener("click", () => {
            window.VA_LAB_APP.toggleSeat(key, seatEl);
          });

          rowEl.appendChild(seatEl);
        }

        sectionEl.appendChild(rowEl);
      });

      root.appendChild(sectionEl);
    });
  }
};
