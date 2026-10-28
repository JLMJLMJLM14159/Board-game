// =============================================================
// synergy.js — the Thermal / Electrical / Biological circle.
// Pure logic, no drawing.
// =============================================================

const Synergy = {
  ids() {
    return CONFIG.synergyElements.map((e) => e.id);
  },

  get(id) {
    return CONFIG.synergyElements.find((e) => e.id === id) || null;
  },

  // The element after `id` going round the circle.
  next(id) {
    const ids = Synergy.ids();
    return ids[(ids.indexOf(id) + 1) % ids.length];
  },

  // The element before `id` going round the circle.
  previous(id) {
    const ids = Synergy.ids();
    return ids[(ids.indexOf(id) - 1 + ids.length) % ids.length];
  },

  // How element `a` relates to element `b`.
  // Returns "same", "forward" (b comes after a) or "backward" (b comes before a).
  // PLACEHOLDER RULE: what "forward"/"backward" MEAN (bonus, counter,
  // combo...) isn't decided yet. Put that in effectOf().
  relation(a, b) {
    if (!a || !b) return null;
    if (a === b) return "same";
    return Synergy.next(a) === b ? "forward" : "backward";
  },

  // PLACEHOLDER RULE: the gameplay effect of a relation. Fill in once decided.
  effectOf(relation) {
    return null;
  },

  // Counts each element across a list of things that have a `synergy` field,
  // e.g. all parts on a weapon. Returns { thermal: 0, electrical: 2, ... }.
  tally(items) {
    const counts = {};
    for (const id of Synergy.ids()) counts[id] = 0;
    for (const item of items) {
      if (item && item.synergy && counts[item.synergy] !== undefined) {
        counts[item.synergy]++;
      }
    }
    return counts;
  },
};
