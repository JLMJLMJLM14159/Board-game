// =============================================================
// main.js — connects Rules and UI. Holds the current state,
// the undo history and what's selected.
// =============================================================

let state = Rules.createInitialState();
let newGameOpen = true; // the new game screen shows first, to pick a game length
let gameStarted = false;
let history = [];
let selection = null;
let focusUnitId = null; // the unit whose weapon menu is showing

function refresh() {
  UI.render(state, selection, history.length > 0, focusUnitId);
  UI.renderNewGame(newGameOpen, gameStarted);
}

UI.init({
  onSelect(next) {
    selection = next;
    const space = next.kind === "space" && state.spaces[next.id];
    if (space && space.unit) focusUnitId = space.unit.id;
    if (next.kind === "reserveUnit") focusUnitId = next.unitId;
    refresh();
  },

  // Shows a unit's weapon in the weapon menu without changing the selection.
  onFocus(unitId) {
    focusUnitId = unitId;
    refresh();
  },

  // Several actions as one undoable step, e.g. walking a unit several octagons.
  onActions(actions) {
    const before = state;
    try {
      for (const action of actions) state = Rules.applyAction(state, action);
      history.push(before);
      const last = actions[actions.length - 1];
      if (last.type === "MOVE_UNIT") selection = { kind: "space", id: last.to };
    } catch (err) {
      state = before;
      alert(err.message);
    }
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
    newGameOpen = true;
    refresh();
  },

  // Starts a new game of the chosen length, or (null) goes back to the current one.
  onNewGame(gameLength) {
    newGameOpen = false;
    if (gameLength) {
      state = Rules.createInitialState(gameLength);
      history = [];
      selection = null;
      focusUnitId = null;
      gameStarted = true;
    }
    refresh();
  },
});

refresh();
