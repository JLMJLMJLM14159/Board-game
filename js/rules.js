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
    label: (a, state) => `Buy ${UNIT_TYPES[a.unitTypeId].name} (${price(Rules.unitCost(state, a.unitTypeId))})`,
    list: () => Object.keys(UNIT_TYPES).map((unitTypeId) => ({ type: "BUY_UNIT", unitTypeId })),
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      if (!UNIT_TYPES[a.unitTypeId]) return no("Unknown unit.");
      if (state.players[state.currentPlayer].money < (Rules.unitCost(state, a.unitTypeId) ?? 0)) return no("Not enough money.");
      return OK;
    },
    apply(state, a) {
      const player = state.players[state.currentPlayer];
      player.money -= Rules.unitCost(state, a.unitTypeId) ?? 0;
      player.reserve.push(Units.create(state, a.unitTypeId, state.currentPlayer));
    },
  },

  DEPLOY_UNIT: {
    label(a, state) {
      const unit = state.players[state.currentPlayer].reserve.find((u) => u.id === a.unitId);
      const parts = Armory.installed(unit.weapon).map((i) => WEAPON_PARTS[i.partId].nameFor(i));
      return `Deploy ${Units.def(unit).name}${parts.length ? ` (${parts.join(", ")})` : ""}`;
    },
    list(state) {
      // One option per distinct reserve unit: identical units (same type and
      // same weapon) share a button so it doesn't repeat.
      const seen = new Set();
      const units = state.players[state.currentPlayer].reserve.filter((u) => {
        const key = JSON.stringify([u.typeId, u.weapon]);
        return seen.has(key) ? false : seen.add(key);
      });
      const out = [];
      for (const spaceId in state.spaces) {
        for (const unit of units) out.push({ type: "DEPLOY_UNIT", spaceId, unitId: unit.id });
      }
      return out;
    },
    // Onto an empty octagon touching one of your deployable buildings, during
    // Main, free, up to CONFIG.deploysPerTurn units per turn.
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      if (state.players[state.currentPlayer].deploysThisTurn >= CONFIG.deploysPerTurn) {
        return no(`You can only deploy ${CONFIG.deploysPerTurn} units per turn.`);
      }
      const unit = state.players[state.currentPlayer].reserve.find((u) => u.id === a.unitId);
      if (!unit) return no("That unit isn't in your reserve.");
      if (unit.reservedOnTurn === state.turn) return no("It was returned to reserve this turn, so it can't redeploy until next turn.");
      const space = state.spaces[a.spaceId];
      if (!space || space.kind !== "octagon") return no("Units go on octagons.");
      if (space.unit) return no("That octagon is occupied.");
      if (!Territory.canDeployAt(state, state.currentPlayer, space)) return no("Must touch one of your deployable buildings.");
      return OK;
    },
    apply(state, a) {
      const reserve = state.players[state.currentPlayer].reserve;
      const [unit] = reserve.splice(reserve.findIndex((u) => u.id === a.unitId), 1);
      state.spaces[a.spaceId].unit = unit;
      state.players[state.currentPlayer].deploysThisTurn++;
      Territory.claimBy(state.spaces[a.spaceId], unit);
    },
  },

  // Takes a deployed unit off the board into the reserve. Only next to one of your
  // HQs / deployable buildings, during Main or Unit control. It heals to full and
  // loses all its counters, and can't be redeployed until next turn.
  RESERVE_UNIT: {
    label: () => "Return to reserve (heals fully, clears counters)",
    list(state) {
      return Object.values(state.spaces)
        .filter((s) => s.unit && s.unit.owner === state.currentPlayer)
        .map((s) => ({ type: "RESERVE_UNIT", from: s.id }));
    },
    check(state, a) {
      if (state.phase !== "main" && state.phase !== "unitControl") return no("Only during Main or Unit control.");
      const from = state.spaces[a.from];
      if (!from || !from.unit || from.unit.owner !== state.currentPlayer) return no("Not your unit.");
      if (!Territory.canDeployAt(state, state.currentPlayer, from)) return no("Must be next to your HQ or a deployable building.");
      return OK;
    },
    apply(state, a) {
      const unit = state.spaces[a.from].unit;
      state.spaces[a.from].unit = null;
      unit.damageTaken = 0;
      Units.clearCounters(unit);
      unit.reservedOnTurn = state.turn;
      state.players[state.currentPlayer].reserve.push(unit);
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
      if (Units.movesLeft(state, from.unit) <= 0) return no("No movement left.");
      return OK;
    },
    apply(state, a) {
      const unit = state.spaces[a.from].unit;
      unit.stepsTaken++;
      state.spaces[a.to].unit = unit;
      state.spaces[a.from].unit = null;
      Territory.claimBy(state.spaces[a.to], unit);
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

  // A unit with the heal ability restores one of your units within its heal
  // range (or itself) to full health.
  // Only during Unit control, and only your own units.
  HEAL: {
    label: (a, state) => {
      const target = state.spaces[a.target].unit;
      return a.from === a.target ? "Heal itself (full health, clear counters)" : `Heal ${Units.label(state, target.id)} (full health, clear counters)`;
    },
    list(state) {
      const out = [];
      const spaces = Object.values(state.spaces);
      for (const from of spaces) {
        if (!from.unit || from.unit.owner !== state.currentPlayer || !Units.ability(from.unit, "heal")) continue;
        for (const target of spaces) {
          if (target.unit && target.unit.owner === state.currentPlayer) out.push({ type: "HEAL", from: from.id, target: target.id });
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
      const heal = Units.ability(from.unit, "heal");
      if (!heal) return no("This unit can't heal.");
      if (from.unit.healsTaken >= heal.perTurn) return no("Already healed this turn.");
      if (!target || !target.unit || target.unit.owner !== state.currentPlayer) return no("Choose one of your units.");
      if (Board.distance(from, target) > heal.range) return no("Too far away to heal.");
      if (target.unit.damageTaken <= 0 && !Units.hasCounters(target.unit)) return no("Already at full health with no counters.");
      return OK;
    },
    // Restores full health and removes ALL counters, positive and negative.
    apply(state, a) {
      state.spaces[a.from].unit.healsTaken++;
      state.spaces[a.target].unit.damageTaken = 0;
      Units.clearCounters(state.spaces[a.target].unit);
    },
  },

  // ---- Market and storage: getting parts onto your units' weapons ----
  // Parts can go onto any of your units, deployed or in reserve. A part that
  // gets replaced goes into your storage.

  // Buys a market offer straight onto a unit's weapon.
  BUY_PART: {
    label: (a, state) => `Buy for ${price(Market.price(state, Market.offer(state, a.pile, a.slot)))}${Rules.fitText(state, a)}`,
    list(state) {
      const out = [];
      for (const unit of Units.allOf(state, state.currentPlayer)) {
        for (const pile of Market.PILES) {
          state.players[state.currentPlayer].market[pile].forEach(({ item }, slot) => {
            if (!item) return;
            for (const place of WEAPON_PARTS[item.partId].places(unit.weapon)) {
              out.push({ type: "BUY_PART", pile, slot, unitId: unit.id, place });
            }
          });
        }
      }
      return out;
    },
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      const instance = Market.offer(state, a.pile, a.slot);
      if (!instance) return no("That offer has been bought.");
      if (state.players[state.currentPlayer].money < (Market.price(state, instance) ?? 0)) return no("Not enough money.");
      return Rules.checkFit(state, a.unitId, instance, a.place);
    },
    apply(state, a) {
      const slot = Market.slot(state, a.pile, a.slot);
      state.players[state.currentPlayer].money -= Market.price(state, slot.item) ?? 0;
      Rules.fit(state, a.unitId, slot.item, a.place);
      slot.item = null;
      slot.locked = false;
    },
  },

  // Buys a market offer into your storage, to fit later.
  STORE_PART: {
    label: (a, state) => `Buy into storage for ${price(Market.price(state, Market.offer(state, a.pile, a.slot)))}`,
    list(state) {
      const out = [];
      for (const pile of Market.PILES) {
        state.players[state.currentPlayer].market[pile].forEach((_, slot) => out.push({ type: "STORE_PART", pile, slot }));
      }
      return out;
    },
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      const instance = Market.offer(state, a.pile, a.slot);
      if (!instance) return no("That offer has been bought.");
      if (state.players[state.currentPlayer].money < (Market.price(state, instance) ?? 0)) return no("Not enough money.");
      return OK;
    },
    apply(state, a) {
      const slot = Market.slot(state, a.pile, a.slot);
      const player = state.players[state.currentPlayer];
      player.money -= Market.price(state, slot.item) ?? 0;
      player.storage.push(slot.item);
      slot.item = null;
      slot.locked = false;
    },
  },

  // Fits a part from your storage onto a unit's weapon.
  // PLACEHOLDER RULE: main phase only, free.
  EQUIP_PART: {
    label: (a, state) => `Fit${Rules.fitText(state, a)}`,
    list(state) {
      const out = [];
      const storage = state.players[state.currentPlayer].storage;
      for (const unit of Units.allOf(state, state.currentPlayer)) {
        storage.forEach((item, index) => {
          for (const place of WEAPON_PARTS[item.partId].places(unit.weapon)) {
            out.push({ type: "EQUIP_PART", index, unitId: unit.id, place });
          }
        });
      }
      return out;
    },
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      const instance = state.players[state.currentPlayer].storage[a.index];
      if (!instance) return no("That part isn't in storage.");
      return Rules.checkFit(state, a.unitId, instance, a.place);
    },
    apply(state, a) {
      const [instance] = state.players[state.currentPlayer].storage.splice(a.index, 1);
      Rules.fit(state, a.unitId, instance, a.place);
    },
  },

  // Sells a part from your storage.
  SELL_PART: {
    label: (a, state) => `Sell for $${Market.sellValue(state, state.players[state.currentPlayer].storage[a.index])}`,
    list: (state) => state.players[state.currentPlayer].storage.map((_, index) => ({ type: "SELL_PART", index })),
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      return state.players[state.currentPlayer].storage[a.index] ? OK : no("That part isn't in storage.");
    },
    apply(state, a) {
      const player = state.players[state.currentPlayer];
      const [instance] = player.storage.splice(a.index, 1);
      player.money += Market.sellValue(state, instance);
    },
  },

  // Raises a part's rarity by one step, for what it would cost to buy at the new
  // rarity. Works on a stored part ({ index }) or a fitted one ({ unitId, place },
  // only while the unit is at base).
  UPGRADE_PART: {
    label(a, state) {
      const instance = Rules.upgradeTarget(state, a);
      const next = Rarity.get(Rarity.next(instance.rarity));
      return `Upgrade to ${next.name} (${price(Market.price(state, { ...instance, rarity: next.id }))})`;
    },
    list(state) {
      const out = state.players[state.currentPlayer].storage.map((_, index) => ({ type: "UPGRADE_PART", index }));
      for (const unit of Units.allOf(state, state.currentPlayer)) {
        for (const place of ["base", "barrel", "mag", ...unit.weapon.attachments.map((_, i) => i)]) {
          out.push({ type: "UPGRADE_PART", unitId: unit.id, place });
        }
      }
      return out;
    },
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      if (a.unitId !== undefined) {
        const found = Units.find(state, a.unitId);
        if (!found || found.unit.owner !== state.currentPlayer) return no("Not your unit.");
        if (!Units.atBase(state, found)) return no("Units can only be equipped in reserve or next to your HQ / a deployable building.");
      }
      const instance = Rules.upgradeTarget(state, a);
      if (!instance) return no("Nothing there.");
      const next = Rarity.next(instance.rarity);
      if (!next) return no(instance.rarity ? "Already legendary." : "This part has no rarity.");
      const cost = Market.price(state, { ...instance, rarity: next }) ?? 0;
      if (state.players[state.currentPlayer].money < cost) return no("Not enough money.");
      return OK;
    },
    apply(state, a) {
      const instance = Rules.upgradeTarget(state, a);
      const next = Rarity.next(instance.rarity);
      state.players[state.currentPlayer].money -= Market.price(state, { ...instance, rarity: next }) ?? 0;
      instance.rarity = next;
    },
  },

  // Takes a part off a unit's weapon and puts it in storage.
  // A base can only come off once nothing else is on the weapon.
  UNEQUIP_PART: {
    label: () => "Unequip to storage",
    list(state) {
      const out = [];
      for (const unit of Units.allOf(state, state.currentPlayer)) {
        for (const place of ["base", "barrel", "mag", ...unit.weapon.attachments.map((_, i) => i)]) {
          out.push({ type: "UNEQUIP_PART", unitId: unit.id, place });
        }
      }
      return out;
    },
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      const found = Units.find(state, a.unitId);
      if (!found || found.unit.owner !== state.currentPlayer) return no("Not your unit.");
      if (!Units.atBase(state, found)) return no("Units can only be equipped in reserve or next to your HQ / a deployable building.");
      const weapon = found.unit.weapon;
      const instance = typeof a.place === "number" ? weapon.attachments[a.place] : weapon[a.place];
      if (!instance) return no("Nothing there.");
      if (a.place === "base" && Armory.installed(weapon).length > 1) return no("Take the other parts off first.");
      return OK;
    },
    apply(state, a) {
      const unit = Units.find(state, a.unitId).unit;
      const weapon = { ...unit.weapon, attachments: [...unit.weapon.attachments] };
      let instance;
      if (typeof a.place === "number") {
        instance = weapon.attachments[a.place];
        weapon.attachments[a.place] = null;
      } else {
        instance = weapon[a.place];
        weapon[a.place] = null;
      }
      unit.weapon = weapon;
      state.players[state.currentPlayer].storage.push(instance);
    },
  },

  // Locks (or unlocks) a market slot so it doesn't reroll next turn. Free.
  LOCK_OFFER: {
    label: (a, state) => (Market.slot(state, a.pile, a.slot).locked ? "Unlock (reroll next turn)" : "Lock (keep for a later turn)"),
    list(state) {
      const out = [];
      for (const pile of Market.PILES) {
        state.players[state.currentPlayer].market[pile].forEach((_, slot) => out.push({ type: "LOCK_OFFER", pile, slot }));
      }
      return out;
    },
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      return Market.offer(state, a.pile, a.slot) ? OK : no("Nothing to lock.");
    },
    apply(state, a) {
      const slot = Market.slot(state, a.pile, a.slot);
      slot.locked = !slot.locked;
    },
  },

  // ---- Buildings ----

  // A unit with the build ability builds on an empty square touching it.
  PLACE_BUILDING: {
    label(a, state) {
      const def = BUILDING_TYPES[a.buildingTypeId];
      const builder = state.spaces[a.from];
      return `Build ${def.name} (${price(Rules.buildingCost(state, a.buildingTypeId))}) · ${Units.def(builder.unit).name} ${builder.row + 1}-${builder.col + 1}`;
    },
    list(state) {
      const out = [];
      for (const from of Object.values(state.spaces)) {
        if (!from.unit || from.unit.owner !== state.currentPlayer || !Units.ability(from.unit, "build")) continue;
        for (const spaceId of Board.squareNeighbors(state.spaces, from)) {
          for (const buildingTypeId in BUILDING_TYPES) out.push({ type: "PLACE_BUILDING", from: from.id, spaceId, buildingTypeId });
        }
      }
      return out;
    },
    // PLACEHOLDER RULE: main phase only.
    check(state, a) {
      const phase = inPhase(state, "main");
      if (!phase.ok) return phase;
      const def = BUILDING_TYPES[a.buildingTypeId];
      if (!def) return no("Unknown building.");
      if (!def.buildable) return no(`${def.name} can't be built.`);
      const from = state.spaces[a.from];
      if (!from || !from.unit || from.unit.owner !== state.currentPlayer) return no("Not your unit.");
      const build = Units.ability(from.unit, "build");
      if (!build) return no("This unit can't build.");
      if (from.unit.buildsTaken >= build.perTurn) return no("This unit has already built this turn.");
      const space = state.spaces[a.spaceId];
      if (!space || space.kind !== "square") return no("Buildings go on squares.");
      if (!Board.squareNeighbors(state.spaces, from).includes(space.id)) return no("Must touch the builder.");
      if (space.building) return no("That square is occupied.");
      if (state.players[state.currentPlayer].money < (Rules.buildingCost(state, a.buildingTypeId) ?? 0)) return no("Not enough money.");
      return OK;
    },
    apply(state, a) {
      state.players[state.currentPlayer].money -= Rules.buildingCost(state, a.buildingTypeId) ?? 0;
      state.spaces[a.from].unit.buildsTaken++;
      state.spaces[a.spaceId].building = { typeId: a.buildingTypeId, owner: state.currentPlayer, builtBy: state.currentPlayer, siegeBy: null };
    },
  },
};

const Rules = {
  // `gameLength` is a key of CONFIG.gameLengths: "quick", "standard" or "long".
  createInitialState(gameLength = CONFIG.defaultGameLength) {
    const length = CONFIG.gameLengths[gameLength];
    const state = {
      spaces: Board.createSpaces(CONFIG.board.octagonRows, CONFIG.board.octagonCols),
      players: [],
      currentPlayer: 0,
      round: 1,
      turn: 1, // counts every player's turn
      phase: PHASES[0].id,
      winner: null,
      gameLength,
      rngState: Random.newSeed(),
      nextUnitId: 1,
    };
    state.players = CONFIG.players.map((p, i) => ({
      name: p.name,
      color: p.color,
      money: length.startingMoney,
      deploysThisTurn: 0,
      reserve: length.startingUnits.map((typeId) => Units.create(state, typeId, i)),
      market: Market.create(),
      storage: [], // part instances bought or replaced, waiting to be fitted
    }));
    Territory.placeStartingBuildings(state);
    Rules.enterPhase(state);
    return state;
  },

  // ---------- Fitting parts ----------

  // Can this part instance go into this place on one of the current player's units?
  checkFit(state, unitId, instance, place) {
    const found = Units.find(state, unitId);
    if (!found || found.unit.owner !== state.currentPlayer) return no("Not your unit.");
    if (!Units.atBase(state, found)) return no("Units can only be equipped in reserve or next to your HQ / a deployable building.");
    return Armory.canInstall(found.unit.weapon, instance.partId, place, found.unit);
  },

  // Puts the instance on the unit's weapon. Whatever was in that place goes to storage.
  fit(state, unitId, instance, place) {
    const unit = Units.find(state, unitId).unit;
    const replaced = WEAPON_PARTS[instance.partId].occupant(unit.weapon, place);
    if (replaced) state.players[unit.owner].storage.push(replaced);
    unit.weapon = Armory.install(unit.weapon, instance, place);
  },

  // The part instance an UPGRADE_PART action points at, or null.
  upgradeTarget(state, a) {
    if (a.unitId === undefined) return state.players[state.currentPlayer].storage[a.index] || null;
    const found = Units.find(state, a.unitId);
    if (!found) return null;
    const weapon = found.unit.weapon;
    return (typeof a.place === "number" ? weapon.attachments[a.place] : weapon[a.place]) || null;
  },

  // " in attachment 1 (replaces Red Dot)" for button labels.
  fitText(state, a) {
    const unit = Units.find(state, a.unitId).unit;
    const instance = a.type === "EQUIP_PART" ? state.players[state.currentPlayer].storage[a.index] : Market.offer(state, a.pile, a.slot);
    const replaced = WEAPON_PARTS[instance.partId].occupant(unit.weapon, a.place);
    const where = typeof a.place === "number" ? ` in attachment ${a.place + 1}` : "";
    return where + (replaced ? ` (${WEAPON_PARTS[replaced.partId].nameFor(replaced)} goes to storage)` : "");
  },

  // ---------- Money ----------

  // The settings for this game's length (CONFIG.gameLengths).
  length(state) {
    return CONFIG.gameLengths[state.gameLength];
  },

  // An item's price in this game: its own `cost` if it has one (a number, or one
  // per game length), otherwise `fallback` from the game length's price list.
  priceFor(state, item, fallback) {
    const own = item.cost;
    if (typeof own === "number") return own;
    if (own && typeof own[state.gameLength] === "number") return own[state.gameLength];
    return fallback ?? null;
  },

  // Price to buy a unit, or null if none is set.
  unitCost(state, unitTypeId) {
    const unit = UNIT_TYPES[unitTypeId];
    const costs = Rules.length(state).unitCosts;
    return Rules.priceFor(state, unit, costs[unitTypeId] ?? costs[unit.category]);
  },

  // Price to build a building, or null if none is set.
  buildingCost(state, buildingTypeId) {
    const costs = Rules.length(state).buildingCosts;
    return Rules.priceFor(state, BUILDING_TYPES[buildingTypeId], costs[buildingTypeId] ?? costs.default);
  },

  // Money the current player gains at the beginning of their turn:
  // 1 + 1 for every unit they have that isn't deployed.
  income(state) {
    return CONFIG.income.base + CONFIG.income.perReserveUnit * state.players[state.currentPlayer].reserve.length;
  },

  // Built-in beginning-of-turn rule.
  startTurn(state) {
    Territory.resolveSieges(state, state.currentPlayer);
    Units.resetTurn(state, state.currentPlayer);
    state.players[state.currentPlayer].deploysThisTurn = 0;
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
      state.turn++;
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

  // Runs every "at the beginning/end of each turn" effect. Any unit or building
  // type with `triggers: { <phaseId>(state, space) {...} }` in data/ reacts here.
  // Every piece triggers on EVERY player's turn; state.currentPlayer says whose
  // turn it is if a trigger only cares about one side.
  runPhaseTriggers(state, phaseId) {
    for (const space of Object.values(state.spaces)) {
      const piece = space.unit || space.building;
      if (!piece) continue;
      const def = space.unit ? UNIT_TYPES[piece.typeId] : BUILDING_TYPES[piece.typeId];
      const trigger = def && def.triggers && def.triggers[phaseId];
      if (trigger) trigger(state, space);
    }
    Rules.settle(state);
  },

  // Things that follow automatically from any change: dead units are removed,
  // sieges start or end, and the winner is checked.
  settle(state) {
    Units.removeDead(state);
    Territory.updateSieges(state);
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

  // Legal actions on one market offer: buying it onto `unitId`, into storage, or locking it.
  getActionsForOffer(state, pile, slot, unitId) {
    return Rules.getLegalActions(state).filter(
      (a) => a.pile === pile && a.slot === slot && (a.type !== "BUY_PART" || a.unitId === unitId)
    );
  },

  // Legal actions on one stored part: fitting it onto `unitId`, upgrading it, and selling it.
  getActionsForStored(state, index, unitId) {
    return Rules.getLegalActions(state).filter(
      (a) =>
        a.index === index &&
        (a.type === "SELL_PART" || (a.type === "UPGRADE_PART" && a.unitId === undefined) || (a.type === "EQUIP_PART" && a.unitId === unitId))
    );
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
    Rules.settle(next);
    return next;
  },

  // Capturing an enemy HQ (any building with `capturingWins`) ends the game,
  // and whoever captured it wins.
  checkWinner(state) {
    for (const space of Object.values(state.spaces)) {
      const b = space.building;
      if (b && BUILDING_TYPES[b.typeId].capturingWins && b.owner !== b.builtBy) return b.owner;
    }
    return null;
  },
};
