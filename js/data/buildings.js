// =============================================================
// data/buildings.js — buildings that live on SQUARE spaces.
// A square touches 4 octagons. A building is captured when an enemy controls
// a majority (3) of them for a full round (see territory.js).
// =============================================================

// Template:
//   field_hospital: {
//     id: "field_hospital",
//     name: "Field Hospital",
//     icon: "medic",           // board icon, from js/icons.js
//     deployable: false,       // can units be deployed onto the octagons around it?
//     buildable: true,         // can builders build it? (false for the HQ)
//     capturingWins: false,    // does capturing it win the game? (true for the HQ)
//     cost: null,              // optional own price; null = the game length's building price
//     synergy: "biological",   // optional
//     stats: {},
//     description: "",
//
//     // Optional: effects that happen automatically at the beginning/end of EACH
//     // turn (both players'), e.g. healing nearby units. Change `state` directly.
//     triggers: {
//       beginning(state, space) {},
//       end(state, space) {},
//     },
//   },
const BUILDING_TYPES = {
  hq: {
    id: "hq",
    name: "HQ",
    icon: "hq",
    deployable: true,
    buildable: false,
    capturingWins: true,
    cost: null,
    stats: {},
    description: "Your headquarters. Units deploy around it. Lose it and you lose the game.",
  },
};
