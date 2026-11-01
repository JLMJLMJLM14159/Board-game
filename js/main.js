// =============================================================
// main.js — connects Rules and UI. Holds the current state,
// the undo history and what's selected.
// =============================================================

let state = Rules.createInitialState();
let history = [];
let selection = null;
let focusUnitId = null; // the unit whose weapon menu is showing

function refresh() {
  UI.render(state, selection, history.length > 0, focusUnitId);
}

UI.init({
  onSelect(next) {
    selection = next;
    const space = next.kind === "space" && state.spaces[next.id];
    if (space && space.unit) focusUnitId = space.unit.id;
    refresh();
  },

  onAction(action) {
    try {
      const previousPlayer = state.currentPlayer;
      history.push(state);
      state = Rules.applyAction(state, action);
      if (state.currentPlayer !== previousPlayer) {
        selection = null;
        focusUnitId = null;
      }
      // Keep a moving unit selected so it can keep moving.
      if (action.type === "MOVE_UNIT") selection = { kind: "space", id: action.to };
      // Show the unit that was just deployed, and its weapon.
      if (action.type === "DEPLOY_UNIT") {
        selection = { kind: "space", id: action.spaceId };
        focusUnitId = state.spaces[action.spaceId].unit.id;
      }
    } catch (err) {
      history.pop();
      alert(err.message);
    }
    refresh();
  },

  onUndo() {
    if (history.length === 0) return;
    state = history.pop();
    refresh();
  },

  onRestart() {
    if (!confirm("Restart the game?")) return;
    state = Rules.createInitialState();
    history = [];
    selection = null;
    focusUnitId = null;
    refresh();
  },
});

refresh();
