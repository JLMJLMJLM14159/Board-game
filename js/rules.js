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
      state.spaces[a.spaceId].unit = {
        id: state.nextUnitId++,
        typeId: a.unitTypeId,
        owner: state.currentPlayer,
        stepsTaken: 0,
        hasShot: false,
      };
    },
  },

  // One step to an octagon sharing a side (no diagonals), up to the unit's movement.
  MOVE_UNIT: {
    label(a, state) {
      const from = state.spaces[a.from];
      const to = state.spaces[a.to];
      const dir = to.row < from.row ? "up" : to.row > from.row ? "down" : to.col < from.col ? "left" : "right";
      return `Move ${dir}`;
    },
    list(state) {
      const out = [];
      for (const space of Object.values(state.spaces)) {
        if (!space.unit || space.unit.owner !== state.currentPlayer) continue;
        for (const to of Board.octagonNeighbors(state.spaces, space)) out.push({ type: "MOVE_UNIT", from: space.id, to });
      }
      return out;
    },
    check(state, a) {
      const phase = inPhase(state, "unitControl");
      if (!phase.ok) return phase;
      const from = state.spaces[a.from];
      const to = state.spaces[a.to];
      if (!from || !from.unit || from.unit.owner !== state.currentPlayer) return no("Not your unit.");
      if (!to || !Board.octagonNeighbors(state.spaces, from).includes(to.id)) return no("Units move one side-sharing octagon at a time.");
      // PLACEHOLDER RULE: units can't move onto or through other units.
      if (to.unit) return no("That octagon is occupied.");
      // PLACEHOLDER RULE: a unit can't move after it has shot.
      if (from.unit.hasShot) return no("This unit has already shot.");
      if (Units.movesLeft(state, from.unit) <= 0) return no("No movement left.");
      return OK;
    },
    apply(state, a) {
      const unit = state.spaces[a.from].unit;
      unit.stepsTaken++;
      state.spaces[a.to].unit = unit;
      state.spaces[a.from].unit = null;
    },
  },

  // Shoot at an enemy unit within range (counted without diagonals).
  SHOOT: {
    label: (a, state) => `Shoot ${Units.def(state.spaces[a.target].unit).name}`,
    list(state) {
      const spaces = Object.values(state.spaces);
      const out = [];
      for (const space of spaces) {
        if (!space.unit || space.unit.owner !== state.currentPlayer) continue;
        for (const target of spaces) {
          if (target.unit && target.unit.owner !== state.currentPlayer) out.push({ type: "SHOOT", from: space.id, target: target.id });
        }
      }
      return out;
    },
    check(state, a) {
      const phase = inPhase(state, "unitControl");
      if (!phase.ok) return phase;
      const from = state.spaces[a.from];
      const target = state.spaces[a.target];
      if (!from || !from.unit || from.unit.owner !== state.currentPlayer) return no("Not your unit.");
      if (!target || !target.unit || target.unit.owner === state.currentPlayer) return no("Choose an enemy unit.");
      // PLACEHOLDER RULE: one shot per unit per turn.
      if (from.unit.hasShot) return no("This unit has already shot.");
      if (Board.distance(from, target) > Units.range(state, from.unit)) return no("Out of range.");
      return OK;
    },
    // PLACEHOLDER RULE: what a hit does (damage, destroying the unit...) isn't decided yet.
    apply(state, a) {
      state.spaces[a.from].unit.hasShot = true;
    },
  },

  // ---- Weapons (on the current player's own board) ----

  // Bases and parts both go through here; each part's class decides the rules.
  INSTALL_PART: {
    label: (a) => `${WEAPON_PARTS[a.partId].installVerb} ${WEAPON_PARTS[a.partId].name}`,
    list(state) {
      const out = [];
      state.players[state.currentPlayer].weapons.forEach((_, weaponIndex) => {
        for (const partId in WEAPON_PARTS) out.push({ type: "INSTALL_PART", weaponIndex, partId });
      });
      return out;
    },
    // PLACEHOLDER RULE: main phase only, no cost yet, any number per turn.
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      const weapon = state.players[state.currentPlayer].weapons[a.weaponIndex];
      return weapon ? Armory.canInstall(weapon, a.partId) : no("No such weapon slot.");
    },
    apply(state, a) {
      const weapons = state.players[state.currentPlayer].weapons;
      weapons[a.weaponIndex] = Armory.install(state, weapons[a.weaponIndex], a.partId);
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
      rngState: Random.newSeed(),
      nextUnitId: 1,
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
      Units.resetTurn(state, state.currentPlayer);
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

  // Legal actions that happen on a board space, or are done by the piece on it.
  getActionsForSpace(state, spaceId) {
    return Rules.getLegalActions(state).filter((a) => a.spaceId === spaceId || a.from === spaceId);
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
