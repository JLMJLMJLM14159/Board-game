// =============================================================
// data/units.js — units that live on OCTAGON spaces.
// Intentionally EMPTY for now.
// =============================================================

// Template:
//   scout_drone: {
//     id: "scout_drone",
//     name: "Scout Drone",
//     category: "military",    // one of CONFIG.unitCategories: "civilian" or "military"
//     cost: null,              // optional: overrides CONFIG.unitCosts for this unit
//     synergy: "electrical",   // optional
//     stats: {},               // e.g. { health: 3, move: 2 }
//     description: "",
//
//     // Optional: effects that happen automatically in a phase of the
//     // owner's turn ("at the beginning of your turn..."). Change `state` directly.
//     triggers: {
//       beginning(state, space) {},
//       end(state, space) {},
//     },
//   },
const UNIT_TYPES = {};
