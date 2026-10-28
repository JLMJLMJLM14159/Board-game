// =============================================================
// data/weapons.js — the catalogue of weapon bases and parts.
// Intentionally EMPTY for now. Add entries using the templates below.
// =============================================================

// Weapon bases. Template:
//   plasma_pistol: {
//     id: "plasma_pistol",
//     name: "Plasma Pistol",
//     weaponClass: "pistol",        // one of CONFIG.weaponClasses
//     synergy: "thermal",           // optional: a CONFIG.synergyElements id
//     stats: {},                    // anything you like, e.g. { damage: 2, range: 3 }
//     description: "",
//   },
const WEAPON_BASES = {};

// Parts that go on a base. Don't give parts a rarity here: each copy gets
// a random rarity (common -> legendary) when it appears in the game, which
// multiplies its stats. See CONFIG.rarities.
//
// Every part has a `slot`:
//   "barrel"      — one per weapon
//   "mag"         — one per weapon
//   "attachment"  — up to CONFIG.attachmentSlots per weapon, each a different attachmentType
//
// Template:
//   coil_barrel: {
//     id: "coil_barrel",
//     name: "Coil Barrel",
//     slot: "barrel",
//     attachmentType: null,         // required for slot "attachment", e.g. "scope"
//     synergy: "electrical",        // optional
//     allowedClasses: null,         // optional: e.g. ["ar", "sniper"]; null = fits any base
//     stats: {},
//     description: "",
//   },
const WEAPON_PARTS = {};
