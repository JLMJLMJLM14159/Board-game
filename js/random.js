// =============================================================
// random.js — all the game's randomness comes from here.
//
// The random number generator's position is stored IN the game
// state (state.rngState). That means Undo also rewinds the dice:
// undoing a roll and doing it again gives the same result, so
// players can't undo their way to a better rarity.
// =============================================================

const Random = {
  newSeed() {
    return Math.floor(Math.random() * 2 ** 32);
  },

  // A number from 0 (inclusive) to 1 (exclusive). Advances state.rngState.
  // (Mulberry32: a small, well-known seeded generator.)
  next(state) {
    let t = (state.rngState = (state.rngState + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },

  // Picks one item from a list, where items with a bigger `weight` are more likely.
  weighted(state, items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    let roll = Random.next(state) * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  },
};
