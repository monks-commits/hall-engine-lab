window.VA_CONFIG_LOADER = {
  getVenueIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("venue") || window.VA_VENUES.current || "client-x";
  },

  getConfigByVenueId(venueId) {
    const item = window.VA_VENUES.items[venueId] || window.VA_VENUES.items["client-x"];
    const cfg = window[item.configKey];
    if (!cfg) throw new Error("Config not found: " + item.configKey);
    return structuredClone(cfg);
  },

  setVenueUrl(venueId) {
    const url = new URL(window.location.href);
    url.searchParams.set("venue", venueId);
    history.replaceState(null, "", url.toString());
  }
};
