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
//     buildsTaken: 0,     // buildings built this turn (civilians only)
//   }
//
// Stats (movement, range, health, damage, shots) are NEVER stored: they're
// worked out from the unit's type and its weapons every time they're asked for.
// Storing damage taken instead of current health means that when max health
// changes, current health changes by the same amount automatically.
// =============================================================

const Units = {
  create(state, typeId, owner) {
    return { id: state.nextUnitId++, typeId, owner, damageTaken: 0, stepsTaken: 0, shotsTaken: 0, buildsTaken: 0 };
  },

  def(unit) {
    return UNIT_TYPES[unit.typeId];
  },

  // Civilian units can build; military units can't.
  isCivilian(unit) {
    return Units.def(unit).category === "civilian";
  },

  // The weapons this unit is using.
  // PLACEHOLDER RULE: how a unit gets weapons isn't decided yet, so none do.
  weaponsOf(state, unit) {
    return [];
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
      }
    }
  },

  // Removes every deployed unit whose health has reached 0, whether from
  // damage or from its max health dropping.
  removeDead(state) {
    for (const space of Object.values(state.spaces)) {
      if (space.unit && Units.health(state, space.unit) <= 0) space.unit = null;
    }
  },
};
