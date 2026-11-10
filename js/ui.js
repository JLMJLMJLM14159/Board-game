// =============================================================
// ui.js — draws the game and reports clicks. It never changes the
// game state itself; it asks Rules what's legal and tells main.js
// what the player clicked.
//
// "Selection" is what the player is looking at in the side panel:
//   { kind: "space",  id: "O-2-3" }
//   { kind: "offer",  pile: "parts", slot: 2 }   // a market offer
//   { kind: "unitType", typeId: "trooper" }       // a unit for sale in the shop
//   { kind: "reserveUnit", unitId: 7 }            // a unit in your reserve
//
// "focusUnitId" is the unit whose weapon is shown in the weapon menu: the last
// unit clicked, on the board or in the reserve. Parts are fitted onto its weapon.
//
// The Reserve & storage panel is always visible, above the Shop.
// =============================================================

const SVG_NS = "http://www.w3.org/2000/svg";

// Octagon width. Its side length makes a regular octagon,
// and the corner cut is the half-diagonal of the squares between octagons.
const OCT = 64;
const OCT_SIDE = OCT / (1 + Math.SQRT2);
const CORNER = (OCT - OCT_SIDE) / 2;
const PAD = 8;

const UI = {
  handlers: null,

  init(handlers) {
    UI.handlers = handlers;
    document.getElementById("next-phase").onclick = () => handlers.onAction({ type: "NEXT_PHASE" });
    document.getElementById("undo").onclick = handlers.onUndo;
    document.getElementById("restart").onclick = handlers.onRestart;
  },

  render(state, selection, canUndo, focusUnitId) {
    const focus = focusUnitId ? Units.find(state, focusUnitId) : null;
    UI.renderTopBar(state, canUndo);
    UI.renderBoard(state, selection);
    UI.renderMarket(state, selection);
    UI.renderWeapon(state, focus);
    UI.renderPanel(state, selection, focus);
    UI.renderStorage(state, focus);
  },

  renderTopBar(state, canUndo) {
    const player = state.players[state.currentPlayer];
    const turn = document.getElementById("turn");
    turn.textContent =
      state.winner !== null
        ? `${state.players[state.winner].name} wins!`
        : `Round ${state.round} · ${player.name}'s turn`;
    turn.style.color = player.color;
    document.getElementById("game-length").textContent = `${Rules.length(state).name} game`;

    document.getElementById("players").innerHTML = state.players
      .map((p, i) => `
        <span class="player-chip ${i === state.currentPlayer ? "active" : ""}" style="--player:${p.color}">
          ${p.name} <span class="money">$${p.money}</span> <span class="muted">· ${p.reserve.length} in reserve</span>
        </span>`)
      .join("");

    // Automatic phases (beginning, end) are shown but marked as skipped.
    document.getElementById("phases").innerHTML = PHASES.map(
      (p) => `<li class="${p.id === state.phase ? "current" : ""} ${p.auto ? "auto" : ""}"
                 title="${p.auto ? "Automatic: only runs triggers" : ""}">${p.name}</li>`
    ).join("");

    const next = { type: "NEXT_PHASE" };
    const nextBtn = document.getElementById("next-phase");
    nextBtn.textContent = Rules.describe(next, state);
    nextBtn.disabled = !Rules.check(state, next).ok;
    document.getElementById("undo").disabled = !canUndo;

    const banner = document.getElementById("game-over");
    banner.hidden = state.winner === null;
    if (state.winner !== null) {
      const winner = state.players[state.winner];
      banner.innerHTML = `<div style="--player:${winner.color}"><h2>${winner.name} wins!</h2><p>The enemy HQ has been captured.</p></div>`;
    }
  },

  // ---------- Main board ----------

  center(space) {
    const offset = space.kind === "square" ? OCT : OCT / 2;
    return { x: PAD + space.col * OCT + offset, y: PAD + space.row * OCT + offset };
  },

  shapePoints(space) {
    const { x, y } = UI.center(space);
    const h = OCT / 2;
    const k = OCT_SIDE / 2;
    const pts =
      space.kind === "octagon"
        ? [[-k, -h], [k, -h], [h, -k], [h, k], [k, h], [-k, h], [-h, k], [-h, -k]]
        : [[0, -CORNER], [CORNER, 0], [0, CORNER], [-CORNER, 0]];
    return pts.map(([dx, dy]) => `${x + dx},${y + dy}`).join(" ");
  },

  // Draws an icon from icons.js centred on (x, y), `size` units across, in `color`.
  // Falls back to the first two letters of `fallback` if there's no such icon.
  svgIcon(name, x, y, size, color, fallback, className) {
    const icon = ICONS[name];
    if (!icon) return UI.svgText(x, y, fallback.slice(0, 2).toUpperCase(), className, color);
    const g = document.createElementNS(SVG_NS, "g");
    const scale = size / 24;
    g.setAttribute("transform", `translate(${x - size / 2} ${y - size / 2}) scale(${scale})`);
    g.setAttribute("class", "icon");
    for (const d of icon.paths) {
      const path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", d);
      path.style.fill = icon.fill ? color : "none";
      path.style.stroke = color;
      path.style.strokeWidth = icon.fill ? 0 : 2.2;
      g.appendChild(path);
    }
    return g;
  },

  svgText(x, y, text, className, fill) {
    const el = document.createElementNS(SVG_NS, "text");
    el.setAttribute("x", x);
    el.setAttribute("y", y);
    if (fill) el.setAttribute("fill", fill);
    el.setAttribute("class", className);
    el.textContent = text;
    return el;
  },

  renderBoard(state, selection) {
    const svg = document.getElementById("board");
    const { octagonRows: rows, octagonCols: cols } = CONFIG.board;
    svg.setAttribute("viewBox", `0 0 ${cols * OCT + PAD * 2} ${rows * OCT + PAD * 2}`);
    svg.replaceChildren();

    const selectedSpace = selection && selection.kind === "space" ? state.spaces[selection.id] : null;
    const selectedUnit = selectedSpace && selectedSpace.unit;
    const legal = Rules.getLegalActions(state);
    const actionSpaceIds = new Set(legal.flatMap((a) => [a.spaceId, a.from]).filter(Boolean));

    // Clicking a highlighted space does the selected unit's move or shot there.
    const clickActions = {};
    for (const a of legal) {
      if (!selectedSpace || a.from !== selectedSpace.id) continue;
      if (a.type === "MOVE_UNIT") clickActions[a.to] = a;
      // Clicking your own units should still select them, so friendly shots and
      // melee are only offered as buttons in the info panel.
      const target = a.target && state.spaces[a.target].unit;
      const friendly = target && target.owner === state.currentPlayer;
      if ((a.type === "SHOOT" || a.type === "MELEE") && !friendly && !clickActions[a.target]) clickActions[a.target] = a;
      if (a.type === "HEAL") clickActions[a.target] = a;
    }

    // A selected unit shows its range; anything else shows its neighbours.
    let neighborIds = [];
    let inRange = () => false;
    if (selectedUnit) {
      const range = Units.range(state, selectedUnit);
      inRange = (s) => s.kind === "octagon" && s.id !== selectedSpace.id && Board.distance(selectedSpace, s) <= range;
    } else if (selectedSpace) {
      neighborIds = Board.neighbors(state.spaces, selectedSpace);
    }

    // Octagons first, then squares on top so their edges stay crisp, then
    // click targets and the selected space last so their outlines aren't covered.
    const layer = (s) =>
      selectedSpace && s.id === selectedSpace.id ? 3 : clickActions[s.id] ? 2 : s.kind === "octagon" ? 0 : 1;
    const spaces = Object.values(state.spaces).sort((a, b) => layer(a) - layer(b));

    for (const space of spaces) {
      const g = document.createElementNS(SVG_NS, "g");
      g.classList.add("space", space.kind);
      if (selectedSpace && space.id === selectedSpace.id) g.classList.add("selected");
      if (neighborIds.includes(space.id)) g.classList.add("neighbor");
      if (actionSpaceIds.has(space.id)) g.classList.add("actionable");
      if (inRange(space)) g.classList.add("in-range");
      const clickAction = clickActions[space.id];
      if (clickAction) {
        g.classList.add({ SHOOT: "shoot-target", MELEE: "shoot-target", HEAL: "heal-target", MOVE_UNIT: "move-target" }[clickAction.type]);
      }
      g.dataset.id = space.id;

      const shape = document.createElementNS(SVG_NS, "polygon");
      shape.setAttribute("points", UI.shapePoints(space));
      g.appendChild(shape);

      // Owner colours: a light tint on controlled octagons, a solid square under buildings.
      const owner = space.kind === "octagon" ? space.controller : space.building && space.building.owner;
      if (owner !== null && owner !== undefined) {
        const tint = document.createElementNS(SVG_NS, "polygon");
        tint.setAttribute("points", UI.shapePoints(space));
        tint.style.fill = state.players[owner].color; // inline, so it beats the stylesheet's space colours
        tint.setAttribute("class", space.kind === "octagon" ? "tint" : "tint building");
        g.appendChild(tint);
      }
      // A besieged building gets a dashed outline in the besieger's colour.
      if (space.building && space.building.siegeBy !== null) {
        const ring = document.createElementNS(SVG_NS, "polygon");
        ring.setAttribute("points", UI.shapePoints(space));
        ring.style.stroke = state.players[space.building.siegeBy].color;
        ring.setAttribute("class", "siege");
        g.appendChild(ring);
      }

      const { x, y } = UI.center(space);
      if (space.unit) {
        const color = state.players[space.unit.owner].color;
        const def = Units.def(space.unit);
        g.appendChild(UI.svgIcon(def.icon, x, y - 5, 27, color, def.name, "occupant octagon"));
        const hp = `${Units.health(state, space.unit)}/${Units.maxHealth(state, space.unit)}`;
        g.appendChild(UI.svgText(x, y + 16, hp, "health"));
        // Element counters along the top: e.g. a yellow "+3" is three positive electrical.
        const shown = CONFIG.synergyElements.filter((e) => Units.counters(space.unit, e.id) !== 0);
        shown.forEach((e, i) => {
          const n = Units.counters(space.unit, e.id);
          const cx = x + (i - (shown.length - 1) / 2) * 15;
          g.appendChild(UI.svgText(cx, y - 23, `${n > 0 ? "+" : "−"}${Math.abs(n)}`, "counter", e.color));
        });
      } else if (space.building) {
        const def = BUILDING_TYPES[space.building.typeId];
        g.appendChild(UI.svgIcon(def.icon, x, y, 15, "#0b0f14", def.name, "occupant square"));
      }

      g.addEventListener("click", () =>
        clickAction ? UI.handlers.onAction(clickAction) : UI.handlers.onSelect({ kind: "space", id: space.id })
      );
      svg.appendChild(g);
    }
  },

  // ---------- Parts ----------

  // A part copy's name, coloured by its rarity if it has one.
  partHtml(instance) {
    const version = WEAPON_PARTS[instance.partId].versionFor(instance);
    const rarity = instance.rarity && Rarity.get(instance.rarity);
    const tip = [rarity ? `${rarity.name} ×${rarity.multiplier}` : "", version.description].filter(Boolean).join(" — ").replace(/"/g, "&quot;");
    return rarity
      ? `<b style="color:${rarity.color}" title="${tip}">${version.name}</b>`
      : `<b title="${tip}">${version.name}</b>`;
  },

  // A part copy's stats. Numbers changed by rarity are bold in the rarity colour.
  partStatsHtml(instance) {
    const part = WEAPON_PARTS[instance.partId];
    const scaled = part.scaledStatsFor(instance);
    const color = instance.rarity && Rarity.get(instance.rarity).color;
    const stats = Object.entries(part.statsFor(instance)).map(([key, value]) => {
      // A base sets starting values ("range 2"); other parts add or subtract ("range +1").
      const shown = typeof value === "number" && value > 0 && !(part instanceof WeaponBase) ? `+${value}` : value;
      const label = UI.statLabel(key);
      return scaled.includes(key)
        ? `${label} <b class="scaled" style="color:${color}">${shown}</b>`
        : `${label} ${shown}`;
    });
    return stats.length ? stats.join(" · ") : `<span class="muted">no stats</span>`;
  },

  // "thermalDamage" -> "thermal damage", "onHitThermal" -> "on hit thermal".
  statLabel(key) {
    return key.replace(/([A-Z])/g, " $1").toLowerCase();
  },

  partKind(part) {
    if (part instanceof WeaponBase) return "Base";
    if (part instanceof SupportAttachment) return `Support attachment · ${part.unitTypes.map((t) => UNIT_TYPES[t]?.name ?? t).join(" / ")}`;
    if (part instanceof Attachment) return "Attachment";
    return part.slot.charAt(0).toUpperCase() + part.slot.slice(1);
  },

  // ---------- Market ----------

  renderMarket(state, selection) {
    const root = document.getElementById("market");
    const market = state.players[state.currentPlayer].market;
    const pile = (id, label) => {
      const slots = market[id];
      const anyItems = slots.some((s) => s.item);
      const chips = anyItems
        ? slots
            .map(({ item, locked }, slot) => {
              const selected = selection && selection.kind === "offer" && selection.pile === id && selection.slot === slot;
              return item
                ? `<button class="chip ${selected ? "selected" : ""} ${locked ? "locked" : ""}" data-pile="${id}" data-slot="${slot}"
                     title="${locked ? "Locked: won't reroll" : ""}">${UI.partHtml(item)}</button>`
                : `<span class="chip taken">bought</span>`;
            })
            .join("")
        : `<span class="muted">${Object.keys(WEAPON_PARTS).length ? "empty" : "none in the catalogue yet"}</span>`;
      return `<div class="market-row"><span class="muted">${label}</span><div class="chips">${chips}</div></div>`;
    };
    const unitChips = Object.values(UNIT_TYPES)
      .map((def) => {
        const selected = selection && selection.kind === "unitType" && selection.typeId === def.id;
        const cost = Rules.unitCost(state, def.id);
        return `<button class="chip ${selected ? "selected" : ""}" data-unittype="${def.id}">
                  <b>${def.name}</b> <span class="muted">${cost === null ? "TBD" : `$${cost}`}</span></button>`;
      })
      .join("");
    root.innerHTML = `
      <h2>Shop</h2>
      ${pile("bases", "Bases")}
      ${pile("parts", "Parts")}
      ${pile("attachments", "Attach.")}
      <div class="market-row"><span class="muted">Units</span>
        <div class="chips">${unitChips || `<span class="muted">none in the catalogue yet</span>`}</div>
      </div>`;

    root.querySelectorAll("[data-pile]").forEach((el) => {
      el.onclick = () => UI.handlers.onSelect({ kind: "offer", pile: el.dataset.pile, slot: Number(el.dataset.slot) });
    });
    root.querySelectorAll("[data-unittype]").forEach((el) => {
      el.onclick = () => UI.handlers.onSelect({ kind: "unitType", typeId: el.dataset.unittype });
    });
  },

  // ---------- Weapon menu: the focused unit's weapon ----------

  // [label, part instance or null] for every place on a weapon.
  weaponRows(weapon) {
    return [
      ["Base", weapon.base],
      ["Barrel", weapon.barrel],
      ["Mag", weapon.mag],
      ["Muzzle", weapon.muzzle],
      ["Stock", weapon.stock],
      ...weapon.attachments.map((instance, i) => [`Attach ${i + 1}`, instance]),
    ];
  },

  renderWeapon(state, focus) {
    const root = document.getElementById("weapon");
    if (!focus) {
      root.innerHTML = `<h2>Weapon</h2><p class="muted">Select a unit on the board to see its weapon.</p>`;
      return;
    }
    const unit = focus.unit;
    const owner = state.players[unit.owner];
    const where = focus.space ? `${focus.space.row + 1}-${focus.space.col + 1}` : "(reserve)";
    const base = Armory.base(unit.weapon);
    // Places that can be unequipped / upgraded right now get ✕ / ▲ buttons.
    const unequip = {};
    const upgrade = {};
    for (const a of Rules.getActionsOfType(state, "UNEQUIP_PART")) {
      if (a.unitId === unit.id) unequip[a.place] = a;
    }
    for (const a of Rules.getActionsOfType(state, "UPGRADE_PART")) {
      if (a.unitId === unit.id) upgrade[a.place] = a;
    }
    const support = Units.isCivilian(unit);
    const places = Armory.places(unit.weapon);
    const rows = UI.weaponRows(unit.weapon)
      .map(([label, instance], i) => {
        // Support units only have attachment slots.
        if (support && typeof places[i] !== "number") return "";
        const up = upgrade[places[i]];
        return `
        <li><span class="muted">${label}</span>
          <span>${instance ? `${UI.partHtml(instance)} <small class="muted">${UI.partStatsHtml(instance)}</small>` : `<b class="empty">empty</b>`}</span>
          ${up ? `<button class="upgrade" data-upgrade="${places[i]}" title="${Rules.describe(up, state)}">▲${(Rules.describe(up, state).match(/\$\d+/) || [""])[0]}</button>` : "<span></span>"}
          ${unequip[places[i]] ? `<button class="unequip" data-place="${places[i]}" title="Unequip to storage">✕</button>` : "<span></span>"}
        </li>`;
      })
      .join("");
    root.innerHTML = `
      <h2 style="color:${owner.color}">${Units.def(unit).name} ${where} · ${support ? "Support attachments" : base ? base.name : "Weapon"}</h2>
      <ul class="weapon-rows">${rows}</ul>`;
    const placeOf = (value) => (/^\d+$/.test(value) ? Number(value) : value);
    root.querySelectorAll("[data-place]").forEach((el) => {
      el.onclick = () => UI.handlers.onAction(unequip[placeOf(el.dataset.place)]);
    });
    root.querySelectorAll("[data-upgrade]").forEach((el) => {
      el.onclick = () => UI.handlers.onAction(upgrade[placeOf(el.dataset.upgrade)]);
    });
  },

  // ---------- Side panel: details + available actions ----------

  renderPanel(state, selection, focus) {
    const title = document.getElementById("panel-title");
    const body = document.getElementById("panel-body");
    const list = document.getElementById("panel-actions");
    let actions = [];

    if (!selection) {
      title.textContent = "Nothing selected";
      body.innerHTML = "<p>Click a unit, a space or a market offer.</p>";
    } else if (selection.kind === "space") {
      actions = UI.spacePanel(state, state.spaces[selection.id], title, body);
    } else if (selection.kind === "offer") {
      actions = UI.offerPanel(state, selection, focus, title, body);
    } else if (selection.kind === "reserveUnit") {
      actions = UI.reserveUnitPanel(state, selection, title, body);
    } else {
      actions = UI.unitTypePanel(state, selection, title, body);
    }

    list.replaceChildren(
      ...actions.map((action) => {
        const btn = document.createElement("button");
        btn.textContent = Rules.describe(action, state);
        btn.onclick = () => UI.handlers.onAction(action);
        return btn;
      })
    );
    if (selection && actions.length === 0) {
      list.innerHTML = `<p class="muted">No actions available here right now.</p>`;
    }
  },

  // A unit's name and stats (worked out now, from its type and weapon).
  unitHtml(state, u) {
    const def = Units.def(u);
    return `
      <p><b>${def.name}</b> <span class="muted">(${def.category}, ${state.players[u.owner].name})</span></p>
      <p><span class="muted">Health</span> ${Units.health(state, u)}/${Units.maxHealth(state, u)}
         · <span class="muted">Melee</span> ${Units.melee(state, u)} <span class="muted">(${Units.meleeLeft(state, u)}/${CONFIG.meleePerTurn} left)</span></p>
      <p>${Units.hasWeapon(u)
        ? `<span class="muted">Shot</span> ${UI.damageHtml(state, u)} · <span class="muted">Range</span> ${Units.range(state, u)}
           · <span class="muted">Shots left</span> ${Units.shotsLeft(state, u)}/${Units.shots(state, u)}`
        : `<span class="muted">No weapon base: can't shoot.</span>`}</p>
      <p><span class="muted">Moves left</span> ${Units.movesLeft(state, u)}/${Units.movement(state, u)}</p>
      ${UI.abilitiesHtml(u)}
      ${UI.countersHtml(u)}`;
  },

  // "Counters +3 Electrical · −1 Thermal", in each element's colour.
  countersHtml(u) {
    const parts = CONFIG.synergyElements
      .filter((e) => Units.counters(u, e.id) !== 0)
      .map((e) => {
        const n = Units.counters(u, e.id);
        return `<b style="color:${e.color}">${n > 0 ? "+" : "−"}${Math.abs(n)} ${e.name}</b>`;
      });
    return `<p><span class="muted">Counters</span> ${parts.length ? parts.join(" · ") : `<span class="muted">none</span>`}</p>`;
  },

  // A shot's damage, with typed parts in their element's colour: "5 (2 thermal)".
  damageHtml(state, u) {
    const types = Units.damageTypes(state, u);
    const typed = CONFIG.synergyElements
      .filter((e) => types[e.id] > 0)
      .map((e) => `<b style="color:${e.color}">${types[e.id]} ${e.name.toLowerCase()}</b>`);
    return `${Units.damage(state, u)} damage${typed.length ? ` (${typed.join(", ")})` : ""}`;
  },

  // "Builds left 1/1 · Heals left 0/1 (range 1)" for units with abilities.
  abilitiesHtml(u) {
    const parts = [];
    const build = Units.ability(u, "build");
    const heal = Units.ability(u, "heal");
    if (build) parts.push(`<span class="muted">Builds left</span> ${build.perTurn - u.buildsTaken}/${build.perTurn}`);
    if (heal) parts.push(`<span class="muted">Heals left</span> ${heal.perTurn - u.healsTaken}/${heal.perTurn} <span class="muted">(range ${heal.range})</span>`);
    return parts.length ? `<p>${parts.join(" · ")}</p>` : "";
  },

  reserveUnitPanel(state, selection, title, body) {
    const found = Units.find(state, selection.unitId);
    title.textContent = "Reserve";
    if (!found) {
      body.innerHTML = `<p class="muted">That unit is no longer in your reserve.</p>`;
      return [];
    }
    body.innerHTML = UI.unitHtml(state, found.unit) +
      `<p class="muted">Not deployed yet. To deploy it, click an empty octagon next to one of your deployable buildings.</p>`;
    return [];
  },

  spacePanel(state, space, title, body) {
    title.textContent = `${space.kind === "octagon" ? "Octagon" : "Square"} ${space.row + 1}-${space.col + 1}`;
    if (space.unit) {
      body.innerHTML = UI.unitHtml(state, space.unit);
    } else if (space.building) {
      const b = space.building;
      const def = BUILDING_TYPES[b.typeId];
      const enemy = Territory.controlAround(state, space);
      const enemyBest = Math.max(0, ...Object.entries(enemy).filter(([p]) => Number(p) !== b.owner).map(([, n]) => n));
      const around = Board.neighbors(state.spaces, space).length;
      body.innerHTML = `
        <p><b>${def.name}</b> <span class="muted">(${state.players[b.owner].name})</span>
           ${def.deployable ? `<span class="muted">· units deploy around it</span>` : ""}</p>
        <p><span class="muted">Enemy controls</span> ${enemyBest} of ${around} octagons around it
           <span class="muted">(holding ${Territory.captureNeeded(state, space)} until the start of their next turn captures it)</span></p>
        ${b.siegeBy !== null
          ? `<p style="color:${state.players[b.siegeBy].color}"><b>Under siege by ${state.players[b.siegeBy].name}</b>: captured at the start of their next turn unless the majority is broken.</p>`
          : ""}
        ${def.description ? `<p class="muted">${def.description}</p>` : ""}`;
    } else {
      body.innerHTML = `<p class="muted">Empty ${space.kind === "octagon" ? "octagon (units go here)" : "square (buildings go here)"}.</p>`;
    }
    if (space.kind === "octagon") {
      body.innerHTML += `<p><span class="muted">Controlled by</span> ${space.controller === null ? "nobody" : state.players[space.controller].name}</p>`;
      if (!space.unit && state.phase === "main") {
        const player = state.players[state.currentPlayer];
        body.innerHTML += `<p><span class="muted">Deploys left this turn</span> ${CONFIG.deploysPerTurn - player.deploysThisTurn}/${CONFIG.deploysPerTurn}</p>`;
      }
    }
    return Rules.getActionsForSpace(state, space.id);
  },

  // "Fits onto Trooper 4-5." or a hint to pick one of your units first.
  fitNote(state, focus) {
    return focus && focus.unit.owner === state.currentPlayer
      ? `Fits onto <b>${Units.label(state, focus.unit.id)}</b> (the unit in the weapon menu).`
      : "Click one of your units on the board, or in Reserve & storage, to fit this onto its weapon.";
  },

  partDetailsHtml(instance, extra) {
    const part = WEAPON_PARTS[instance.partId];
    const rarity = instance.rarity && Rarity.get(instance.rarity);
    const description = part.versionFor(instance).description;
    return `
      <p>${UI.partHtml(instance)} <span class="muted">${UI.partKind(part)}</span>
         ${rarity ? `<span style="color:${rarity.color}">${rarity.name}</span>` : ""}${extra || ""}</p>
      <p>${UI.partStatsHtml(instance)}</p>
      ${description ? `<p class="muted">${description}</p>` : ""}`;
  },

  offerPanel(state, selection, focus, title, body) {
    const slot = Market.slot(state, selection.pile, selection.slot);
    title.textContent = "Market";
    if (!slot.item) {
      body.innerHTML = `<p class="muted">This offer has been bought.</p>`;
      return [];
    }
    const cost = Market.price(state, slot.item);
    body.innerHTML =
      UI.partDetailsHtml(slot.item, ` · ${cost === null ? "price TBD" : `$${cost}`}${slot.locked ? ` · <span class="lock-note">locked</span>` : ""}`) +
      `<p class="muted">${UI.fitNote(state, focus)}</p>`;
    const mine = focus && focus.unit.owner === state.currentPlayer;
    return Rules.getActionsForOffer(state, selection.pile, selection.slot, mine ? focus.unit.id : null);
  },

  // A unit for sale in the shop.
  unitTypePanel(state, selection, title, body) {
    const def = UNIT_TYPES[selection.typeId];
    const stats = Object.entries(def.stats || {}).map(([k, v]) => `${k} ${v}`).join(" · ");
    const inReserve = state.players[state.currentPlayer].reserve.filter((u) => u.typeId === def.id).length;
    title.textContent = "Shop";
    body.innerHTML = `
      <p><b>${def.name}</b> <span class="muted">${def.category}</span></p>
      <p>${stats || `<span class="muted">no stats yet</span>`}</p>
      ${def.description ? `<p class="muted">${def.description}</p>` : ""}
      <p class="muted">Bought units go to your reserve (you have ${inReserve}).</p>`;
    return Rules.getActionsOfType(state, "BUY_UNIT").filter((a) => a.unitTypeId === def.id);
  },

  // ---------- New game screen: pick a game length ----------

  renderNewGame(open, canCancel) {
    const root = document.getElementById("new-game");
    root.hidden = !open;
    if (!open) return;
    const unitNames = (ids) => {
      const counts = {};
      for (const id of ids) counts[id] = (counts[id] || 0) + 1;
      return Object.entries(counts).map(([id, n]) => `${n} ${UNIT_TYPES[id].name}${n > 1 ? "s" : ""}`).join(", ");
    };
    const cards = Object.entries(CONFIG.gameLengths)
      .map(([id, L]) => `
        <button class="length-card ${id === CONFIG.defaultGameLength ? "recommended" : ""}" data-length="${id}">
          <h3>${L.name}${id === CONFIG.defaultGameLength ? ` <small>recommended</small>` : ""}</h3>
          <p>${L.description}</p>
          <ul>
            <li><span>Start</span> $${L.startingMoney} · ${unitNames(L.startingUnits)}</li>
            <li><span>Units</span> ${Object.values(UNIT_TYPES).map((u) => `${u.name} $${L.unitCosts[u.id] ?? L.unitCosts[u.category]}`).join(" · ")}</li>
            <li><span>Parts</span> base $${L.partCosts.base} · others $${L.partCosts.barrel} (+$1 per rarity)</li>
            <li><span>Buildings</span> $${L.buildingCosts.default}</li>
          </ul>
        </button>`)
      .join("");
    root.innerHTML = `
      <div class="new-game-box">
        <h2>New game</h2>
        <p class="muted">Choose how long you want the game to be. It sets the starting money, starting units and all prices.</p>
        <div class="length-cards">${cards}</div>
        ${canCancel ? `<button id="cancel-new-game">Cancel, keep playing</button>` : ""}
      </div>`;
    root.querySelectorAll("[data-length]").forEach((el) => (el.onclick = () => UI.handlers.onNewGame(el.dataset.length)));
    if (canCancel) document.getElementById("cancel-new-game").onclick = () => UI.handlers.onNewGame(null);
  },

  // ---------- Reserve & storage panel (always visible) ----------

  renderStorage(state, focus) {
    const root = document.getElementById("storage");
    const player = state.players[state.currentPlayer];
    const mine = focus && focus.unit.owner === state.currentPlayer;

    // Re-rendering replaces the lists, so remember where each one was scrolled to.
    const scroll = [...root.querySelectorAll(".storage-cols > section")].map((el) => el.scrollTop);

    const partsList = (weapon) => {
      const parts = Armory.installed(weapon);
      return parts.length ? parts.map((i) => UI.partHtml(i)).join(", ") : `<span class="muted">no parts</span>`;
    };
    const unitCard = (u, where) => `
        <button class="card ${focus && focus.unit.id === u.id ? "selected" : ""}" data-unit="${u.id}">
          <b>${Units.def(u).name}</b> <span class="muted">${where}${Units.def(u).category}</span>
          <div>${partsList(u.weapon)}</div>
        </button>`;
    const deployed = Object.values(state.spaces)
      .filter((sp) => sp.unit && sp.unit.owner === state.currentPlayer)
      .map((sp) => unitCard(sp.unit, `${sp.row + 1}-${sp.col + 1} · `))
      .join("");
    const reserve = player.reserve.map((u) => unitCard(u, "")).join("");
    const storage = player.storage
      .map((item, index) => {
        const part = WEAPON_PARTS[item.partId];
        const rarity = item.rarity && Rarity.get(item.rarity);
        const actions = Rules.getActionsForStored(state, index, mine ? focus.unit.id : null);
        const buttons = actions
          .map((a, n) => `<button data-stored="${index}" data-action="${n}">${Rules.describe(a, state)}</button>`)
          .join("");
        // Say why it can't be fitted onto the selected unit, e.g. "Add a base first."
        const canFit = actions.some((a) => a.type === "EQUIP_PART");
        const why = mine && !canFit && state.phase === "main"
          ? Rules.checkFit(state, focus.unit.id, item, part.places(focus.unit.weapon)[0]).reason
          : "";
        return `
          <div class="card">
            ${UI.partHtml(item)} <span class="muted">${UI.partKind(part)}</span>
            ${rarity ? `<span style="color:${rarity.color}">${rarity.name}</span>` : ""}
            <div class="muted">${UI.partStatsHtml(item)}</div>
            <div class="card-actions">${buttons}${why ? `<span class="muted">Can't fit: ${why}</span>` : ""}</div>
          </div>`;
      })
      .join("");

    const fitting = mine
      ? `fitting onto <b>${Units.label(state, focus.unit.id)}</b>`
      : "click a unit to fit parts onto it";
    root.innerHTML = `
      <h2>Reserve &amp; storage <span class="muted">· ${fitting}${state.phase === "main" ? "" : " · storage only works in Main"}</span></h2>
      <div class="storage-cols">
        <section>
          <h3>Deployed</h3>${deployed || `<p class="muted">No units on the board.</p>`}
          <h3>Reserve</h3>${reserve || `<p class="muted">No units in reserve.</p>`}
        </section>
        <section><h3>Storage</h3>${storage || `<p class="muted">No parts in storage.</p>`}</section>
      </div>`;

    root.querySelectorAll(".storage-cols > section").forEach((el, i) => (el.scrollTop = scroll[i] || 0));
    // Picking a unit here also shows it in the info panel and weapon menu.
    root.querySelectorAll("[data-unit]").forEach((el) => {
      el.onclick = () => {
        const unitId = Number(el.dataset.unit);
        const found = Units.find(state, unitId);
        UI.handlers.onSelect(found.space ? { kind: "space", id: found.space.id } : { kind: "reserveUnit", unitId });
      };
    });
    root.querySelectorAll("[data-action]").forEach((el) => {
      const index = Number(el.dataset.stored);
      const actions = Rules.getActionsForStored(state, index, mine ? focus.unit.id : null);
      el.onclick = () => UI.handlers.onAction(actions[Number(el.dataset.action)]);
    });
  },
};
