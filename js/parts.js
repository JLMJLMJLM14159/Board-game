// =============================================================
// parts.js — the CLASSES for weapon parts. Pure logic, no drawing.
//
//   WeaponPart                 any part: id, name, synergy, stats
//   ├── WeaponBase             the weapon's class (pistol, ar...). No rarity.
//   └── CustomPart             random rarity, stats x rarity multiplier,
//       │                      can be limited to some weapon classes
//       ├── Barrel             one per weapon
//       ├── Mag                one per weapon
//       └── Attachment         up to 2 per weapon, each a different type
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
  constructor({ id, name, synergy = null, stats = {}, description = "" }) {
    if (!id || !name) throw new Error("Every weapon part needs an id and a name.");
    if (synergy && !Synergy.get(synergy)) throw new Error(`${id}: unknown synergy "${synergy}".`);
    this.id = id;
    this.name = name;
    this.synergy = synergy;
    this.stats = stats;
    this.description = description;
  }

  // Which key of the weapon this part goes in. Each subclass sets this.
  get slot() {
    throw new Error(`${this.constructor.name} must define a slot.`);
  }

  // Word used on the button, e.g. "Install Coil Barrel".
  get installVerb() {
    return "Install";
  }

  // A copy of this part appearing in the game.
  createInstance(state) {
    return { partId: this.id, rarity: null };
  }

  // This instance's stats after any modifiers.
  statsFor(instance) {
    return { ...this.stats };
  }

  canInstallOn(weapon) {
    return weapon[this.slot] ? { ok: false, reason: `This weapon already has a ${this.slot}.` } : { ok: true };
  }

  // Returns a NEW weapon with the instance in place.
  installOn(weapon, instance) {
    return { ...weapon, [this.slot]: instance };
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

  get installVerb() {
    return "Build";
  }
}

// Anything that customises a base.
class CustomPart extends WeaponPart {
  constructor(def) {
    super(def);
    this.allowedClasses = def.allowedClasses ?? null; // null = fits any base
  }

  // Rolls this copy's random rarity.
  // PLACEHOLDER RULE: how parts "appear" isn't decided, so for now this
  // happens when the part is installed.
  createInstance(state) {
    return { partId: this.id, rarity: Rarity.roll(state) };
  }

  // PLACEHOLDER RULE: assumes the rarity multiplier scales every numeric stat.
  statsFor(instance) {
    const m = Rarity.multiplier(instance.rarity);
    const stats = {};
    for (const [key, value] of Object.entries(this.stats)) {
      stats[key] = typeof value === "number" ? value * m : value;
    }
    return stats;
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

  canInstallOn(weapon) {
    const fits = this.checkFitsBase(weapon);
    return fits.ok ? super.canInstallOn(weapon) : fits;
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

  canInstallOn(weapon) {
    const fits = this.checkFitsBase(weapon);
    if (!fits.ok) return fits;
    if (!weapon.attachments.includes(null)) return { ok: false, reason: "All attachment slots are full." };
    // The attachments must be different types (e.g. scope + side, not scope + scope).
    const taken = weapon.attachments.filter(Boolean).map((p) => WEAPON_PARTS[p.partId].attachmentType);
    if (taken.includes(this.attachmentType)) {
      return { ok: false, reason: `This weapon already has a ${this.attachmentType} attachment.` };
    }
    return { ok: true };
  }

  installOn(weapon, instance) {
    const attachments = [...weapon.attachments];
    attachments[attachments.indexOf(null)] = instance;
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
