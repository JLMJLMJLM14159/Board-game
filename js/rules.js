// =============================================================
// rules.js — the game itself. Pure logic, no drawing.
//
// Everything that can happen in the game is an ACTION: a plain
// object like { type: "NEXT_PHASE" }. Each action type lives in
// ACTIONS below and has these parts:
//   label(action, state) -> button text
//   list(state)          -> every candidate action of this type right now
//   check(state, action) -> { ok: true } or { ok: false, reason }
//   apply(state, action) -> changes `state` (which is already a copy)
//
// To add a new kind of move, add one entry to ACTIONS. The UI
// will offer it automatically wherever it's legal.
// =============================================================

// The parts of a turn, in order. `auto` phases have no player decisions:
// they run their triggers ("at the beginning of your turn...") and the
// game moves straight on to the next phase.
const PHASES = [
  { id: "beginning",   name: "Beginning",    auto: true },
  { id: "main",        name: "Main",         auto: false },
  { id: "unitControl", name: "Unit control", auto: false },
  { id: "end",         name: "End",          auto: true },
];

const OK = { ok: true };
const no = (reason) => ({ ok: false, reason });

// Most actions can only be taken in one phase.
const inPhase = (state, phaseId) =>
  state.phase === phaseId ? OK : no(`Only during the ${PHASES.find((p) => p.id === phaseId).name} phase.`);

const ACTIONS = {
  NEXT_PHASE: {
    label: (a, state) => (Rules.nextManualPhase(state) ? `Go to ${Rules.nextManualPhase(state).name}` : "End turn"),
    list: () => [{ type: "NEXT_PHASE" }],
    check: (state) => (state.winner === null ? OK : no("The game is over.")),
    apply: (state) => Rules.advancePhase(state),
  },

  // ---- Units ----

  RECRUIT_UNIT: {
    label(a) {
      const cost = Rules.unitCost(a.unitTypeId);
      return `Recruit ${UNIT_TYPES[a.unitTypeId].name} (${cost === null ? "price TBD" : `$${cost}`})`;
    },
    list(state) {
      const out = [];
      for (const spaceId in state.spaces) {
        for (const unitTypeId in UNIT_TYPES) out.push({ type: "RECRUIT_UNIT", spaceId, unitTypeId });
      }
      return out;
    },
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      const space = state.spaces[a.spaceId];
      // PLACEHOLDER RULE: a recruited unit can go on any empty octagon.
      if (!space || space.kind !== "octagon") return no("Units go on octagons.");
      if (space.unit) return no("That octagon is occupied.");
      if (!UNIT_TYPES[a.unitTypeId]) return no("Unknown unit.");
      const cost = Rules.unitCost(a.unitTypeId) ?? 0;
      if (state.players[state.currentPlayer].money < cost) return no("Not enough money.");
      return OK;
    },
    apply(state, a) {
      state.players[state.currentPlayer].money -= Rules.unitCost(a.unitTypeId) ?? 0;
      state.spaces[a.spaceId].unit = { typeId: a.unitTypeId, owner: state.currentPlayer };
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
    // PLACEHOLDER RULE: main phase only, no cost yet, any number per turn.
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
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
    // PLACEHOLDER RULE: main phase only, no cost yet, any number per turn.
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      const weapon = state.players[state.currentPlayer].weapons[a.weaponIndex];
      return weapon ? Armory.canAddPart(weapon, a.partId) : no("No such weapon slot.");
    },
    apply(state, a) {
      const weapons = state.players[state.currentPlayer].weapons;
      weapons[a.weaponIndex] = Armory.withPart(weapons[a.weaponIndex], a.partId);
    },
  },

  // ---- Buildings ----

  PLACE_BUILDING: {
    label: (a) => `Construct ${BUILDING_TYPES[a.buildingTypeId].name}`,
    list(state) {
      const out = [];
      for (const spaceId in state.spaces) {
        for (const buildingTypeId in BUILDING_TYPES) out.push({ type: "PLACE_BUILDING", spaceId, buildingTypeId });
      }
      return out;
    },
    // PLACEHOLDER RULE: main phase only, any empty square, free.
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
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
    const state = {
      spaces: Board.createSpaces(CONFIG.board.octagonRows, CONFIG.board.octagonCols),
      players: CONFIG.players.map((p) => ({
        name: p.name,
        color: p.color,
        money: CONFIG.startingMoney,
        weapons: Array.from({ length: CONFIG.weaponsPerPlayer }, Armory.createEmptyWeapon),
      })),
      currentPlayer: 0,
      round: 1,
      phase: PHASES[0].id,
      winner: null,
    };
    Rules.enterPhase(state);
    return state;
  },

  // ---------- Money ----------

  // Price to recruit a unit, or null if not decided yet.
  unitCost(unitTypeId) {
    const unit = UNIT_TYPES[unitTypeId];
    return unit.cost ?? CONFIG.unitCosts[unit.category] ?? null;
  },

  // ---------- Turn phases ----------


  phaseIndex(state) {
    return PHASES.findIndex((p) => p.id === state.phase);
  },

  // The next phase this turn that needs the player, or null if the turn ends first.
  nextManualPhase(state) {
    return PHASES.slice(Rules.phaseIndex(state) + 1).find((p) => !p.auto) || null;
  },

  // Moves to the next phase (or the next player's turn), then
  // runs that phase's triggers and skips it if it's automatic.
  advancePhase(state) {
    const i = Rules.phaseIndex(state);
    if (i === PHASES.length - 1) {
      state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
      if (state.currentPlayer === 0) state.round++;
      state.phase = PHASES[0].id;
    } else {
      state.phase = PHASES[i + 1].id;
    }
    Rules.enterPhase(state);
  },

  enterPhase(state) {
    Rules.runPhaseTriggers(state, state.phase);
    const phase = PHASES[Rules.phaseIndex(state)];
    if (phase.auto && state.winner === null) Rules.advancePhase(state);
  },

  // Runs every "at the <phase> of your turn" effect. Any unit or building
  // type with `triggers: { <phaseId>(state, space) {...} }` in data/ reacts here.
  // PLACEHOLDER RULE: only the current player's pieces trigger, on their own turn.
  runPhaseTriggers(state, phaseId) {
    for (const space of Object.values(state.spaces)) {
      const piece = space.unit || space.building;
      if (!piece || piece.owner !== state.currentPlayer) continue;
      const def = space.unit ? UNIT_TYPES[piece.typeId] : BUILDING_TYPES[piece.typeId];
      const trigger = def && def.triggers && def.triggers[phaseId];
      if (trigger) trigger(state, space);
    }
    state.winner = Rules.checkWinner(state);
  },

  // ---------- Actions ----------

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

  describe(action, state) {
    return ACTIONS[action.type].label(action, state);
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
