// =============================================================
// parts.js — the CLASSES for weapon parts. Pure logic, no drawing.
//
//   WeaponPart                 any part: id, name, synergy, stats, triggers
//   ├── WeaponBase             the unit's starting weapon stats. No rarity.
//   └── CustomPart             random rarity that multiplies only the stats
//       │                      listed in rarityStats; optional separate
//       │                      legendary version
//       ├── Barrel             one per weapon
//       ├── Mag                one per weapon
//       ├── Muzzle             one per weapon
//       ├── Stock              one per weapon
//       └── Attachment         up to 2 per weapon, never two of the same
//           └── SupportAttachment   for support (civilian) units only, e.g. a
//                                   Builder's tool kit; lists which unit types it fits
//
// Military units carry a full weapon. Support units only have the 2
// attachment slots, and only take SupportAttachments made for their type.
//
// A part goes into a PLACE on a weapon: "base", "barrel", "mag", "muzzle", "stock", or an
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

// The weapon's base. Its stats are the unit's STARTING stats (they replace the
// unit's own defaults); the other parts then add to or subtract from them.
class WeaponBase extends WeaponPart {
  get slot() {
    return "base";
  }
}

// Anything that customises a base.
class CustomPart extends WeaponPart {
  constructor(def) {
    super(def);

    // Only these stats are multiplied by rarity. Every other stat stays as written.
    this.rarityStats = def.rarityStats ?? [];
    for (const key of this.rarityStats) {
      if (typeof this.stats[key] !== "number") throw new Error(`${def.id}: rarityStats "${key}" isn't a number in stats.`);
    }

    // Optional separate legendary version: { name?, stats?, description?, triggers? }.
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

  canInstallOn(weapon, place, unit) {
    const fitsUnit = this.checkUnit(unit);
    if (!fitsUnit.ok) return fitsUnit;
    if (!weapon.base) return { ok: false, reason: "Add a base first." };
    return super.canInstallOn(weapon, place, unit);
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

class Muzzle extends CustomPart {
  get slot() {
    return "muzzle";
  }
}

class Stock extends CustomPart {
  get slot() {
    return "stock";
  }
}

// Goes in one of the weapon's attachment slots. A unit can't carry two of the
// same attachment.
class Attachment extends CustomPart {
  get slot() {
    return "attachments";
  }

  // Ordinary attachments go on a weapon, so they need its base first.
  get needsBase() {
    return true;
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
    if (this.needsBase && !weapon.base) return { ok: false, reason: "Add a base first." };
    if (!this.places(weapon).includes(place)) return { ok: false, reason: "No such attachment slot." };
    // No two of the same attachment (ignoring the one being replaced).
    if (weapon.attachments.some((p, i) => p && i !== place && p.partId === this.id)) {
      return { ok: false, reason: `This unit already has a ${this.name}.` };
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
// Support units have no weapon, so no base is needed.
class SupportAttachment extends Attachment {
  constructor(def) {
    super(def);
    if (!Array.isArray(def.unitTypes) || def.unitTypes.length === 0) {
      throw new Error(`${def.id}: a support attachment needs unitTypes, e.g. ["builder"].`);
    }
    this.unitTypes = def.unitTypes;
  }

  get needsBase() {
    return false;
  }

  // Only for the unit types it lists.
  checkUnit(unit) {
    if (unit && !this.unitTypes.includes(unit.typeId)) {
      return { ok: false, reason: `${this.name} is only for ${this.unitTypes.map((t) => UNIT_TYPES[t]?.name ?? t).join(" / ")}.` };
    }
    return { ok: true };
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
