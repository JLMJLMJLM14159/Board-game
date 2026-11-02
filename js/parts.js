// =============================================================
// parts.js — the CLASSES for weapon parts. Pure logic, no drawing.
//
//   WeaponPart                 any part: id, name, synergy, stats
//   ├── WeaponBase             the weapon's class (pistol, ar...). No rarity.
//   └── CustomPart             random rarity that multiplies only the stats
//       │                      listed in rarityStats; optional separate
//       │                      legendary version; can be limited to some
//       │                      weapon classes
//       ├── Barrel             one per weapon
//       ├── Mag                one per weapon
//       ├── Attachment         up to 2 per weapon, each a different type
//       └── SupportAttachment  for support (civilian) units only, e.g. a
//                              Builder's tool kit; lists which unit types it fits
//
// Military units carry a full weapon. Support units only have the 2
// attachment slots, and only take SupportAttachments made for their type.
//
// A part goes into a PLACE on a weapon: "base", "barrel", "mag", or an
// attachment slot number (0, 1). Putting a part into a filled place
// replaces the part that was there.
//
// These classes describe part TYPES (catalogue entries in data/weapons.js).
// A part actually in play is plain data, a PART INSTANCE:
//   { partId: "coil_barrel", rarity: "epic" }     (rarity is null for bases)
// The game state only holds plain data so it can be copied for undo;
// look up the class with WEAPON_PARTS[instance.partId].
//
// Every check returns { ok: true } or { ok: false, reason }.
// =============================================================

class WeaponPart {
  constructor({ id, name, synergy = null, cost = null, stats = {}, description = "", triggers = {} }) {
    if (!id || !name) throw new Error("Every weapon part needs an id and a name.");
    if (synergy && !Synergy.get(synergy)) throw new Error(`${id}: unknown synergy "${synergy}".`);
    this.id = id;
    this.name = name;
    this.synergy = synergy;
    this.cost = cost; // own market price (number, or one per game length); null = use the game length's price
    this.stats = stats;
    this.description = description;
    this.triggers = triggers; // reacts to game events, see js/events.js
  }

  // Which key of the weapon this part goes in. Each subclass sets this.
  get slot() {
    throw new Error(`${this.constructor.name} must define a slot.`);
  }

  // The places on a weapon this part could go.
  places(weapon) {
    return [this.slot];
  }

  // The part instance currently in a place, or null.
  occupant(weapon, place) {
    return weapon[place];
  }

  // A copy of this part appearing in the game.
  createInstance(state) {
    return { partId: this.id, rarity: null };
  }

  // The details that apply to one copy of this part. CustomPart swaps in
  // the separate legendary version when there is one.
  versionFor(instance) {
    return { name: this.name, stats: this.stats, description: this.description, rarityStats: [], triggers: this.triggers };
  }

  nameFor(instance) {
    return this.versionFor(instance).name;
  }

  // The stats rarity multiplies for this copy (shown bold in the rarity colour).
  scaledStatsFor(instance) {
    return instance.rarity ? this.versionFor(instance).rarityStats : [];
  }

  // This copy's stats: only the stats listed in rarityStats are multiplied.
  statsFor(instance) {
    const scaled = this.scaledStatsFor(instance);
    const m = scaled.length ? Rarity.multiplier(instance.rarity) : 1;
    const stats = {};
    for (const [key, value] of Object.entries(this.versionFor(instance).stats)) {
      stats[key] = scaled.includes(key) ? value * m : value;
    }
    return stats;
  }

  // Can this kind of part go on this unit at all? Ordinary weapon parts are
  // for military units only.
  checkUnit(unit) {
    if (unit && Units.isCivilian(unit)) return { ok: false, reason: "Support units only take their own attachments." };
    return { ok: true };
  }

  canInstallOn(weapon, place, unit) {
    const fitsUnit = this.checkUnit(unit);
    if (!fitsUnit.ok) return fitsUnit;
    return this.places(weapon).includes(place) ? { ok: true } : { ok: false, reason: "That part doesn't go there." };
  }

  // Returns a NEW weapon with the instance in the place (replacing what was there).
  installOn(weapon, instance, place) {
    return { ...weapon, [place]: instance };
  }
}

class WeaponBase extends WeaponPart {
  constructor(def) {
    super(def);
    if (!CONFIG.weaponClasses.includes(def.weaponClass)) {
      throw new Error(`${def.id}: weaponClass must be one of ${CONFIG.weaponClasses.join(", ")}.`);
    }
    this.weaponClass = def.weaponClass;
  }

  get slot() {
    return "base";
  }

  // A base can replace another only if every part already on the weapon fits it.
  canInstallOn(weapon, place, unit) {
    const ok = super.canInstallOn(weapon, place, unit);
    if (!ok.ok) return ok;
    for (const instance of [weapon.barrel, weapon.mag, ...weapon.attachments].filter(Boolean)) {
      const part = WEAPON_PARTS[instance.partId];
      if (part.allowedClasses && !part.allowedClasses.includes(this.weaponClass)) {
        return { ok: false, reason: `${part.nameFor(instance)} doesn't fit a ${this.weaponClass}.` };
      }
    }
    return { ok: true };
  }
}

// Anything that customises a base.
class CustomPart extends WeaponPart {
  constructor(def) {
    super(def);
    this.allowedClasses = def.allowedClasses ?? null; // null = fits any base

    // Only these stats are multiplied by rarity. Every other stat stays as written.
    this.rarityStats = def.rarityStats ?? [];
    for (const key of this.rarityStats) {
      if (typeof this.stats[key] !== "number") throw new Error(`${def.id}: rarityStats "${key}" isn't a number in stats.`);
    }

    // Optional separate legendary version: { name?, stats?, description? }.
    // A copy that rolls legendary uses it as written instead of multiplying by 8.
    this.legendary = def.legendary ?? null;
  }

  // Rolls this copy's random rarity. Called when the part appears in the market.
  createInstance(state) {
    return { partId: this.id, rarity: Rarity.roll(state) };
  }

  versionFor(instance) {
    if (instance.rarity === "legendary" && this.legendary) {
      return {
        name: this.legendary.name ?? this.name,
        stats: this.legendary.stats ?? this.stats,
        description: this.legendary.description ?? this.description,
        rarityStats: [], // the legendary version's numbers are already final
        triggers: this.legendary.triggers ?? this.triggers,
      };
    }
    return { name: this.name, stats: this.stats, description: this.description, rarityStats: this.rarityStats, triggers: this.triggers };
  }

  // Needs a base, and one of an allowed class.
  checkFitsBase(weapon) {
    if (!weapon.base) return { ok: false, reason: "Add a base first." };
    const weaponClass = WEAPON_PARTS[weapon.base.partId].weaponClass;
    if (this.allowedClasses && !this.allowedClasses.includes(weaponClass)) {
      return { ok: false, reason: `${this.name} doesn't fit a ${weaponClass}.` };
    }
    return { ok: true };
  }

  canInstallOn(weapon, place, unit) {
    const fitsUnit = this.checkUnit(unit);
    if (!fitsUnit.ok) return fitsUnit;
    const fits = this.checkFitsBase(weapon);
    return fits.ok ? super.canInstallOn(weapon, place, unit) : fits;
  }
}

class Barrel extends CustomPart {
  get slot() {
    return "barrel";
  }
}

class Mag extends CustomPart {
  get slot() {
    return "mag";
  }
}

class Attachment extends CustomPart {
  constructor(def) {
    super(def);
    if (!CONFIG.attachmentTypes.includes(def.attachmentType)) {
      throw new Error(`${def.id}: attachmentType must be one of ${CONFIG.attachmentTypes.join(", ")}.`);
    }
    this.attachmentType = def.attachmentType;
  }

  get slot() {
    return "attachments";
  }

  // Any attachment slot, by number.
  places(weapon) {
    return weapon.attachments.map((_, i) => i);
  }

  occupant(weapon, place) {
    return weapon.attachments[place];
  }

  canInstallOn(weapon, place, unit) {
    const fitsUnit = this.checkUnit(unit);
    if (!fitsUnit.ok) return fitsUnit;
    const fits = this.checkFitsBase(weapon);
    if (!fits.ok) return fits;
    if (!this.places(weapon).includes(place)) return { ok: false, reason: "No such attachment slot." };
    // The attachments must be different types (e.g. scope + side, not scope + scope),
    // ignoring the one being replaced.
    const others = weapon.attachments.filter((p, i) => p && i !== place);
    if (others.some((p) => WEAPON_PARTS[p.partId].attachmentType === this.attachmentType)) {
      return { ok: false, reason: `This weapon already has a ${this.attachmentType} attachment.` };
    }
    return { ok: true };
  }

  installOn(weapon, instance, place) {
    const attachments = [...weapon.attachments];
    attachments[place] = instance;
    return { ...weapon, attachments };
  }
}

// An attachment for support (civilian) units, e.g. a Builder's tool kit.
// Goes in one of the unit's attachment slots; no base needed.
class SupportAttachment extends CustomPart {
  constructor(def) {
    super(def);
    if (!Array.isArray(def.unitTypes) || def.unitTypes.length === 0) {
      throw new Error(`${def.id}: a support attachment needs unitTypes, e.g. ["builder"].`);
    }
    this.unitTypes = def.unitTypes;
  }

  get slot() {
    return "attachments";
  }

  places(weapon) {
    return weapon.attachments.map((_, i) => i);
  }

  occupant(weapon, place) {
    return weapon.attachments[place];
  }

  // Only for the unit types it lists.
  checkUnit(unit) {
    if (unit && !this.unitTypes.includes(unit.typeId)) {
      return { ok: false, reason: `${this.name} is only for ${this.unitTypes.map((t) => UNIT_TYPES[t]?.name ?? t).join(" / ")}.` };
    }
    return { ok: true };
  }

  canInstallOn(weapon, place, unit) {
    const fitsUnit = this.checkUnit(unit);
    if (!fitsUnit.ok) return fitsUnit;
    return this.places(weapon).includes(place) ? { ok: true } : { ok: false, reason: "No such attachment slot." };
  }

  installOn(weapon, instance, place) {
    const attachments = [...weapon.attachments];
    attachments[place] = instance;
    return { ...weapon, attachments };
  }
}

// Turns a list of parts into a lookup by id, catching duplicate ids.
function partCatalogue(parts) {
  const byId = {};
  for (const part of parts) {
    if (byId[part.id]) throw new Error(`Two weapon parts share the id "${part.id}".`);
    byId[part.id] = part;
  }
  return byId;
}
