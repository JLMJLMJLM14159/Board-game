// =============================================================
// config.js — tweakable numbers and lists.
// Change values here to try variants without touching the rules.
// =============================================================

const CONFIG = {
  // ---- Main board (octagon + square tiling) ----
  // The board is a grid of octagons. A square sits in each gap
  // where four octagons meet, so there are (rows-1) x (cols-1) squares.
  board: {
    octagonRows: 9,
    octagonCols: 9,
  },

  // ---- Players ----
  // PLACEHOLDER: player count, names and colours.
  players: [
    { name: "Player 1", color: "#4fc3f7" },
    { name: "Player 2", color: "#ba68c8" },
  ],

  // ---- Weapons ----
  // PLACEHOLDER: how many weapons fit on each player's board.
  weaponsPerPlayer: 3,

  // Weapon base classes. Every base in data/weapons.js must use one of these.
  weaponClasses: ["pistol", "smg", "ar", "sniper", "shotgun", "lmg"],

  // Slot types for custom attachments. A weapon has 2 attachment slots,
  // and the two attachments must be different types.
  // PLACEHOLDER: add, remove or rename freely.
  attachmentTypes: ["scope", "side", "underbarrel", "stock", "muzzle"],

  // Number of attachment slots on each weapon.
  attachmentSlots: 2,

  // ---- Synergy circle ----
  // The order matters: each element points to the next one around the
  // circle (thermal -> electrical -> biological -> thermal).
  synergyElements: [
    { id: "thermal",    name: "Thermal",    color: "#ef5350" },
    { id: "electrical", name: "Electrical", color: "#ffee58" },
    { id: "biological", name: "Biological", color: "#66bb6a" },
  ],
};
