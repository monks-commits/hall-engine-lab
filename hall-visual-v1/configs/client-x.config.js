window.VA_CONFIG = {
  venueTitle: "Client X · Visual FX Engine",

  theme: "opera",
  preset: "theatre",

  glow: true,
  cartAnimation: true,

  renderer: "coordinate",

  hall: {
    width: 1200,
    height: 1400,

    background:
      "https://monks-commits.github.io/ticketing-core/site-project/images/client-x-hall.png",

    json:
      "https://raw.githubusercontent.com/monks-commits/ticketing-core/main/data/hall/client-x.json",

    align: {
      scale: 0.85,
      x: 15,
      y: 70,
      opacity: 0.75
    }
  },

  // Демо-слой статусов. Позже сюда можно подать Supabase statuses.
  statuses: {
    // "P1-M3": "sold",
    // "P2-M7": "hold",
    // "P3-M12": "reserved",
    // "A1-M4": "invite",
    // "B2-M8": "partner"
  }
};
