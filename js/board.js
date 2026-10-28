// =============================================================
// board.js — the SHAPE of the main board: which spaces exist and
// which are next to which. Pure logic, no drawing.
//
// Layout (octagons = O, squares = S):
//
//     O   O   O
//       S   S
//     O   O   O
//       S   S
//     O   O   O
//
// Octagon (r, c) touches:
//   - octagons above/below/left/right (shared edges)
//   - the up-to-4 squares at its diagonal corners
// Square (r, c) sits between octagons (r,c), (r,c+1), (r+1,c), (r+1,c+1)
// and touches only those 4 octagons.
// =============================================================

const Board = {
  octagonId: (r, c) => `O-${r}-${c}`,
  squareId: (r, c) => `S-${r}-${c}`,

  // Builds every space as an object. Octagons hold a `unit`, squares a `building`.
  createSpaces(rows, cols) {
    const spaces = {};
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = Board.octagonId(r, c);
        spaces[id] = { id, kind: "octagon", row: r, col: c, unit: null };
      }
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const id = Board.squareId(r, c);
        spaces[id] = { id, kind: "square", row: r, col: c, building: null };
      }
    }
    return spaces;
  },

  // All spaces touching `space`, as ids.
  neighbors(spaces, space) {
    const { row: r, col: c } = space;
    const candidates =
      space.kind === "octagon"
        ? [
            Board.octagonId(r - 1, c), Board.octagonId(r + 1, c),
            Board.octagonId(r, c - 1), Board.octagonId(r, c + 1),
            Board.squareId(r - 1, c - 1), Board.squareId(r - 1, c),
            Board.squareId(r, c - 1), Board.squareId(r, c),
          ]
        : [
            Board.octagonId(r, c), Board.octagonId(r, c + 1),
            Board.octagonId(r + 1, c), Board.octagonId(r + 1, c + 1),
          ];
    return candidates.filter((id) => spaces[id]);
  },

  // Neighbouring octagons only (handy for unit movement later).
  octagonNeighbors(spaces, space) {
    return Board.neighbors(spaces, space).filter((id) => spaces[id].kind === "octagon");
  },

  // Neighbouring squares only (handy for buildings affecting units later).
  squareNeighbors(spaces, space) {
    return Board.neighbors(spaces, space).filter((id) => spaces[id].kind === "square");
  },
};
