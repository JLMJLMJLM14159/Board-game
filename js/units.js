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
//     counters: { thermal: 0, electrical: 0, biological: 0 },
//                         // net counters per element: +3 = three positive,
//                         // -2 = two negative (positive and negative cancel out)
//     reservedOnTurn: null, // the turn it was last returned to reserve (can't redeploy that turn)
//     weapon: { base, barrel, mag, attachments },   // its own weapon (see armory.js)
//   }
//
// Stats (movement, range, health, damage, shots) are NEVER stored: they're
// worked out from the unit's type and its weapons every time they're asked for.
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

  // Deals damage to a unit. `source` is the unit that caused it, if any.
  dealDamage(state, unit, amount, source = null) {
    if (amount <= 0) return;
    unit.damageTaken += amount;
    Events.emit(state, "unitDamaged", { player: state.currentPlayer, unit, amount, source });
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

  // Total of one stat across every part on the unit's weapons
  // (rarity applied). Negative values lower the stat.
  weaponModifier(state, unit, stat) {
    let total = 0;
    for (const weapon of Units.weaponsOf(state, unit)) {
      for (const instance of Armory.installed(weapon)) {
        const value = WEAPON_PARTS[instance.partId].statsFor(instance)[stat];
        if (typeof value === "number") total += value;
      }
    }
    return total;
  },

  // A stat from the unit's type plus its weapon modifiers, never below 0.
  stat(state, unit, stat) {
    const base = (Units.def(unit).stats || {})[stat] ?? 0;
    return Math.max(0, base + Units.weaponModifier(state, unit, stat));
  },

  // How many side-to-side steps the unit can take each turn.
  movement(state, unit) {
    return Units.stat(state, unit, "movement");
  },

  // How many side-to-side steps away the unit can shoot (diagonal = 2).
  range(state, unit) {
    return Units.stat(state, unit, "range");
  },

  maxHealth(state, unit) {
    return Units.stat(state, unit, "health");
  },

  health(state, unit) {
    return Units.maxHealth(state, unit) - unit.damageTaken;
  },

  // Damage dealt by each shot.
  damage(state, unit) {
    return Units.stat(state, unit, "damage");
  },

  // Shots the unit can fire each turn.
  shots(state, unit) {
    return Units.stat(state, unit, "shots");
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
      }
    }
  },

  // Removes every deployed unit whose health has reached 0, whether from
  // damage or from its max health dropping.
  removeDead(state) {
    for (const space of Object.values(state.spaces)) {
      const unit = space.unit;
      if (!unit || Units.health(state, unit) > 0) continue;
      space.unit = null;
      // The dead unit (and its parts) still hear about their own death.
      Events.emit(state, "unitDied", { player: state.currentPlayer, unit, space }, Events.unitListeners(unit, space));
    }
  },
};
