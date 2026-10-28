// =============================================================
// rarity.js — Common / Uncommon / Rare / Epic / Legendary.
// Pure logic, no drawing. The list itself lives in CONFIG.rarities.
// =============================================================

const Rarity = {
  get(id) {
    return CONFIG.rarities.find((r) => r.id === id) || null;
  },

  multiplier(id) {
    return Rarity.get(id).multiplier;
  },

  // Rolls a random rarity id using the weights in CONFIG.rarities.
  roll(state) {
    return Random.weighted(state, CONFIG.rarities).id;
  },
};
