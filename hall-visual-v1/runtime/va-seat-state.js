window.VA_SEAT_STATE = {
  lockedStatuses: new Set([
    "sold",
    "hold",
    "reserved",
    "disabled",
    "partner"
  ]),

  visualStatuses: new Set([
    "free",
    "selected",
    "sold",
    "hold",
    "reserved",
    "disabled",
    "invite",
    "partner"
  ]),

  getStatus(key, rawSeat = {}) {
    const cfgStatuses = window.VA_RUNTIME.config.statuses || {};
    const status = cfgStatuses[key] || rawSeat.status || "free";

    if (!this.visualStatuses.has(status)) return "free";
    return status;
  },

  isLocked(status) {
    return this.lockedStatuses.has(status);
  },

  applyToElement(el, status) {
    el.classList.remove(
      "is-free",
      "is-selected",
      "is-sold",
      "is-hold",
      "is-reserved",
      "is-disabled",
      "is-invite",
      "is-partner"
    );

    el.classList.add("is-" + status);
    el.dataset.status = status;

    el.disabled = this.isLocked(status);
  }
};
