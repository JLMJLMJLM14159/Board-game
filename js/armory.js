// =============================================================
// armory.js — working with a whole WEAPON. Pure logic, no drawing.
// The rules for each kind of part live in their classes (parts.js);
// this file just asks the right part. Every unit carries one weapon.
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

  // `unit` is the unit carrying the weapon (some parts only fit some units).
  canInstall(weapon, partId, place, unit) {
    const part = WEAPON_PARTS[partId];
    return part ? part.canInstallOn(weapon, place, unit) : { ok: false, reason: "Unknown part." };
  },

  // Returns a NEW weapon with this part instance in the place, replacing what was there.
  install(weapon, instance, place) {
    return WEAPON_PARTS[instance.partId].installOn(weapon, instance, place);
  },
};
