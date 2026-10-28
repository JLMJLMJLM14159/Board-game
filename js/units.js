// =============================================================
// units.js — working with units on the board. Pure logic, no drawing.
// The catalogue lives in data/units.js.
//
// A unit on the board (inside an octagon's `unit` slot) looks like:
//   {
//     id: 7,              // unique, so it can be tracked as it moves
//     typeId: "scout_drone",
//     owner: 0,           // player index
//     stepsTaken: 0,      // moves used this turn
//     hasShot: false,     // shot this turn
//   }
//
// Movement and range are NEVER stored: they're worked out from the
// unit's type and its weapons every time they're asked for.
// =============================================================

const Units = {
  def(unit) {
    return UNIT_TYPES[unit.typeId];
  },

  // The weapons this unit is using.
  // PLACEHOLDER RULE: how a unit gets weapons isn't decided yet, so none do.
  weaponsOf(state, unit) {
    return [];
  },

  // Total of one stat across every part on the unit's weapons
  // (rarity multipliers applied). Negative values lower the stat.
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

  movesLeft(state, unit) {
    return Math.max(0, Units.movement(state, unit) - unit.stepsTaken);
  },

  // Clears per-turn tracking for one player's units (called as their turn starts).
  resetTurn(state, player) {
    for (const space of Object.values(state.spaces)) {
      if (space.unit && space.unit.owner === player) {
        space.unit.stepsTaken = 0;
        space.unit.hasShot = false;
      }
    }
  },
};
