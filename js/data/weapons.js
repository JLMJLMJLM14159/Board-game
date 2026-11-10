// =============================================================
// data/weapons.js — the catalogue of weapon parts, bases included.
// The classes are defined in js/parts.js.
//
// What each slot is for:
//   Base        the unit's STARTING shooting stats (replace the unit's defaults)
//   Barrel      stats: range and untyped damage
//   Mag         stats: shots, and the shot's damage TYPE (the ammo)
//   Muzzle      what happens to the target when hit (mostly counters on enemies)
//   Stock       triggers about anything (no stats of its own)
//   Attachment  anything; a unit can't carry two of the same attachment
//   SupportAttachment   attachments for Builders / Medics only
//
// Every non-base part gets a random rarity when it appears in the market.
// Rarity only multiplies the stats listed in `rarityStats` (shown bold in the
// rarity colour). Parts with triggers keep their trigger strengths in `stats`
// too (e.g. onHitThermal) and read them with ctx.value(...), so they also scale
// with rarity and show on the part. See js/events.js for every trigger event.
//
// ---- The counter themes these example parts use ----
// Counters do nothing by themselves; these parts give them meaning:
//   Thermal     NEGATIVE thermal = burning. Muzzles apply it; the Pyre Stock burns it.
//   Electrical  POSITIVE electrical = charge, built up on your own unit by the
//               Capacitor Stock and discharged as a big hit. NEGATIVE electrical =
//               shorted, put on enemies by the Arc Choke; Insulated Plating resists it.
//   Biological  NEGATIVE biological = infection. Spore Diffusers apply it, the
//               Contagion Stock spreads it, the Catalyst Scanner exploits it and the
//               Medic's Antitoxin Kit cures it.
// PLACEHOLDER: every part below is an example to playtest with; change freely.
// =============================================================

// Small helpers for the triggers below.
const Fx = {
  // Is the trigger's unit on the board (not in reserve)?
  deployed: (ctx) => ctx.selfSpace !== null,

  // Did this trigger's own unit just shoot an enemy? (Friendly shots do nothing.)
  shotEnemy: (ctx) => ctx.isSelf(ctx.unit) && !ctx.friendly,

  // Enemy units (of the trigger's owner) on the octagons next to a space.
  adjacentEnemies: (ctx, space) =>
    Board.octagonNeighbors(ctx.state.spaces, space)
      .map((id) => ctx.state.spaces[id].unit)
      .filter((u) => u && !ctx.mine(u)),

  // The trigger owner's own units next to a space.
  adjacentFriends: (ctx, space) =>
    Board.octagonNeighbors(ctx.state.spaces, space)
      .map((id) => ctx.state.spaces[id].unit)
      .filter((u) => u && ctx.mine(u)),

  // Every enemy unit on the board.
  enemiesOnBoard: (ctx) => Object.values(ctx.state.spaces).map((s) => s.unit).filter((u) => u && !ctx.mine(u)),

  // Restores some health (never above max).
  heal: (unit, amount) => {
    unit.damageTaken = Math.max(0, unit.damageTaken - amount);
  },
};

const WEAPON_PARTS = partCatalogue([
  // ================= Bases (starting stats, no rarity) =================
  new WeaponBase({
    id: "ion_sidearm",
    name: "Ion Sidearm",
    stats: { range: 2, damage: 2, shots: 1 },
    description: "A cheap, reliable sidearm. Nothing fancy.",
  }),
  new WeaponBase({
    id: "scrap_rifle",
    name: "Scrap Rifle",
    stats: { range: 3, damage: 3, shots: 1 },
    description: "Welded together from salvage. Hits hard at medium range.",
  }),
  new WeaponBase({
    id: "rail_cannon",
    name: "Rail Cannon",
    stats: { range: 5, damage: 5, shots: 1, movement: 1 },
    description: "Huge range and damage, but the carrier can only move 1 step a turn.",
  }),
  new WeaponBase({
    id: "swarm_repeater",
    name: "Swarm Repeater",
    stats: { range: 2, damage: 1, shots: 3 },
    description: "Three weak shots a turn. Great for spreading counters from muzzles.",
  }),

  // ================= Barrels (stats) =================
  new Barrel({
    id: "extended_barrel",
    name: "Extended Barrel",
    stats: { range: 1 },
    rarityStats: ["range"],
    description: "More range.",
  }),
  new Barrel({
    id: "coil_barrel",
    name: "Coil Barrel",
    stats: { damage: 1, movement: -1 },
    rarityStats: ["damage"],
    description: "Magnetic coils add punch, but it's heavy.",
    legendary: {
      name: "Singularity Coil",
      stats: { damage: 10, range: 2 },
      description: "A barrel that bends space. +10 damage, +2 range, no weight penalty.",
    },
  }),
  new Barrel({
    id: "sawn_barrel",
    name: "Sawn-off Barrel",
    stats: { damage: 2, range: -1 },
    rarityStats: ["damage"],
    description: "Brutal up close, worse at range.",
  }),

  // ================= Mags (stats: shots and damage type) =================
  new Mag({
    id: "incendiary_rounds",
    name: "Incendiary Rounds",
    stats: { thermalDamage: 1 },
    rarityStats: ["thermalDamage"],
    description: "Adds thermal damage to every shot.",
  }),
  new Mag({
    id: "shock_cells",
    name: "Shock Cells",
    stats: { electricalDamage: 1 },
    rarityStats: ["electricalDamage"],
    description: "Adds electrical damage to every shot.",
  }),
  new Mag({
    id: "toxin_darts",
    name: "Toxin Darts",
    stats: { biologicalDamage: 1 },
    rarityStats: ["biologicalDamage"],
    description: "Adds biological damage to every shot.",
  }),
  new Mag({
    id: "drum_mag",
    name: "Drum Mag",
    stats: { shots: 1, damage: -1 },
    description: "One more shot a turn, but each shot is weaker.",
    legendary: {
      name: "Endless Belt",
      stats: { shots: 2 },
      description: "Two more shots a turn, with no damage penalty.",
    },
  }),

  // ================= Muzzles (what happens to the target) =================
  new Muzzle({
    id: "igniter_nozzle",
    name: "Igniter Nozzle",
    stats: { onHitThermal: -1 },
    rarityStats: ["onHitThermal"],
    description: "Shots that hit an enemy set it burning: it gains negative thermal counters.",
    triggers: {
      unitShot(ctx) {
        if (Fx.shotEnemy(ctx)) Units.addCounters(ctx.state, ctx.target, "thermal", ctx.value("onHitThermal"));
      },
    },
    legendary: {
      name: "Sunfire Nozzle",
      stats: { onHitThermal: -6, range: 1 },
      description: "Shots give the enemy 6 negative thermal counters. +1 range.",
    },
  }),
  new Muzzle({
    id: "arc_choke",
    name: "Arc Choke",
    stats: { onHitElectrical: -1 },
    rarityStats: ["onHitElectrical"],
    description: "Shots that hit an enemy short it out: it gains negative electrical counters.",
    triggers: {
      unitShot(ctx) {
        if (Fx.shotEnemy(ctx)) Units.addCounters(ctx.state, ctx.target, "electrical", ctx.value("onHitElectrical"));
      },
    },
  }),
  new Muzzle({
    id: "spore_diffuser",
    name: "Spore Diffuser",
    stats: { onHitBiological: -1 },
    rarityStats: ["onHitBiological"],
    description: "Shots that hit an enemy infect it: it gains negative biological counters.",
    triggers: {
      unitShot(ctx) {
        if (Fx.shotEnemy(ctx)) Units.addCounters(ctx.state, ctx.target, "biological", ctx.value("onHitBiological"));
      },
    },
  }),
  new Muzzle({
    id: "compensator",
    name: "Compensator",
    stats: { damage: 1 },
    rarityStats: ["damage"],
    description: "A plain muzzle brake: a little more damage, no tricks.",
  }),

  // ================= Stocks (triggers about anything) =================
  new Stock({
    id: "pyre_stock",
    name: "Pyre Stock",
    stats: { burnPerCounter: 1 },
    rarityStats: ["burnPerCounter"],
    description:
      "At the start of your turn, every burning enemy (negative thermal counters) takes thermal damage for each counter.",
    triggers: {
      turnStart(ctx) {
        if (!ctx.ownersTurn || !Fx.deployed(ctx)) return;
        for (const enemy of Fx.enemiesOnBoard(ctx)) {
          const burning = -Math.min(0, Units.counters(enemy, "thermal"));
          if (burning > 0) Units.dealDamage(ctx.state, enemy, burning * ctx.value("burnPerCounter"), ctx.self, "thermal");
        }
      },
    },
  }),
  new Stock({
    id: "capacitor_stock",
    name: "Capacitor Stock",
    stats: { chargePerShot: 1, dischargeAt: 3 },
    rarityStats: ["chargePerShot"],
    description:
      "Each shot at an enemy charges this unit (positive electrical counters). Once it has enough charge, its next shot discharges all of it as extra electrical damage.",
    triggers: {
      unitShot(ctx) {
        if (!Fx.shotEnemy(ctx)) return;
        const charge = Math.max(0, Units.counters(ctx.self, "electrical"));
        if (charge >= ctx.value("dischargeAt")) {
          Units.addCounters(ctx.state, ctx.self, "electrical", -charge);
          Units.dealDamage(ctx.state, ctx.target, charge, ctx.self, "electrical");
        } else {
          Units.addCounters(ctx.state, ctx.self, "electrical", ctx.value("chargePerShot"));
        }
      },
    },
  }),
  new Stock({
    id: "braced_stock",
    name: "Braced Stock",
    stats: { stillBonus: 2 },
    rarityStats: ["stillBonus"],
    description: "Shots fired before this unit moves this turn deal extra damage.",
    triggers: {
      unitShot(ctx) {
        if (Fx.shotEnemy(ctx) && ctx.self.stepsTaken === 0) {
          Units.dealDamage(ctx.state, ctx.target, ctx.value("stillBonus"), ctx.self, "untyped");
        }
      },
    },
  }),
  new Stock({
    id: "contagion_stock",
    name: "Contagion Stock",
    stats: {},
    description:
      "When an infected enemy (negative biological counters) dies, every enemy next to it catches the same number of counters.",
    triggers: {
      unitDied(ctx) {
        if (!Fx.deployed(ctx) || ctx.mine(ctx.unit)) return;
        const infection = Math.min(0, Units.counters(ctx.unit, "biological"));
        if (infection === 0) return;
        for (const enemy of Fx.adjacentEnemies(ctx, ctx.space)) Units.addCounters(ctx.state, enemy, "biological", infection);
      },
    },
  }),

  // ================= Attachments (anything) =================
  new Attachment({
    id: "red_dot",
    name: "Red Dot Sight",
    stats: { range: 1 },
    rarityStats: ["range"],
    description: "More range.",
  }),
  new Attachment({
    id: "leech_coil",
    name: "Leech Coil",
    stats: { lifesteal: 1 },
    rarityStats: ["lifesteal"],
    description: "Whenever this unit damages an enemy, it heals.",
    triggers: {
      unitDamaged(ctx) {
        if (ctx.isSelf(ctx.source) && !ctx.mine(ctx.unit)) Fx.heal(ctx.self, ctx.value("lifesteal"));
      },
    },
  }),
  new Attachment({
    id: "catalyst_scanner",
    name: "Catalyst Scanner",
    stats: { catalystBonus: 1 },
    rarityStats: ["catalystBonus"],
    description: "Shots at infected enemies (negative biological counters) deal extra biological damage.",
    triggers: {
      unitShot(ctx) {
        if (Fx.shotEnemy(ctx) && Units.counters(ctx.target, "biological") < 0) {
          Units.dealDamage(ctx.state, ctx.target, ctx.value("catalystBonus"), ctx.self, "biological");
        }
      },
    },
  }),
  new Attachment({
    id: "insulated_plating",
    name: "Insulated Plating",
    stats: { health: 1 },
    rarityStats: ["health"],
    description: "Extra health, and this unit can't be shorted: negative electrical counters are removed as they land.",
    triggers: {
      countersChanged(ctx) {
        if (ctx.isSelf(ctx.unit) && ctx.element === "electrical" && ctx.amount < 0) {
          Units.addCounters(ctx.state, ctx.self, "electrical", -ctx.amount);
        }
      },
    },
  }),
  new Attachment({
    id: "coolant_loop",
    name: "Coolant Loop",
    stats: { coolPerTurn: 1 },
    rarityStats: ["coolPerTurn"],
    description: "At the start of your turn, puts out some of this unit's burning (removes negative thermal counters).",
    triggers: {
      turnStart(ctx) {
        if (!ctx.ownersTurn) return;
        const burning = -Math.min(0, Units.counters(ctx.self, "thermal"));
        if (burning > 0) Units.addCounters(ctx.state, ctx.self, "thermal", Math.min(burning, ctx.value("coolPerTurn")));
      },
    },
  }),

  // ================= Support attachments (Builders / Medics only) =================
  new SupportAttachment({
    id: "power_drill",
    name: "Power Drill",
    unitTypes: ["builder"],
    stats: { movement: 1 },
    rarityStats: ["movement"],
    description: "Gets the Builder where it needs to be faster.",
  }),
  new SupportAttachment({
    id: "salvage_kit",
    name: "Salvage Kit",
    unitTypes: ["builder"],
    stats: { salvageCash: 1 },
    rarityStats: ["salvageCash"],
    description: "Whenever one of your units dies, you gain money from the wreckage.",
    triggers: {
      unitDied(ctx) {
        if (ctx.mine(ctx.unit) && !ctx.isSelf(ctx.unit)) ctx.state.players[ctx.owner].money += ctx.value("salvageCash");
      },
    },
  }),
  new SupportAttachment({
    id: "antitoxin_kit",
    name: "Antitoxin Kit",
    unitTypes: ["medic"],
    stats: {},
    description: "When this Medic heals, your units next to it are also cured of infection (negative biological counters).",
    triggers: {
      unitHealed(ctx) {
        if (!ctx.isSelf(ctx.healer) || !Fx.deployed(ctx)) return;
        for (const friend of Fx.adjacentFriends(ctx, ctx.selfSpace)) {
          const infection = Units.counters(friend, "biological");
          if (infection < 0) Units.addCounters(ctx.state, friend, "biological", -infection);
        }
      },
    },
  }),
  new SupportAttachment({
    id: "combat_stims",
    name: "Combat Stims",
    unitTypes: ["medic"],
    stats: { melee: 1, health: 1 },
    rarityStats: ["melee"],
    description: "Lets the Medic defend itself.",
  }),
]);
