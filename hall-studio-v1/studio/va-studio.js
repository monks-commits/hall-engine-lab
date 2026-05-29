window.VA_STUDIO = {
  selectedKey: null,
  selectedMeta: null,

  inspectFromElement(el) {
    this.selectedKey = el.dataset.key;
    this.selectedMeta = {
      key: el.dataset.key,
      type: el.dataset.type || "seat",
      zone: el.dataset.zone || "",
      row: el.dataset.row || "",
      seat: el.dataset.seat || "",
      label: el.dataset.label || "",
      price: Number(el.dataset.price || 0),
      status: el.dataset.status || "free"
    };
    this.renderInspector();
    this.highlightActive();
  },

  renderInspector() {
    if (!this.selectedMeta) {
      studioEmpty.classList.remove("is-hidden");
      studioInspector.classList.add("is-hidden");
      return;
    }
    const m = this.selectedMeta;
    studioEmpty.classList.add("is-hidden");
    studioInspector.classList.remove("is-hidden");
    studioKey.textContent = m.key;
    studioType.textContent = m.type;
    studioZone.textContent = m.zone || "—";
    studioRow.textContent = m.row || "—";
    studioSeat.textContent = m.label || m.seat || "—";
    studioPrice.textContent = m.price + " грн";
    studioStatus.value = m.status;
  },

  applyStatus(status) {
    if (!this.selectedKey) return;
    if (!VA_RUNTIME.config.statuses) VA_RUNTIME.config.statuses = {};

    if (status === "free") {
      delete VA_RUNTIME.config.statuses[this.selectedKey];
      VA_RUNTIME.selected.delete(this.selectedKey);
    } else {
      VA_RUNTIME.config.statuses[this.selectedKey] = status;
      VA_RUNTIME.selected.delete(this.selectedKey);
    }

    this.selectedMeta.status = status;
    VA_APP.renderCurrent();
    this.renderInspector();
    this.highlightActive();
  },

  resetStatus() { this.applyStatus("free"); },

  highlightActive() {
    document.querySelectorAll(".is-studio-active").forEach(el => el.classList.remove("is-studio-active"));
    if (!this.selectedKey) return;
    const active = document.querySelector(`[data-key="${CSS.escape(this.selectedKey)}"]`);
    if (active) active.classList.add("is-studio-active");
  },

  bind() {
    applyStatusBtn.addEventListener("click", () => this.applyStatus(studioStatus.value));
    resetStatusBtn.addEventListener("click", () => this.resetStatus());
    copyStatusesBtn.addEventListener("click", async () => {
      const txt = JSON.stringify(VA_RUNTIME.config.statuses || {}, null, 2);
      await navigator.clipboard.writeText(txt);
      alert("STATUSES COPIED");
    });
  }
};
