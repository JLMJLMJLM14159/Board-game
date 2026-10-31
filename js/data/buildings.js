// =============================================================
// data/buildings.js — buildings that live on SQUARE spaces.
// Each square touches 4 octagons. A building is captured when an
// enemy controls 3 of them (CONFIG.captureThreshold).
// =============================================================

// Template:
//   field_hospital: {
//     id: "field_hospital",
//     name: "Field Hospital",
//     deployable: false,       // can units be deployed onto the octagons around it?
//     buildable: true,         // can players build it? (false for the HQ)
//     cost: null,              // null = price not decided yet (free for now)
//     synergy: "biological",   // optional
//     stats: {},
//     description: "",
//
//     // Optional: effects that happen automatically in a phase of the
//     // owner's turn, e.g. healing nearby units. Change `state` directly.
//     triggers: {
//       beginning(state, space) {},
//       end(state, space) {},
//     },
//   },
const BUILDING_TYPES = {
  hq: {
    id: "hq",
    name: "HQ",
    deployable: true,
    buildable: false,
    cost: null,
    stats: {},
    description: "Your headquarters. Units can be deployed around it.",
  },
};
