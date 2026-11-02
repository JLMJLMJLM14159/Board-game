// =============================================================
// market.js — the weapon parts offered each main phase.
// Pure logic, no drawing.
//
// Each player has their own market (player.market):
//   {
//     bases: [{ item: partInstance | null, locked: false }, ...],  // CONFIG.market.bases slots
//     parts: [{ item: partInstance | null, locked: false }, ...],  // CONFIG.market.parts slots
//   }
// At the start of your main phase every slot rerolls, except LOCKED ones,
// which keep their offer so you can buy it on a later turn.
// A bought offer leaves its slot empty (and unlocked) until the next reroll.
// Rarity is rolled the moment a part appears here.
// =============================================================

const Market = {
  create() {
    const slots = (n) => Array.from({ length: n }, () => ({ item: null, locked: false }));
    return { bases: slots(CONFIG.market.bases), parts: slots(CONFIG.market.parts) };
  },

  // Rerolls every unlocked slot in the current player's market. Each offer is any
  // part from the catalogue with equal chance (repeats allowed); its rarity is
  // then rolled with the weights in CONFIG.rarities.
  refresh(state) {
    const market = state.players[state.currentPlayer].market;
    const all = Object.values(WEAPON_PARTS);
    const pools = {
      bases: all.filter((p) => p instanceof WeaponBase),
      parts: all.filter((p) => !(p instanceof WeaponBase)),
    };
    for (const pile of ["bases", "parts"]) {
      for (const slot of market[pile]) {
        if (!slot.locked) slot.item = Market.draw(state, pools[pile]);
      }
    }
  },

  draw(state, pool) {
    if (pool.length === 0) return null;
    return pool[Math.floor(Random.next(state) * pool.length)].createInstance(state);
  },

  slot(state, pile, slot) {
    const list = state.players[state.currentPlayer].market[pile];
    return (list && list[slot]) || null;
  },

  // The part instance on offer in a slot, or null.
  offer(state, pile, slot) {
    const s = Market.slot(state, pile, slot);
    return s ? s.item : null;
  },

  // Price of an offer: the part's price for this game length, plus its
  // rarity's extra cost ($1 per step up). null if no price is set anywhere.
  price(state, instance) {
    const part = WEAPON_PARTS[instance.partId];
    const kind = part.slot === "attachments" ? "attachment" : part.slot;
    const cost = Rules.priceFor(state, part, Rules.length(state).partCosts[kind]);
    if (cost === null) return null;
    return cost + (instance.rarity ? Rarity.get(instance.rarity).extraCost : 0);
  },

  // Money back for selling a part: CONFIG.sellRate of its price, rounded down.
  sellValue(state, instance) {
    return Math.floor((Market.price(state, instance) ?? 0) * CONFIG.sellRate);
  },
};
