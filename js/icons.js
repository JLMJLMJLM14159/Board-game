// =============================================================
// icons.js — simple board icons, drawn on a 24 x 24 grid.
// Units and buildings pick one with `icon: "<name>"` in js/data/.
// Each icon is a list of SVG paths; `fill: true` fills them,
// otherwise they're drawn as lines.
// =============================================================

const ICONS = {
  // Crosshair
  troop: {
    paths: ["M12 3v5M12 16v5M3 12h5M16 12h5", "M12 6.5a5.5 5.5 0 1 0 0.01 0"],
  },
  // Hard hat
  builder: {
    paths: ["M3 18h18", "M5 18v-2a7 7 0 0 1 14 0v2", "M10 9.5V6h4v3.5"],
  },
  // Medical cross
  medic: {
    paths: ["M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z"],
    fill: true,
  },
  // Flag
  hq: {
    paths: ["M6 21V3", "M6 4h11l-3 4 3 4H6"],
  },
};
