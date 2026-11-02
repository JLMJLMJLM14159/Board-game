// =============================================================
// events.js — TRIGGERS. Every time something happens in the game,
// the rules call Events.emit(state, "eventName", { ...details }).
// Any unit type, building type or weapon part can react by adding
//
//   triggers: {
//     turnStart(ctx) { ... },
//     unitDied(ctx) { ... },
//     any(ctx) { ... },          // runs for EVERY event (ctx.event says which)
//   }
//
// to its entry in js/data/. A trigger belongs to an OWNER (the player who
// owns the unit, building, or unit carrying the part), and there's only one
// version of each event: the trigger works out what the event means for its
// owner as it fires, using ctx:
//
//   ctx.state       the game state (change it directly)
//   ctx.event       the event's name
//   ctx.owner       the trigger's owner (player index)
//   ctx.self        the unit or building the trigger belongs to
//   ctx.part        the part instance, if the trigger is on a weapon part
//   ctx.space       where `self` is on the board (null if in reserve)
//   ctx.mine(p)     is player / unit / building p the owner's (or owned by them)?
//   ctx.ownersTurn  is it the owner's turn right now?
//   ctx.isSelf(u)   is unit / building u the trigger's own piece?
//   ...plus that event's details below.
//
// So "at the start of YOUR turn" is turnStart + ctx.ownersTurn, "at the start of
// your OPPONENT's turn" is turnStart + !ctx.ownersTurn, "when an ENEMY unit dies"
// is unitDied + !ctx.mine(ctx.unit), "when THIS unit dies" is ctx.isSelf(ctx.unit).
//
// Events and their details (`player` is always whoever caused it / whose turn):
//   Turns:      turnStart, turnEnd           { player }
//               phaseStart                   { player, phase }
//               incomeGained                 { player, amount }
//   Units:      unitBought                   { player, unit }
//               unitDeployed                 { player, unit, space }
//               unitReserved                 { player, unit, space }  (space it left)
//               unitMoved                    { player, unit, from, to }
//               unitShot                     { player, unit (shooter), target, damage }
//               unitDamaged                  { player, unit, amount, source }
//               unitHealed                   { player, unit, healer }
//               unitDied                     { player, unit, space }  (the unit can react too)
//               countersChanged              { player, unit, element, amount, before, after }
//                                            (amount > 0 adds positive counters, < 0 negative)
//               countersCleared              { player, unit, before }
//   Parts:      partBought                   { player, part, unit|null }  (null = into storage)
//               partEquipped                 { player, part, unit, replaced|null }
//               partUnequipped               { player, part, unit }
//               partUpgraded                 { player, part, from, to, unit|null }
//               partSold                     { player, part, amount }
//               offerLocked                  { player, part, locked }
//   Board:      buildingBuilt                { player, building, space, unit (builder) }
//               territoryClaimed             { player, space, from (old controller), unit }
//               siegeStarted, siegeEnded     { player (besieger), building, space }
//               buildingCaptured             { player (new owner), building, space, from }
//               gameWon                      { player }
// =============================================================

const Events = {
  depth: 0,

  // Every piece that can have triggers right now, with its owner.
  listeners(state) {
    const out = [];
    for (const space of Object.values(state.spaces)) {
      if (space.unit) Events.unitListeners(space.unit, space, out);
      if (space.building) {
        const def = BUILDING_TYPES[space.building.typeId];
        out.push({ triggers: def.triggers, owner: space.building.owner, self: space.building, space });
      }
    }
    for (const player of state.players) {
      for (const unit of player.reserve) Events.unitListeners(unit, null, out);
    }
    return out;
  },

  // A unit, plus every part on its weapon.
  unitListeners(unit, space, out = []) {
    out.push({ triggers: UNIT_TYPES[unit.typeId].triggers, owner: unit.owner, self: unit, space });
    for (const instance of Armory.installed(unit.weapon)) {
      const triggers = WEAPON_PARTS[instance.partId].versionFor(instance).triggers;
      out.push({ triggers, owner: unit.owner, self: unit, part: instance, space });
    }
    return out;
  },

  // Tells every listener (and any `extra` ones, e.g. a unit that just died) about an event.
  emit(state, event, details = {}, extra = []) {
    // Stop runaway chains, e.g. two triggers that keep setting each other off.
    if (Events.depth >= CONFIG.maxTriggerDepth) return;
    Events.depth++;
    try {
      for (const l of [...Events.listeners(state), ...extra]) {
        const triggers = l.triggers || {};
        for (const fn of [triggers[event], triggers.any]) {
          if (!fn) continue;
          fn({
            state,
            event,
            ...details,
            owner: l.owner,
            self: l.self,
            part: l.part || null,
            space: l.space,
            mine: (x) => (typeof x === "number" ? x : x && x.owner) === l.owner,
            ownersTurn: state.currentPlayer === l.owner,
            isSelf: (x) => x === l.self,
          });
        }
      }
    } finally {
      Events.depth--;
    }
  },
};
