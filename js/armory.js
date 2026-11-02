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
//     muzzle: { partId, rarity } | null,
//     stock: { partId, rarity } | null,
//     attachments: [{ partId, rarity } | null, { partId, rarity } | null],
//   }
// =============================================================

const Armory = {
  // The fixed slots every weapon has, in order. Attachments come after these.
  FIXED_PLACES: ["base", "barrel", "mag", "muzzle", "stock"],

  createEmptyWeapon() {
    const weapon = Object.fromEntries(Armory.FIXED_PLACES.map((place) => [place, null]));
    weapon.attachments = new Array(CONFIG.attachmentSlots).fill(null);
    return weapon;
  },

  // Every place on a weapon: the fixed slots, then attachment slot numbers.
  places(weapon) {
    return [...Armory.FIXED_PLACES, ...weapon.attachments.map((_, i) => i)];
  },

  // The part instance in a place, or null.
  at(weapon, place) {
    return (typeof place === "number" ? weapon.attachments[place] : weapon[place]) || null;
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
    return Armory.places(weapon).map((place) => Armory.at(weapon, place)).filter(Boolean);
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
