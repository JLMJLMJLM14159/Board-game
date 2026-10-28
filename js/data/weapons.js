// =============================================================
// data/weapons.js — the catalogue of weapon parts, bases included.
// Intentionally EMPTY for now. Add parts to the list using the
// templates below. The classes are defined in js/parts.js.
//
// Don't give parts a rarity here: each copy of a barrel, mag or
// attachment gets a random rarity (common -> legendary) when it
// appears in the game, which multiplies its stats. Bases have no rarity.
// =============================================================

const WEAPON_PARTS = partCatalogue([
  // ---- Bases ----
  // new WeaponBase({
  //   id: "plasma_pistol",
  //   name: "Plasma Pistol",
  //   weaponClass: "pistol",        // one of CONFIG.weaponClasses
  //   synergy: "thermal",           // optional: thermal / electrical / biological
  //   stats: {},                    // anything you like, e.g. { damage: 2, range: 3 }
  //   description: "",
  // }),

  // ---- Barrels and mags ----
  // new Barrel({                    // or: new Mag({ ... })
  //   id: "coil_barrel",
  //   name: "Coil Barrel",
  //   synergy: "electrical",        // optional
  //   allowedClasses: null,         // optional: e.g. ["ar", "sniper"]; null = fits any base
  //   stats: {},
  //   description: "",
  // }),

  // ---- Attachments ----
  // new Attachment({
  //   id: "thermal_scope",
  //   name: "Thermal Scope",
  //   attachmentType: "scope",      // one of CONFIG.attachmentTypes
  //   synergy: "thermal",           // optional
  //   allowedClasses: null,         // optional
  //   stats: {},
  //   description: "",
  // }),
]);
