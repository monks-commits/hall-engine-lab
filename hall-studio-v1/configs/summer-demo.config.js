window.VA_CONFIG_SUMMER_DEMO = {
  id: "summer-demo",
  venueTitle: "Summer Demo · Tables / Letnik",
  theme: "club",
  preset: "club",
  glow: true,
  cartAnimation: true,
  renderer: "tables",
  hall: {
    width: 1100,
    height: 760,
    background: "",
    json: "",
    align: { scale: 1, x: 0, y: 0, opacity: 1 },
    tables: [
      { id: "T1", label: "1", x: 180, y: 160, seats: 4, deposit: 800 },
      { id: "T2", label: "2", x: 360, y: 160, seats: 4, deposit: 800 },
      { id: "T3", label: "3", x: 540, y: 160, seats: 6, deposit: 1200 },
      { id: "T4", label: "4", x: 720, y: 160, seats: 6, deposit: 1200 },
      { id: "T5", label: "5", x: 230, y: 330, seats: 4, deposit: 900 },
      { id: "T6", label: "6", x: 430, y: 330, seats: 4, deposit: 900 },
      { id: "T7", label: "7", x: 630, y: 330, seats: 8, deposit: 1600 },
      { id: "ENTRY", label: "Вхід", x: 420, y: 560, type: "entry", price: 250, capacity: 120 }
    ]
  },
  statuses: {
    "T2": "reserved",
    "T4": "sold"
  }
};
