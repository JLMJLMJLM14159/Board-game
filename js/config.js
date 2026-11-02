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
  // The game is for 2 players: Player 1 starts at the bottom, Player 2 at the top.
  players: [
    { name: "Player 1", color: "#4fc3f7" },
    { name: "Player 2", color: "#ba68c8" },
  ],

  // ---- Territory ----
  // Buildings each player starts with, one list per player. `row`/`col` pick the
  // square (squares run 0 to octagonRows-2 / octagonCols-2). Update these if the
  // board size changes. They're placed opposite each other so neither side is favoured.
  startingBuildings: [
    [{ typeId: "hq", row: 7, col: 3 }],   // Player 1: bottom edge
    [{ typeId: "hq", row: 0, col: 4 }],   // Player 2: top edge
  ],

  // How many of the 4 octagons around a building an enemy must control to capture it.
  captureThreshold: 3,

  // How many buildings each civilian unit can build per turn.
  buildsPerCivilianPerTurn: 1,

  // ---- Money ----
  // PLACEHOLDER: starting money for each player.
  startingMoney: 0,

  // Money gained at the beginning of each of your turns:
  // base + perReserveUnit for every unit you have that isn't deployed.
  income: { base: 1, perReserveUnit: 1 },

  // ---- Market ----
  // Slots in each player's market. Unlocked slots reroll at the start of
  // your main phase; locked ones keep their offer for a later turn.
  market: { parts: 5, bases: 2 },

  // Selling a stored part gives back this share of its price, rounded down.
  // PLACEHOLDER: the sell rate isn't decided yet.
  sellRate: 0.5,

  // ---- Units ----
  // Every unit in data/units.js belongs to one of these categories.
  unitCategories: ["civilian", "military"],

  // Units each player starts with, in their reserve (not deployed). List unit ids,
  // repeats allowed, e.g. ["scout_drone", "scout_drone", "medic"].
  // PLACEHOLDER: decide once units exist.
  startingUnits: [],

  // Price to buy a unit, by category. A unit can override it with its own `cost`.
  // null = not decided yet; buying is free until you set a number.
  unitCosts: {
    civilian: null,
    military: null,
  },

  // ---- Weapons ----
  // Every unit carries one weapon of its own.

  // Weapon base classes. Every base in data/weapons.js must use one of these.
  weaponClasses: ["pistol", "smg", "ar", "sniper", "shotgun", "lmg"],

  // Slot types for custom attachments. A weapon has 2 attachment slots,
  // and the two attachments must be different types.
  // PLACEHOLDER: add, remove or rename freely.
  attachmentTypes: ["scope", "side", "underbarrel", "stock", "muzzle"],

  // Number of attachment slots on each weapon.
  attachmentSlots: 2,

  // ---- Part rarity ----
  // Every weapon part except the base gets a random rarity when it
  // appears in the game. Rarity isn't printed on the part itself.
  // `multiplier` scales the part's power (1, 2, 3, 5, 8: Fibonacci).
  // `weight` is how likely each rarity is to be rolled, relative to the others.
  // `extraCost` is added to a part's market price: $1 more per step up.
  // PLACEHOLDER: the weights (odds) aren't decided yet.
  rarities: [
    { id: "common",    name: "Common",    color: "#c4c9cf", multiplier: 1, weight: 50, extraCost: 0 },
    { id: "uncommon",  name: "Uncommon",  color: "#4caf50", multiplier: 2, weight: 25, extraCost: 1 },
    { id: "rare",      name: "Rare",      color: "#2f8cff", multiplier: 3, weight: 15, extraCost: 2 },
    { id: "epic",      name: "Epic",      color: "#a64dff", multiplier: 5, weight: 7,  extraCost: 3 },
    { id: "legendary", name: "Legendary", color: "#ffc107", multiplier: 8, weight: 3,  extraCost: 4 },
  ],

  // ---- Synergy circle ----
  // The order matters: each element points to the next one around the
  // circle (thermal -> electrical -> biological -> thermal).
  synergyElements: [
    { id: "thermal",    name: "Thermal",    color: "#ef5350" },
    { id: "electrical", name: "Electrical", color: "#ffee58" },
    { id: "biological", name: "Biological", color: "#66bb6a" },
  ],
};
