// =============================================================
// rules.js — the game itself. Pure logic, no drawing.
//
// Everything that can happen in the game is an ACTION: a plain
// object like { type: "END_TURN" }. Each action type lives in
// ACTIONS below and has three parts:
//   list(state)          -> every candidate action of this type right now
//   check(state, action) -> { ok: true } or { ok: false, reason }
//   apply(state, action) -> changes `state` (which is already a copy)
//
// To add a new kind of move, add one entry to ACTIONS. The UI
// will offer it automatically wherever it's legal.
// =============================================================

const OK = { ok: true };
const no = (reason) => ({ ok: false, reason });

const ACTIONS = {
  END_TURN: {
    label: () => "End turn",
    list: () => [{ type: "END_TURN" }],
    check: (state) => (state.winner === null ? OK : no("The game is over.")),
    apply(state) {
      state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
      if (state.currentPlayer === 0) state.round++;
    },
  },

  // ---- Weapons (on the current player's own board) ----

  SET_WEAPON_BASE: {
    label: (a) => `Build ${WEAPON_BASES[a.baseId].name}`,
    list(state) {
      const out = [];
      state.players[state.currentPlayer].weapons.forEach((_, weaponIndex) => {
        for (const baseId in WEAPON_BASES) out.push({ type: "SET_WEAPON_BASE", weaponIndex, baseId });
      });
      return out;
    },
    // PLACEHOLDER RULE: no cost yet, any number per turn.
    check(state, a) {
      const weapon = state.players[state.currentPlayer].weapons[a.weaponIndex];
      return weapon ? Armory.canSetBase(weapon, a.baseId) : no("No such weapon slot.");
    },
    apply(state, a) {
      const weapons = state.players[state.currentPlayer].weapons;
      weapons[a.weaponIndex] = Armory.withBase(weapons[a.weaponIndex], a.baseId);
    },
  },

  ADD_WEAPON_PART: {
    label: (a) => `Install ${WEAPON_PARTS[a.partId].name}`,
    list(state) {
      const out = [];
      state.players[state.currentPlayer].weapons.forEach((_, weaponIndex) => {
        for (const partId in WEAPON_PARTS) out.push({ type: "ADD_WEAPON_PART", weaponIndex, partId });
      });
      return out;
    },
    // PLACEHOLDER RULE: no cost yet, any number per turn.
    check(state, a) {
      const weapon = state.players[state.currentPlayer].weapons[a.weaponIndex];
      return weapon ? Armory.canAddPart(weapon, a.partId) : no("No such weapon slot.");
    },
    apply(state, a) {
      const weapons = state.players[state.currentPlayer].weapons;
      weapons[a.weaponIndex] = Armory.withPart(weapons[a.weaponIndex], a.partId);
    },
  },

  // ---- Main board ----

  PLACE_UNIT: {
    label: (a) => `Deploy ${UNIT_TYPES[a.unitTypeId].name}`,
    list(state) {
      const out = [];
      for (const spaceId in state.spaces) {
        for (const unitTypeId in UNIT_TYPES) out.push({ type: "PLACE_UNIT", spaceId, unitTypeId });
      }
      return out;
    },
    // PLACEHOLDER RULE: any empty octagon, free.
    check(state, a) {
      const space = state.spaces[a.spaceId];
      if (!space || space.kind !== "octagon") return no("Units go on octagons.");
      if (space.unit) return no("That octagon is occupied.");
      if (!UNIT_TYPES[a.unitTypeId]) return no("Unknown unit.");
      return OK;
    },
    apply(state, a) {
      state.spaces[a.spaceId].unit = { typeId: a.unitTypeId, owner: state.currentPlayer };
    },
  },

  PLACE_BUILDING: {
    label: (a) => `Construct ${BUILDING_TYPES[a.buildingTypeId].name}`,
    list(state) {
      const out = [];
      for (const spaceId in state.spaces) {
        for (const buildingTypeId in BUILDING_TYPES) out.push({ type: "PLACE_BUILDING", spaceId, buildingTypeId });
      }
      return out;
    },
    // PLACEHOLDER RULE: any empty square, free.
    check(state, a) {
      const space = state.spaces[a.spaceId];
      if (!space || space.kind !== "square") return no("Buildings go on squares.");
      if (space.building) return no("That square is occupied.");
      if (!BUILDING_TYPES[a.buildingTypeId]) return no("Unknown building.");
      return OK;
    },
    apply(state, a) {
      state.spaces[a.spaceId].building = { typeId: a.buildingTypeId, owner: state.currentPlayer };
    },
  },
};

const Rules = {
  createInitialState() {
    return {
      spaces: Board.createSpaces(CONFIG.board.octagonRows, CONFIG.board.octagonCols),
      players: CONFIG.players.map((p) => ({
        name: p.name,
        color: p.color,
        weapons: Array.from({ length: CONFIG.weaponsPerPlayer }, Armory.createEmptyWeapon),
      })),
      currentPlayer: 0,
      round: 1,
      winner: null,
    };
  },

  check(state, action) {
    const def = ACTIONS[action.type];
    return def ? def.check(state, action) : no(`Unknown action "${action.type}".`);
  },

  getLegalActions(state) {
    if (state.winner !== null) return [];
    return Object.values(ACTIONS)
      .flatMap((def) => def.list(state))
      .filter((action) => Rules.check(state, action).ok);
  },

  // Legal actions that target a given board space.
  getActionsForSpace(state, spaceId) {
    return Rules.getLegalActions(state).filter((a) => a.spaceId === spaceId);
  },

  // Legal actions that target one of the current player's weapons.
  getActionsForWeapon(state, weaponIndex) {
    return Rules.getLegalActions(state).filter((a) => a.weaponIndex === weaponIndex);
  },

  describe(action) {
    return ACTIONS[action.type].label(action);
  },

  // Returns a NEW state with the action applied. Throws if it's illegal.
  applyAction(state, action) {
    const result = Rules.check(state, action);
    if (!result.ok) throw new Error(result.reason);
    const next = structuredClone(state);
    ACTIONS[action.type].apply(next, action);
    next.winner = Rules.checkWinner(next);
    return next;
  },

  // PLACEHOLDER RULE: nobody can win yet. Return a player index once decided.
  checkWinner(state) {
    return null;
  },
};
