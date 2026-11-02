// =============================================================
// units.js — working with units. Pure logic, no drawing.
// The catalogue lives in data/units.js.
//
// A unit (on an octagon, or in a player's reserve) looks like:
//   {
//     id: 7,              // unique, so it can be tracked as it moves
//     typeId: "scout_drone",
//     owner: 0,           // player index
//     damageTaken: 0,     // current health = max health - damageTaken
//     stepsTaken: 0,      // moves used this turn
//     shotsTaken: 0,      // shots used this turn
//     buildsTaken: 0,     // buildings built this turn (units with the build ability)
//     healsTaken: 0,      // heals given this turn (units with the heal ability)
//     meleeTaken: 0,      // melee attacks made this turn
//     counters: { thermal: 0, electrical: 0, biological: 0 },
//                         // net counters per element: +3 = three positive,
//                         // -2 = two negative (positive and negative cancel out)
//     reservedOnTurn: null, // the turn it was last returned to reserve (can't redeploy that turn)
//     weapon: { base, barrel, mag, attachments },   // its own weapon (see armory.js)
//   }
//
// Stats are NEVER stored: they're worked out every time they're asked for.
// A unit's type gives its default stats; a weapon BASE replaces those with its
// own starting values (for each stat it lists); every other part then adds to or
// subtracts from them.
//
// Damage per shot is split into types: `damage` (untyped) plus `thermalDamage`,
// `electricalDamage` and `biologicalDamage`. Units without a weapon base can't
// shoot, but every unit has a `melee` attack on an adjacent octagon.
// Storing damage taken instead of current health means that when max health
// changes, current health changes by the same amount automatically.
// =============================================================

const Units = {
  create(state, typeId, owner) {
    return {
      id: state.nextUnitId++,
      typeId,
      owner,
      damageTaken: 0,
      stepsTaken: 0,
      shotsTaken: 0,
      buildsTaken: 0,
      healsTaken: 0,
      meleeTaken: 0,
      counters: Object.fromEntries(Synergy.ids().map((id) => [id, 0])),
      reservedOnTurn: null,
      weapon: Armory.createEmptyWeapon(),
    };
  },

  // The board space a unit is standing on, or null if it isn't deployed.
  spaceOf(state, unitId) {
    return Object.values(state.spaces).find((s) => s.unit && s.unit.id === unitId) || null;
  },

  // Finds a unit wherever it is: { unit, space } if deployed, { unit, space: null }
  // if in a reserve, or null if it no longer exists.
  find(state, unitId) {
    const space = Units.spaceOf(state, unitId);
    if (space) return { unit: space.unit, space };
    for (const player of state.players) {
      const unit = player.reserve.find((u) => u.id === unitId);
      if (unit) return { unit, space: null };
    }
    return null;
  },

  // Every unit a player has, deployed and in reserve.
  allOf(state, player) {
    const deployed = Object.values(state.spaces).filter((s) => s.unit && s.unit.owner === player).map((s) => s.unit);
    return [...deployed, ...state.players[player].reserve];
  },

  // A short name for buttons: "Trooper 4-5", or "Trooper (reserve)".
  label(state, unitId) {
    const found = Units.find(state, unitId);
    const where = found.space ? `${found.space.row + 1}-${found.space.col + 1}` : "(reserve)";
    return `${Units.def(found.unit).name} ${where}`;
  },

  def(unit) {
    return UNIT_TYPES[unit.typeId];
  },

  // Civilian units never take control of octagons.
  isCivilian(unit) {
    return Units.def(unit).category === "civilian";
  },

  // A unit type's special ability settings (e.g. "build", "heal"), or null if it doesn't have it.
  ability(unit, name) {
    const abilities = Units.def(unit).abilities || {};
    return abilities[name] || null;
  },

  // ---- Element counters ----
  // A unit holds positive and negative counters for each element. Only counters
  // of the SAME element cancel out, so each element is stored as one net number.

  // Gives a unit `amount` counters of an element: positive numbers add positive
  // counters, negative numbers add negative ones (cancelling positives first).
  addCounters(state, unit, element, amount) {
    if (!(element in unit.counters)) throw new Error(`Unknown element "${element}".`);
    if (amount === 0) return;
    const before = unit.counters[element];
    unit.counters[element] += amount;
    Events.emit(state, "countersChanged", { player: state.currentPlayer, unit, element, amount, before, after: unit.counters[element] });
  },

  // Net counters of one element: e.g. 3 = three positive, -1 = one negative, 0 = none.
  counters(unit, element) {
    return unit.counters[element];
  },

  hasCounters(unit) {
    return Object.values(unit.counters).some((n) => n !== 0);
  },

  // Removes every counter, positive and negative.
  clearCounters(state, unit) {
    if (!Units.hasCounters(unit)) return;
    const before = { ...unit.counters };
    for (const element in unit.counters) unit.counters[element] = 0;
    Events.emit(state, "countersCleared", { player: state.currentPlayer, unit, before });
  },

  // Deals damage to a unit. `damage` is either a number with a `type`
  // ("untyped", "thermal", "electrical" or "biological"), or a breakdown like
  // { untyped: 2, thermal: 1 }. `source` is the unit that caused it, if any.
  dealDamage(state, unit, damage, source = null, type = "untyped") {
    const types = typeof damage === "number" ? { [type]: damage } : damage;
    const amount = Object.values(types).reduce((sum, n) => sum + n, 0);
    if (amount <= 0) return;
    unit.damageTaken += amount;
    Events.emit(state, "unitDamaged", { player: state.currentPlayer, unit, amount, types, source });
  },

  // Restores a unit to full health and removes all its counters (Medics, going to reserve).
  restore(state, unit) {
    unit.damageTaken = 0;
    Units.clearCounters(state, unit);
  },

  // Is the unit "at base", where it can be equipped or returned to reserve?
  // Reserve units always are; deployed units must be next to one of their
  // owner's deployable buildings (like the HQ).
  atBase(state, found) {
    return !found.space || Territory.canDeployAt(state, found.unit.owner, found.space);
  },

  // The weapons this unit is using: each unit has its own one.
  weaponsOf(state, unit) {
    return [unit.weapon];
  },

  hasWeapon(unit) {
    return unit.weapon.base !== null;
  },

  // Total of one stat across every part on the unit's weapon EXCEPT the base
  // (rarity applied). Negative values lower the stat.
  weaponModifier(state, unit, stat) {
    let total = 0;
    for (const weapon of Units.weaponsOf(state, unit)) {
      for (const instance of Armory.installed(weapon)) {
        if (instance === weapon.base) continue;
        const value = WEAPON_PARTS[instance.partId].statsFor(instance)[stat];
        if (typeof value === "number") total += value;
      }
    }
    return total;
  },

  // A stat's starting value: the weapon base's, if it lists that stat,
  // otherwise the unit type's default.
  startingStat(unit, stat) {
    const base = unit.weapon.base;
    const baseStats = base ? WEAPON_PARTS[base.partId].statsFor(base) : {};
    if (typeof baseStats[stat] === "number") return baseStats[stat];
    return (Units.def(unit).stats || {})[stat] ?? 0;
  },

  // A stat: its starting value plus every other part's changes, never below 0.
  stat(state, unit, stat) {
    return Math.max(0, Units.startingStat(unit, stat) + Units.weaponModifier(state, unit, stat));
  },

  // How many side-to-side steps the unit can take each turn.
  movement(state, unit) {
    return Units.stat(state, unit, "movement");
  },

  // How many side-to-side steps away the unit can shoot (diagonal = 2).
  // Units without a weapon base can't shoot.
  range(state, unit) {
    return Units.hasWeapon(unit) ? Units.stat(state, unit, "range") : 0;
  },

  maxHealth(state, unit) {
    return Units.stat(state, unit, "health");
  },

  health(state, unit) {
    return Units.maxHealth(state, unit) - unit.damageTaken;
  },

  // The damage each shot deals, by type: { untyped, thermal, electrical, biological }.
  damageTypes(state, unit) {
    const types = { untyped: Units.stat(state, unit, "damage") };
    for (const id of Synergy.ids()) types[id] = Units.stat(state, unit, `${id}Damage`);
    return types;
  },

  // Total damage dealt by each shot (0 without a weapon base).
  damage(state, unit) {
    if (!Units.hasWeapon(unit)) return 0;
    return Object.values(Units.damageTypes(state, unit)).reduce((sum, n) => sum + n, 0);
  },

  // Shots the unit can fire each turn (0 without a weapon base).
  shots(state, unit) {
    return Units.hasWeapon(unit) ? Units.stat(state, unit, "shots") : 0;
  },

  // Damage of the unit's melee attack (untyped), with or without a weapon.
  melee(state, unit) {
    return Units.stat(state, unit, "melee");
  },

  meleeLeft(state, unit) {
    return Math.max(0, CONFIG.meleePerTurn - unit.meleeTaken);
  },

  movesLeft(state, unit) {
    return Math.max(0, Units.movement(state, unit) - unit.stepsTaken);
  },

  shotsLeft(state, unit) {
    return Math.max(0, Units.shots(state, unit) - unit.shotsTaken);
  },

  // Clears per-turn tracking for one player's deployed units (called as their turn starts).
  resetTurn(state, player) {
    for (const space of Object.values(state.spaces)) {
      if (space.unit && space.unit.owner === player) {
        space.unit.stepsTaken = 0;
        space.unit.shotsTaken = 0;
        space.unit.buildsTaken = 0;
        space.unit.healsTaken = 0;
        space.unit.meleeTaken = 0;
      }
    }
  },

  // Removes every deployed unit whose health has reached 0, whether from
  // damage or from its max health dropping. Its parts then go back to its
  // owner's storage one rarity lower; common parts are destroyed.
  removeDead(state) {
    for (const space of Object.values(state.spaces)) {
      const unit = space.unit;
      if (!unit || Units.health(state, unit) > 0) continue;
      space.unit = null;
      // The dead unit (and its parts) still hear about their own death.
      Events.emit(state, "unitDied", { player: state.currentPlayer, unit, space }, Events.unitListeners(unit, space));
      Units.salvageParts(state, unit);
    }
  },

  // A dead unit's parts go to its owner's storage, each one rarity lower.
  // Common parts are destroyed.
  // PLACEHOLDER RULE: bases have no rarity, so they go back unchanged.
  salvageParts(state, unit) {
    const storage = state.players[unit.owner].storage;
    for (const instance of Armory.installed(unit.weapon)) {
      if (!instance.rarity) {
        storage.push(instance);
        Events.emit(state, "partSalvaged", { player: unit.owner, part: instance, unit, from: null, to: null });
        continue;
      }
      const lower = Rarity.previous(instance.rarity);
      if (!lower) {
        Events.emit(state, "partDestroyed", { player: unit.owner, part: instance, unit });
        continue;
      }
      const from = instance.rarity;
      instance.rarity = lower;
      storage.push(instance);
      Events.emit(state, "partSalvaged", { player: unit.owner, part: instance, unit, from, to: lower });
    }
    unit.weapon = Armory.createEmptyWeapon();
  },
};
