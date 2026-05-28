// Theme packs for VA-HALL-VISUAL-FX.
// Добавлять темы можно без изменения renderer.

window.VA_THEMES = {
  opera: {
    name: "Opera",
    className: "theme-opera"
  },

  kids: {
    name: "Kids",
    className: "theme-kids"
  },

  minimal: {
    name: "Minimal SaaS",
    className: "theme-minimal"
  }
};

window.VA_applyTheme = function applyTheme(themeName) {
  const theme = window.VA_THEMES[themeName] || window.VA_THEMES.opera;

  document.body.classList.remove(
    "theme-opera",
    "theme-kids",
    "theme-minimal"
  );

  document.body.classList.add(theme.className);
  window.VA_RUNTIME.theme = themeName;
};
