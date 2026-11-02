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
// The Reserve & storage window opens over everything from its own button.
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

  render(state, selection, canUndo, focusUnitId, storageOpen) {
    const focus = focusUnitId ? Units.find(state, focusUnitId) : null;
    UI.renderTopBar(state, canUndo);
    UI.renderBoard(state, selection);
    UI.renderMarket(state, selection);
    UI.renderWeapon(state, focus);
    UI.renderPanel(state, selection, focus);
    UI.renderStorage(state, focus, storageOpen);
  },

  renderTopBar(state, canUndo) {
    const player = state.players[state.currentPlayer];
    const turn = document.getElementById("turn");
    turn.textContent =
      state.winner !== null
        ? `${state.players[state.winner].name} wins!`
        : `Round ${state.round} · ${player.name}'s turn`;
    turn.style.color = player.color;

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
      if (a.type === "SHOOT") clickActions[a.target] = a;
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
      if (clickAction) g.classList.add(clickAction.type === "SHOOT" ? "shoot-target" : "move-target");
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

      const { x, y } = UI.center(space);
      if (space.unit) {
        const color = state.players[space.unit.owner].color;
        g.appendChild(UI.svgText(x, y - 6, Units.def(space.unit).name.slice(0, 2).toUpperCase(), "occupant octagon", color));
        const hp = `${Units.health(state, space.unit)}/${Units.maxHealth(state, space.unit)}`;
        g.appendChild(UI.svgText(x, y + 14, hp, "health"));
      } else if (space.building) {
        const def = BUILDING_TYPES[space.building.typeId];
        g.appendChild(UI.svgText(x, y, def.name.slice(0, 2).toUpperCase(), "occupant square"));
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
    const name = WEAPON_PARTS[instance.partId].nameFor(instance);
    const rarity = instance.rarity && Rarity.get(instance.rarity);
    return rarity
      ? `<b style="color:${rarity.color}" title="${rarity.name} ×${rarity.multiplier}">${name}</b>`
      : `<b>${name}</b>`;
  },

  // A part copy's stats. Numbers changed by rarity are bold in the rarity colour.
  partStatsHtml(instance) {
    const part = WEAPON_PARTS[instance.partId];
    const scaled = part.scaledStatsFor(instance);
    const color = instance.rarity && Rarity.get(instance.rarity).color;
    const stats = Object.entries(part.statsFor(instance)).map(([key, value]) => {
      const shown = typeof value === "number" && value > 0 ? `+${value}` : value;
      return scaled.includes(key)
        ? `${key} <b class="scaled" style="color:${color}">${shown}</b>`
        : `${key} ${shown}`;
    });
    return stats.length ? stats.join(" · ") : `<span class="muted">no stats yet</span>`;
  },

  partKind(part) {
    if (part instanceof WeaponBase) return `Base · ${part.weaponClass}`;
    if (part instanceof Attachment) return `Attachment · ${part.attachmentType}`;
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
        const cost = Rules.unitCost(def.id);
        return `<button class="chip ${selected ? "selected" : ""}" data-unittype="${def.id}">
                  <b>${def.name}</b> <span class="muted">${cost === null ? "TBD" : `$${cost}`}</span></button>`;
      })
      .join("");
    root.innerHTML = `
      <h2>Shop</h2>
      ${pile("bases", "Bases")}
      ${pile("parts", "Parts")}
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
    // Places that can be unequipped right now get a ✕ button.
    const unequip = {};
    for (const a of Rules.getActionsOfType(state, "UNEQUIP_PART")) {
      if (a.unitId === unit.id) unequip[a.place] = a;
    }
    const places = ["base", "barrel", "mag", ...unit.weapon.attachments.map((_, i) => i)];
    const rows = UI.weaponRows(unit.weapon)
      .map(([label, instance], i) => `
        <li><span class="muted">${label}</span>
          <span>${instance ? `${UI.partHtml(instance)} <small class="muted">${UI.partStatsHtml(instance)}</small>` : `<b class="empty">empty</b>`}</span>
          ${unequip[places[i]] ? `<button class="unequip" data-place="${places[i]}" title="Unequip to storage">✕</button>` : "<span></span>"}
        </li>`)
      .join("");
    root.innerHTML = `
      <h2 style="color:${owner.color}">${Units.def(unit).name} ${where} · ${base ? `${base.name} <small class="muted">${base.weaponClass}</small>` : "Weapon"}</h2>
      <ul class="weapon-rows">${rows}</ul>`;
    root.querySelectorAll("[data-place]").forEach((el) => {
      const place = /^\d+$/.test(el.dataset.place) ? Number(el.dataset.place) : el.dataset.place;
      el.onclick = () => UI.handlers.onAction(unequip[place]);
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
         · <span class="muted">Damage</span> ${Units.damage(state, u)}
         · <span class="muted">Range</span> ${Units.range(state, u)}</p>
      <p><span class="muted">Moves left</span> ${Units.movesLeft(state, u)}/${Units.movement(state, u)}
         · <span class="muted">Shots left</span> ${Units.shotsLeft(state, u)}/${Units.shots(state, u)}</p>`;
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
      body.innerHTML = `
        <p><b>${def.name}</b> <span class="muted">(${state.players[b.owner].name})</span>
           ${def.deployable ? `<span class="muted">· units deploy around it</span>` : ""}</p>
        <p><span class="muted">Enemy controls</span> ${enemyBest} of 4 octagons around it
           <span class="muted">(${CONFIG.captureThreshold} captures it)</span></p>
        ${def.description ? `<p class="muted">${def.description}</p>` : ""}`;
    } else {
      body.innerHTML = `<p class="muted">Empty ${space.kind === "octagon" ? "octagon (units go here)" : "square (buildings go here)"}.</p>`;
    }
    if (space.kind === "octagon") {
      body.innerHTML += `<p><span class="muted">Controlled by</span> ${space.controller === null ? "nobody" : state.players[space.controller].name}</p>`;
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
    const cost = Market.price(slot.item);
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

  // ---------- Reserve & storage window ----------

  renderStorage(state, focus, open) {
    const player = state.players[state.currentPlayer];
    const button = document.getElementById("open-storage");
    button.innerHTML = `Reserve &amp; storage <span>${player.reserve.length} unit${player.reserve.length === 1 ? "" : "s"} · ${player.storage.length} part${player.storage.length === 1 ? "" : "s"}</span>`;
    button.onclick = () => UI.handlers.onStorage(true);

    const overlay = document.getElementById("overlay");
    overlay.hidden = !open;
    if (!open) return;

    const mine = focus && focus.unit.owner === state.currentPlayer;
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

    overlay.innerHTML = `
      <div class="modal" role="dialog" aria-label="Reserve and storage">
        <div class="modal-head">
          <h2>${player.name} · Reserve &amp; storage</h2>
          <button id="close-storage" title="Close (Esc)">✕ Close</button>
        </div>
        <p class="muted">${mine
          ? `Fitting parts onto <b>${Units.label(state, focus.unit.id)}</b>. Click another unit to change it.`
          : "Click one of your units (deployed or in reserve) to fit stored parts onto it."}
          ${state.phase === "main" ? "" : " Storage can only be used during the Main phase."}</p>
        <div class="modal-cols">
          <section>
            <h3>Deployed</h3>${deployed || `<p class="muted">No units on the board.</p>`}
            <h3>Reserve</h3>${reserve || `<p class="muted">No units in reserve.</p>`}
          </section>
          <section><h3>Storage</h3>${storage || `<p class="muted">No parts in storage.</p>`}</section>
        </div>
      </div>`;

    document.getElementById("close-storage").onclick = () => UI.handlers.onStorage(false);
    overlay.onclick = (e) => {
      if (e.target === overlay) UI.handlers.onStorage(false);
    };
    // Picking a unit here also shows it in the info panel.
    overlay.querySelectorAll("[data-unit]").forEach((el) => {
      el.onclick = () => {
        const unitId = Number(el.dataset.unit);
        const found = Units.find(state, unitId);
        UI.handlers.onSelect(found.space ? { kind: "space", id: found.space.id } : { kind: "reserveUnit", unitId });
      };
    });
    overlay.querySelectorAll("[data-action]").forEach((el) => {
      const index = Number(el.dataset.stored);
      const actions = Rules.getActionsForStored(state, index, mine ? focus.unit.id : null);
      el.onclick = () => UI.handlers.onAction(actions[Number(el.dataset.action)]);
    });
  },
};
