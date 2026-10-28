// =============================================================
// armory.js — rules for BUILDING a weapon from a base and parts.
// Pure logic, no drawing. The catalogue lives in data/weapons.js.
//
// A weapon looks like:
//   {
//     baseId: "plasma_pistol" | null,
//     barrel: partId | null,
//     mag: partId | null,
//     attachments: [partId | null, partId | null],
//   }
// =============================================================

const Armory = {
  createEmptyWeapon() {
    return {
      baseId: null,
      barrel: null,
      mag: null,
      attachments: new Array(CONFIG.attachmentSlots).fill(null),
    };
  },

  isEmpty(weapon) {
    return weapon.baseId === null;
  },

  base(weapon) {
    return weapon.baseId ? WEAPON_BASES[weapon.baseId] : null;
  },

  // Every installed part's definition (not including the base).
  parts(weapon) {
    return [weapon.barrel, weapon.mag, ...weapon.attachments]
      .filter(Boolean)
      .map((id) => WEAPON_PARTS[id]);
  },

  // Synergy counts across the base and all parts.
  synergy(weapon) {
    return Synergy.tally([Armory.base(weapon), ...Armory.parts(weapon)]);
  },

  // ---- Validation: each returns { ok: true } or { ok: false, reason } ----

  // PLACEHOLDER RULE: a base can only go into an empty weapon slot.
  canSetBase(weapon, baseId) {
    if (!WEAPON_BASES[baseId]) return { ok: false, reason: "Unknown base." };
    if (!Armory.isEmpty(weapon)) return { ok: false, reason: "This weapon already has a base." };
    return { ok: true };
  },

  canAddPart(weapon, partId) {
    const part = WEAPON_PARTS[partId];
    if (!part) return { ok: false, reason: "Unknown part." };

    const base = Armory.base(weapon);
    if (!base) return { ok: false, reason: "Add a base first." };

    if (part.allowedClasses && !part.allowedClasses.includes(base.weaponClass)) {
      return { ok: false, reason: `${part.name} doesn't fit a ${base.weaponClass}.` };
    }

    if (part.slot === "barrel" || part.slot === "mag") {
      // PLACEHOLDER RULE: parts can't be swapped out once installed.
      if (weapon[part.slot]) return { ok: false, reason: `This weapon already has a ${part.slot}.` };
      return { ok: true };
    }

    if (part.slot === "attachment") {
      if (!weapon.attachments.includes(null)) {
        return { ok: false, reason: "Both attachment slots are full." };
      }
      // The two attachments must be different types (e.g. scope + side, not scope + scope).
      const takenTypes = weapon.attachments.filter(Boolean).map((id) => WEAPON_PARTS[id].attachmentType);
      if (takenTypes.includes(part.attachmentType)) {
        return { ok: false, reason: `This weapon already has a ${part.attachmentType} attachment.` };
      }
      return { ok: true };
    }

    return { ok: false, reason: `Unknown slot "${part.slot}".` };
  },

  // ---- Changes: return a NEW weapon, never edit the old one ----

  withBase(weapon, baseId) {
    return { ...weapon, baseId };
  },

  withPart(weapon, partId) {
    const part = WEAPON_PARTS[partId];
    if (part.slot === "attachment") {
      const attachments = [...weapon.attachments];
      attachments[attachments.indexOf(null)] = partId;
      return { ...weapon, attachments };
    }
    return { ...weapon, [part.slot]: partId };
  },
};
