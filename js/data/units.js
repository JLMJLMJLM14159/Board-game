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
//     stats: {
//       movement: 2,           // steps per turn through shared sides (weapons can change it)
//       range: 1,              // how far it can shoot, no diagonals (weapons can change it)
//     },
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
// Weapon parts change a unit's movement or range through their own
// stats, e.g. a heavy barrel with stats: { movement: -1, range: 2 }.
const UNIT_TYPES = {};
