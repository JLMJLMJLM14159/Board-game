// =============================================================
// market.js — the weapon parts offered each main phase.
// Pure logic, no drawing.
//
// state.market = {
//   bases: [partInstance | null, ...],   // CONFIG.market.bases offers
//   parts: [partInstance | null, ...],   // CONFIG.market.parts offers (no bases)
// }
// A taken offer becomes null so the others keep their places.
// Rarity is rolled the moment a part appears here.
// =============================================================

const Market = {
  // Deals a fresh market for the current player.
  // PLACEHOLDER RULE: each offer is any part from the catalogue with equal
  // chance (repeats allowed), and last turn's leftovers are thrown away.
  refresh(state) {
    const all = Object.values(WEAPON_PARTS);
    state.market = {
      bases: Market.draw(state, all.filter((p) => p instanceof WeaponBase), CONFIG.market.bases),
      parts: Market.draw(state, all.filter((p) => !(p instanceof WeaponBase)), CONFIG.market.parts),
    };
  },

  draw(state, pool, count) {
    if (pool.length === 0) return [];
    return Array.from({ length: count }, () => {
      const part = pool[Math.floor(Random.next(state) * pool.length)];
      return part.createInstance(state);
    });
  },

  offer(state, pile, slot) {
    const list = state.market && state.market[pile];
    return (list && list[slot]) || null;
  },
};
