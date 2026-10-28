// =============================================================
// armory.js — working with a whole WEAPON. Pure logic, no drawing.
// The rules for each kind of part live in their classes (parts.js);
// this file just asks the right part.
//
// A weapon looks like (every filled slot is a part instance):
//   {
//     base: { partId, rarity: null } | null,
//     barrel: { partId, rarity } | null,
//     mag: { partId, rarity } | null,
//     attachments: [{ partId, rarity } | null, { partId, rarity } | null],
//   }
// =============================================================

const Armory = {
  createEmptyWeapon() {
    return {
      base: null,
      barrel: null,
      mag: null,
      attachments: new Array(CONFIG.attachmentSlots).fill(null),
    };
  },

  isEmpty(weapon) {
    return weapon.base === null;
  },

  // The base's class object (a WeaponBase), or null.
  base(weapon) {
    return weapon.base ? WEAPON_PARTS[weapon.base.partId] : null;
  },

  // Every installed part instance, base first.
  installed(weapon) {
    return [weapon.base, weapon.barrel, weapon.mag, ...weapon.attachments].filter(Boolean);
  },

  canInstall(weapon, partId) {
    const part = WEAPON_PARTS[partId];
    return part ? part.canInstallOn(weapon) : { ok: false, reason: "Unknown part." };
  },

  // Creates a new copy of the part (rolling its rarity, if it has one)
  // and returns a NEW weapon with it installed.
  install(state, weapon, partId) {
    const part = WEAPON_PARTS[partId];
    return part.installOn(weapon, part.createInstance(state));
  },
};
