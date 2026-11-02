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

  // The rarity one step up, or null for legendary (or no rarity).
  next(id) {
    const i = CONFIG.rarities.findIndex((r) => r.id === id);
    return i >= 0 && i < CONFIG.rarities.length - 1 ? CONFIG.rarities[i + 1].id : null;
  },

  // The rarity one step down, or null for common (or no rarity).
  previous(id) {
    const i = CONFIG.rarities.findIndex((r) => r.id === id);
    return i > 0 ? CONFIG.rarities[i - 1].id : null;
  },

  // Rolls a random rarity id using the weights in CONFIG.rarities.
  roll(state) {
    return Random.weighted(state, CONFIG.rarities).id;
  },
};
