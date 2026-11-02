// =============================================================
// territory.js — who controls which spaces. Pure logic, no drawing.
//
// - An octagon is controlled by the last player whose MILITARY unit stood on it
//   (space.controller), and stays theirs until an enemy military unit steps on it.
//   Civilian units never take control, so they can't help capture buildings.
// - A building (on a square) belongs to space.building.owner. It's captured
//   when another player controls CONFIG.captureThreshold of the 4 octagons
//   around it.
// - Units deploy onto empty octagons touching one of your DEPLOYABLE buildings.
// - Units with the build ability (the Builder) build on empty squares touching them.
// - Capturing a building with `capturingWins` (the HQ) wins the game.
// =============================================================

const Territory = {
  // Gives a player control of an octagon.
  claim(space, player) {
    space.controller = player;
  },

  // A unit arriving on an octagon claims it, unless it's a civilian.
  claimBy(space, unit) {
    if (!Units.isCivilian(unit)) Territory.claim(space, unit.owner);
  },

  // How many of the octagons around a square each player controls,
  // worked out when asked: { 0: 2, 1: 1 }.
  controlAround(state, square) {
    const counts = {};
    for (const id of Board.neighbors(state.spaces, square)) {
      const c = state.spaces[id].controller;
      if (c !== null) counts[c] = (counts[c] || 0) + 1;
    }
    return counts;
  },

  // Hands every building over to an enemy controlling enough octagons around it.
  // Runs after every action and phase, which are the moments control can change.
  captureBuildings(state) {
    for (const space of Object.values(state.spaces)) {
      if (!space.building) continue;
      const counts = Territory.controlAround(state, space);
      for (const [player, count] of Object.entries(counts)) {
        if (Number(player) !== space.building.owner && count >= CONFIG.captureThreshold) {
          space.building.owner = Number(player);
        }
      }
    }
  },

  // Can `player` deploy a unit onto this octagon?
  canDeployAt(state, player, octagon) {
    return Board.squareNeighbors(state.spaces, octagon).some((id) => {
      const b = state.spaces[id].building;
      return b && b.owner === player && BUILDING_TYPES[b.typeId].deployable;
    });
  },

  // Puts each player's starting buildings (CONFIG.startingBuildings) on the board.
  // Each starting building also gives its owner the 4 octagons around it.
  placeStartingBuildings(state) {
    CONFIG.startingBuildings.forEach((buildings, player) => {
      for (const { typeId, row, col } of buildings) {
        const square = state.spaces[Board.squareId(row, col)];
        if (!square) throw new Error(`Starting ${typeId} for player ${player + 1} is off the board (square ${row}, ${col}).`);
        square.building = { typeId, owner: player, builtBy: player };
        for (const id of Board.neighbors(state.spaces, square)) Territory.claim(state.spaces[id], player);
      }
    });
  },
};
