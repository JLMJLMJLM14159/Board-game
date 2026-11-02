// =============================================================
// data/units.js — units that live on OCTAGON spaces.
// =============================================================

// Template:
//   scout_drone: {
//     id: "scout_drone",
//     name: "Scout Drone",
//     category: "military",    // "military" units take control of octagons; "civilian" ones don't
//     icon: "troop",           // board icon, from js/icons.js
//     cost: null,              // optional: overrides CONFIG.unitCosts for this unit
//     synergy: "electrical",   // optional
//     stats: {                 // weapons can raise or lower any of these
//       health: 5,             // max health (needed: a unit at 0 health is removed)
//       movement: 2,           // steps per turn through shared sides
//       range: 1,              // how far it can shoot, no diagonals
//       damage: 1,             // damage per shot
//       shots: 1,              // shots per turn
//     },
//     // Optional special abilities:
//     //   build: { perTurn: 1 }            builds on squares touching it
//     //   heal:  { perTurn: 1, range: 1 }  restores a unit (or itself) to full health
//     abilities: {},
//     description: "",
//
//     // Optional: effects that happen automatically in a phase of the
//     // owner's turn ("at the beginning of your turn..."). Change `state` directly.
//     triggers: {
//       beginning(state, space) {},
//       end(state, space) {},
//     },
//   },
//
// Weapon parts change a unit's stats through their own stats with the
// same names, e.g. a heavy barrel with stats: { movement: -1, range: 2 }.
//
// PLACEHOLDER: all the stats below are starting guesses to playtest with.
const UNIT_TYPES = {
  troop: {
    id: "troop",
    name: "Troop",
    category: "military",
    icon: "troop",
    stats: { health: 5, movement: 2, range: 2, damage: 2, shots: 1 },
    abilities: {},
    description: "Front-line soldier. Takes and holds ground.",
  },

  builder: {
    id: "builder",
    name: "Builder",
    category: "civilian",
    icon: "builder",
    stats: { health: 3, movement: 2, range: 0, damage: 0, shots: 0 },
    abilities: { build: { perTurn: 1 } },
    description: "Builds one building per turn on a square next to it.",
  },

  medic: {
    id: "medic",
    name: "Medic",
    category: "civilian",
    icon: "medic",
    stats: { health: 3, movement: 2, range: 0, damage: 0, shots: 0 },
    // PLACEHOLDER RULE: heals one of your units within 1 step (or itself).
    abilities: { heal: { perTurn: 1, range: 1 } },
    description: "Restores one unit (or itself) to full health each turn.",
  },
};
