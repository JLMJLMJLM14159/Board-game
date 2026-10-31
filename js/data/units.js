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
//     stats: {                 // weapons can raise or lower any of these
//       health: 5,             // max health (needed: a unit at 0 health is removed)
//       movement: 2,           // steps per turn through shared sides
//       range: 1,              // how far it can shoot, no diagonals
//       damage: 1,             // damage per shot
//       shots: 1,              // shots per turn
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
// Weapon parts change a unit's stats through their own stats with the
// same names, e.g. a heavy barrel with stats: { movement: -1, range: 2 }.
const UNIT_TYPES = {};
