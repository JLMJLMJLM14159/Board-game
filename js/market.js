// =============================================================
// market.js — the weapon parts offered each main phase.
// Pure logic, no drawing.
//
// Each player has their own market (player.market), one row per pile:
//   {
//     bases:       [{ item: partInstance | null, locked: false }, ...],  // weapon bases
//     parts:       [...],   // barrels and mags
//     attachments: [...],   // attachments for both military weapons and support units
//   }
// The number of slots in each row is set in CONFIG.market.
// At the start of your main phase every slot rerolls, except LOCKED ones,
// which keep their offer so you can buy it on a later turn.
// A bought offer leaves its slot empty (and unlocked) until the next reroll.
// Rarity is rolled the moment a part appears here.
// =============================================================

const Market = {
  PILES: ["bases", "parts", "attachments"],

  // Which pile a catalogue part is offered in.
  pileOf(part) {
    if (part instanceof WeaponBase) return "bases";
    if (part.slot === "attachments") return "attachments";
    return "parts";
  },

  create() {
    const slots = (n) => Array.from({ length: n }, () => ({ item: null, locked: false }));
    return Object.fromEntries(Market.PILES.map((pile) => [pile, slots(CONFIG.market[pile])]));
  },

  // Rerolls every unlocked slot in the current player's market. Each offer is any
  // part from the catalogue with equal chance (repeats allowed); its rarity is
  // then rolled with the weights in CONFIG.rarities.
  refresh(state) {
    const market = state.players[state.currentPlayer].market;
    const all = Object.values(WEAPON_PARTS);
    for (const pile of Market.PILES) {
      const pool = all.filter((p) => Market.pileOf(p) === pile);
      for (const slot of market[pile]) {
        if (!slot.locked) slot.item = Market.draw(state, pool);
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
