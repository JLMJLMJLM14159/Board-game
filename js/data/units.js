// =============================================================
// data/units.js — units that live on OCTAGON spaces.
// =============================================================

// Template:
//   scout_drone: {
//     id: "scout_drone",
//     name: "Scout Drone",
//     category: "military",    // "military" units take control of octagons; "civilian" ones don't
//     icon: "troop",           // board icon, from js/icons.js
//     cost: null,              // optional own price (number, or { quick, standard, long });
//                              // otherwise CONFIG.gameLengths[...].unitCosts
//     synergy: "electrical",   // optional
//     stats: {                 // defaults; a weapon base replaces any it lists, parts add/subtract
//       health: 5,             // max health (needed: a unit at 0 health is removed)
//       movement: 2,           // steps per turn through shared sides
//       melee: 1,              // melee damage on an adjacent octagon (works without a weapon)
//     },
//     // Shooting stats (range, damage, thermalDamage / electricalDamage /
//     // biologicalDamage, shots) come from the weapon base: no base, no shooting.
//     // Optional special abilities:
//     //   build: { perTurn: 1 }            builds on squares touching it
//     //   heal:  { perTurn: 1, range: 1 }  restores a unit (or itself) to full health
//     abilities: {},
//     description: "",
//
//     // Optional: reactions to anything that happens. See js/events.js for every
//     // event and what ctx holds. Triggers judge events relative to their owner:
//     triggers: {
//       turnStart(ctx) { if (ctx.ownersTurn) { /* start of YOUR turn */ } },
//       unitDied(ctx)  { if (!ctx.mine(ctx.unit)) { /* an ENEMY unit died */ } },
//     },
//   },
//
// Weapon parts change a unit's stats through their own stats with the
// same names, e.g. a heavy barrel with stats: { movement: -1, range: 2 }.
// A weapon base's stats are the STARTING values instead, e.g. a pistol base
// with stats: { range: 2, damage: 2, shots: 1 }.
//
// PLACEHOLDER: all the stats below are starting guesses to playtest with (may change later).
const UNIT_TYPES = {
  troop: {
    id: "troop",
    name: "Troop",
    category: "military",
    icon: "troop",
    stats: { health: 5, movement: 2, melee: 1 },
    abilities: {},
    description: "Front-line soldier. Takes and holds ground.",
  },

  builder: {
    id: "builder",
    name: "Builder",
    category: "civilian",
    icon: "builder",
    stats: { health: 3, movement: 2, melee: 1 },
    abilities: { build: { perTurn: 1 } },
    description: "Builds one building per turn on a square next to it.",
  },

  medic: {
    id: "medic",
    name: "Medic",
    category: "civilian",
    icon: "medic",
    stats: { health: 3, movement: 2, melee: 1 },
    // Heals one of your units within 1 step (or itself), during Unit control.
    abilities: { heal: { perTurn: 1, range: 1 } },
    description: "Restores one unit (or itself) to full health each turn.",
  },
};
