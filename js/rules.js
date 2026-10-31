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
// game moves straight on to the next phase. `onEnter` is the game's own
// built-in rule for that phase, which runs before any piece's triggers.
const PHASES = [
  { id: "beginning",   name: "Beginning",    auto: true,  onEnter: (state) => Rules.startTurn(state) },
  { id: "main",        name: "Main",         auto: false, onEnter: (state) => Market.refresh(state) },
  { id: "unitControl", name: "Unit control", auto: false },
  { id: "end",         name: "End",          auto: true },
];

const OK = { ok: true };
const no = (reason) => ({ ok: false, reason });

// Most actions can only be taken in one phase.
const inPhase = (state, phaseId) =>
  state.phase === phaseId ? OK : no(`Only during the ${PHASES.find((p) => p.id === phaseId).name} phase.`);

const price = (cost) => (cost === null ? "price TBD" : `$${cost}`);

const ACTIONS = {
  NEXT_PHASE: {
    label: (a, state) => (Rules.nextManualPhase(state) ? `Go to ${Rules.nextManualPhase(state).name}` : "End turn"),
    list: () => [{ type: "NEXT_PHASE" }],
    check: (state) => (state.winner === null ? OK : no("The game is over.")),
    apply: (state) => Rules.advancePhase(state),
  },

  // ---- Units: buy into reserve, then deploy onto the board ----

  BUY_UNIT: {
    label: (a) => `Buy ${UNIT_TYPES[a.unitTypeId].name} (${price(Rules.unitCost(a.unitTypeId))})`,
    list: () => Object.keys(UNIT_TYPES).map((unitTypeId) => ({ type: "BUY_UNIT", unitTypeId })),
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      if (!UNIT_TYPES[a.unitTypeId]) return no("Unknown unit.");
      if (state.players[state.currentPlayer].money < (Rules.unitCost(a.unitTypeId) ?? 0)) return no("Not enough money.");
      return OK;
    },
    apply(state, a) {
      const player = state.players[state.currentPlayer];
      player.money -= Rules.unitCost(a.unitTypeId) ?? 0;
      player.reserve.push(Units.create(state, a.unitTypeId, state.currentPlayer));
    },
  },

  DEPLOY_UNIT: {
    label: (a) => `Deploy ${UNIT_TYPES[a.unitTypeId].name}`,
    list(state) {
      // One option per unit type in reserve, not per unit, so the buttons don't repeat.
      const types = new Set(state.players[state.currentPlayer].reserve.map((u) => u.typeId));
      const out = [];
      for (const spaceId in state.spaces) {
        for (const unitTypeId of types) out.push({ type: "DEPLOY_UNIT", spaceId, unitTypeId });
      }
      return out;
    },
    // PLACEHOLDER RULE: main phase only, onto any empty octagon, free.
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      if (!state.players[state.currentPlayer].reserve.some((u) => u.typeId === a.unitTypeId)) return no("None in reserve.");
      const space = state.spaces[a.spaceId];
      if (!space || space.kind !== "octagon") return no("Units go on octagons.");
      if (space.unit) return no("That octagon is occupied.");
      return OK;
    },
    apply(state, a) {
      const reserve = state.players[state.currentPlayer].reserve;
      const [unit] = reserve.splice(reserve.findIndex((u) => u.typeId === a.unitTypeId), 1);
      state.spaces[a.spaceId].unit = unit;
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
      if (to.unit) return no("Units can't move onto or through other units.");
      // PLACEHOLDER RULE: a unit can't move after it has started shooting.
      if (from.unit.shotsTaken > 0) return no("This unit has already shot.");
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

  // Shoot an enemy unit within range (counted without diagonals). Only
  // octagons can be targeted, so buildings can't be shot.
  SHOOT: {
    label: (a, state) =>
      `Shoot ${Units.def(state.spaces[a.target].unit).name} (${Units.damage(state, state.spaces[a.from].unit)} damage)`,
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
      if (!target || target.kind !== "octagon" || !target.unit || target.unit.owner === state.currentPlayer) {
        return no("Choose an enemy unit.");
      }
      if (Units.shotsLeft(state, from.unit) <= 0) return no("No shots left this turn.");
      if (Board.distance(from, target) > Units.range(state, from.unit)) return no("Out of range.");
      return OK;
    },
    apply(state, a) {
      const shooter = state.spaces[a.from].unit;
      shooter.shotsTaken++;
      state.spaces[a.target].unit.damageTaken += Units.damage(state, shooter);
    },
  },

  // ---- Weapons: take a part from the market onto one of your weapons ----

  INSTALL_PART: {
    label(a, state) {
      const instance = Market.offer(state, a.pile, a.slot);
      const part = WEAPON_PARTS[instance.partId];
      return `${part.installVerb} ${part.nameFor(instance)} on Weapon ${a.weaponIndex + 1}`;
    },
    list(state) {
      const out = [];
      state.players[state.currentPlayer].weapons.forEach((_, weaponIndex) => {
        for (const pile of ["bases", "parts"]) {
          (state.market ? state.market[pile] : []).forEach((_, slot) => out.push({ type: "INSTALL_PART", weaponIndex, pile, slot }));
        }
      });
      return out;
    },
    // PLACEHOLDER RULE: market parts are free and you can take as many as you like.
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      const instance = Market.offer(state, a.pile, a.slot);
      if (!instance) return no("That offer has been taken.");
      const weapon = state.players[state.currentPlayer].weapons[a.weaponIndex];
      return weapon ? Armory.canInstall(weapon, instance.partId) : no("No such weapon slot.");
    },
    apply(state, a) {
      const weapons = state.players[state.currentPlayer].weapons;
      weapons[a.weaponIndex] = Armory.install(weapons[a.weaponIndex], Market.offer(state, a.pile, a.slot));
      state.market[a.pile][a.slot] = null;
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
      players: [],
      currentPlayer: 0,
      round: 1,
      phase: PHASES[0].id,
      winner: null,
      rngState: Random.newSeed(),
      nextUnitId: 1,
      market: null,
    };
    state.players = CONFIG.players.map((p, i) => ({
      name: p.name,
      color: p.color,
      money: CONFIG.startingMoney,
      reserve: CONFIG.startingUnits.map((typeId) => Units.create(state, typeId, i)),
      weapons: Array.from({ length: CONFIG.weaponsPerPlayer }, Armory.createEmptyWeapon),
    }));
    Rules.enterPhase(state);
    return state;
  },

  // ---------- Money ----------

  // Price to buy a unit, or null if not decided yet.
  unitCost(unitTypeId) {
    const unit = UNIT_TYPES[unitTypeId];
    return unit.cost ?? CONFIG.unitCosts[unit.category] ?? null;
  },

  // Money the current player gains at the beginning of their turn:
  // 1 + 1 for every unit they have that isn't deployed.
  income(state) {
    return CONFIG.income.base + CONFIG.income.perReserveUnit * state.players[state.currentPlayer].reserve.length;
  },

  // Built-in beginning-of-turn rule.
  startTurn(state) {
    Units.resetTurn(state, state.currentPlayer);
    state.players[state.currentPlayer].money += Rules.income(state);
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
  // runs that phase's rules and triggers and skips it if it's automatic.
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
    const phase = PHASES[Rules.phaseIndex(state)];
    if (phase.onEnter) phase.onEnter(state);
    Rules.runPhaseTriggers(state, state.phase);
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
    Units.removeDead(state);
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

  // Legal actions that put a part on one of the current player's weapons.
  getActionsForWeapon(state, weaponIndex) {
    return Rules.getLegalActions(state).filter((a) => a.weaponIndex === weaponIndex);
  },

  // Legal actions that take one market offer.
  getActionsForOffer(state, pile, slot) {
    return Rules.getLegalActions(state).filter((a) => a.pile === pile && a.slot === slot);
  },

  getActionsOfType(state, type) {
    return Rules.getLegalActions(state).filter((a) => a.type === type);
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
    Units.removeDead(next);
    next.winner = Rules.checkWinner(next);
    return next;
  },

  // PLACEHOLDER RULE: nobody can win yet. Return a player index once decided.
  checkWinner(state) {
    return null;
  },
};
