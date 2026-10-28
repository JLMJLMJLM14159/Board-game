// =============================================================
// main.js — connects Rules and UI. Holds the current state,
// the undo history and what's selected.
// =============================================================

let state = Rules.createInitialState();
let history = [];
let selection = null;

function refresh() {
  UI.render(state, selection, history.length > 0);
}

UI.init({
  onSelect(next) {
    selection = next;
    refresh();
  },

  onAction(action) {
    try {
      const previousPlayer = state.currentPlayer;
      history.push(state);
      state = Rules.applyAction(state, action);
      if (state.currentPlayer !== previousPlayer) selection = null;
      // Keep a moving unit selected so it can keep moving.
      if (action.type === "MOVE_UNIT") selection = { kind: "space", id: action.to };
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
    refresh();
  },
});

refresh();
