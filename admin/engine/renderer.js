// engine/renderer.js

export function renderHall(container, hallConfig, state = {}, options = {}) {
  if (!hallConfig?.rows) {
    container.innerHTML = '<p>Hall config error</p>';
    return;
  }

  container.innerHTML = '';

  const selected = new Set();

  hallConfig.rows.forEach((rowCfg) => {
    const rowNum = rowCfg.row;
    const seatsCount = rowCfg.seats;
    const aisles = rowCfg.aisles || [];
    const offset = rowCfg.offset || 0;

    const rowEl = document.createElement('div');
    rowEl.className = 'hall-row';

    const label = document.createElement('div');
    label.className = 'row-label';
    label.textContent = rowNum;
    rowEl.appendChild(label);

    const seatsWrap = document.createElement('div');
    seatsWrap.className = 'hall-row-seats';

    // offset
    for (let i = 0; i < offset; i++) {
      const spacer = document.createElement('div');
      spacer.className = 'seat spacer';
      seatsWrap.appendChild(spacer);
    }

    for (let s = 1; s <= seatsCount; s++) {
      const seatId = `P${rowNum}-M${s}`;

      const btn = document.createElement('button');
      btn.className = 'seat';
      btn.dataset.seatId = seatId;
      btn.textContent = s;

      const st = state[seatId];

      if (st === 'taken') {
        btn.classList.add('taken');
        btn.disabled = true;
      } else {
        btn.classList.add('free');
      }

      // 🔥 внешняя логика (цены, запреты и т.д.)
      if (options.getSeatMeta) {
        const meta = options.getSeatMeta({ row: rowNum, seat: s }) || {};

        if (meta.price) {
          btn.title = `Ряд ${rowNum}, місце ${s} — ${meta.price} грн`;
        }

        if (meta.disabled) {
          btn.disabled = true;
        }

        if (meta.className) {
          btn.classList.add(meta.className);
        }
      }

      // click
      btn.addEventListener('click', () => {
        if (btn.disabled) return;

        if (btn.classList.contains('selected')) {
          btn.classList.remove('selected');
          selected.delete(seatId);
        } else {
          btn.classList.add('selected');
          selected.add(seatId);
        }

        options.onSelect?.(Array.from(selected));
      });

      seatsWrap.appendChild(btn);

      // aisle
      if (aisles.includes(s)) {
        const aisle = document.createElement('div');
        aisle.className = 'aisle';
        seatsWrap.appendChild(aisle);
      }
    }

    rowEl.appendChild(seatsWrap);
    container.appendChild(rowEl);

    if (rowCfg.gapAfter) {
      const gap = document.createElement('div');
      gap.className = 'hall-row-gap';
      container.appendChild(gap);
    }
  });
}
