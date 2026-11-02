// =============================================================
// data/weapons.js — the catalogue of weapon parts, bases included.
// Intentionally EMPTY for now. Add parts to the list using the
// templates below. The classes are defined in js/parts.js.
//
// Any part (and its legendary version) can have `triggers: { eventName(ctx) {...} }`
// that fire while it's fitted to a unit; ctx.self is that unit. See js/events.js.
//
// A base's stats are the unit's STARTING stats (they replace the unit's defaults);
// every other part's stats add to or subtract from them. A unit can't carry
// two of the same attachment.
//
// Don't give parts a rarity here: each copy of a barrel, mag or
// attachment gets a random rarity (common -> legendary) when it
// appears in the market. Rarity only multiplies the stats you list in
// `rarityStats` (shown bold in the rarity colour); the rest never change.
// Bases have no rarity.
// =============================================================

const WEAPON_PARTS = partCatalogue([
  // ---- Bases ----
  // new WeaponBase({
  //   id: "plasma_pistol",
  //   name: "Plasma Pistol",
  //   cost: null,                   // optional own price; null = the game length's price for bases
  //   synergy: "thermal",           // optional: thermal / electrical / biological
  //   stats: { range: 2, damage: 2, shots: 1 },   // the unit's STARTING shooting stats
  //                                 // typed damage: thermalDamage / electricalDamage / biologicalDamage
  //   description: "",
  // }),

  // ---- Barrels, mags, muzzles and stocks ----
  // new Barrel({                    // or: new Mag({ ... }), new Muzzle({ ... }), new Stock({ ... })
  //   id: "coil_barrel",
  //   name: "Coil Barrel",
  //   synergy: "electrical",        // optional
  //   cost: null,                   // optional own price; null = the game length's price
  //   stats: { damage: 2, range: 1, movement: -1 },
  //   rarityStats: ["damage"],      // only damage is multiplied by rarity
  //   description: "",
  //
  //   // Optional: a separate version used when this part rolls legendary,
  //   // instead of multiplying by 8. Anything left out stays the same.
  //   legendary: {
  //     name: "Singularity Coil",
  //     stats: { damage: 12, range: 3, movement: 0 },
  //     description: "",
  //   },
  // }),

  // ---- Attachments ----
  // new Attachment({
  //   id: "thermal_scope",
  //   name: "Thermal Scope",
  //   synergy: "thermal",           // optional
  //   cost: null,                   // optional own price; null = the game length's price
  //   stats: {},
  //   rarityStats: [],              // optional
  //   legendary: null,              // optional
  //   description: "",
  // }),

  // ---- Support attachments (for civilian units only) ----
  // new SupportAttachment({
  //   id: "power_drill",
  //   name: "Power Drill",
  //   unitTypes: ["builder"],       // which support units can use it
  //   cost: null,                   // optional own price; null = the game length's attachment price
  //   stats: {},
  //   rarityStats: [],              // optional
  //   legendary: null,              // optional
  //   description: "",
  // }),
]);
