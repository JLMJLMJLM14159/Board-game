// =============================================================
// armory.js — rules for BUILDING a weapon from a base and parts.
// Pure logic, no drawing. The catalogue lives in data/weapons.js.
//
// A part in play is a PART INSTANCE: the catalogue entry plus the
// rarity it was rolled with when it appeared in the game:
//   { partId: "coil_barrel", rarity: "epic" }
//
// A weapon looks like:
//   {
//     baseId: "plasma_pistol" | null,   // bases have no rarity
//     barrel: partInstance | null,
//     mag: partInstance | null,
//     attachments: [partInstance | null, partInstance | null],
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

  // A part appearing in the game: rolls its random rarity.
  createPartInstance(state, partId) {
    return { partId, rarity: Rarity.roll(state) };
  },

  isEmpty(weapon) {
    return weapon.baseId === null;
  },

  base(weapon) {
    return weapon.baseId ? WEAPON_BASES[weapon.baseId] : null;
  },

  // Every installed part instance (not including the base).
  partInstances(weapon) {
    return [weapon.barrel, weapon.mag, ...weapon.attachments].filter(Boolean);
  },

  // Every installed part's catalogue definition (not including the base).
  parts(weapon) {
    return Armory.partInstances(weapon).map((p) => WEAPON_PARTS[p.partId]);
  },

  // A part instance's stats with its rarity multiplier applied to every number.
  // PLACEHOLDER RULE: assumes the multiplier scales all of a part's numeric stats.
  partStats(instance) {
    const m = Rarity.multiplier(instance.rarity);
    const stats = {};
    for (const [key, value] of Object.entries(WEAPON_PARTS[instance.partId].stats || {})) {
      stats[key] = typeof value === "number" ? value * m : value;
    }
    return stats;
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
      const takenTypes = weapon.attachments.filter(Boolean).map((p) => WEAPON_PARTS[p.partId].attachmentType);
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

  withPart(weapon, instance) {
    const part = WEAPON_PARTS[instance.partId];
    if (part.slot === "attachment") {
      const attachments = [...weapon.attachments];
      attachments[attachments.indexOf(null)] = instance;
      return { ...weapon, attachments };
    }
    return { ...weapon, [part.slot]: instance };
  },
};
