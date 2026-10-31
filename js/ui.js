// =============================================================
// ui.js — draws the game and reports clicks. It never changes the
// game state itself; it asks Rules what's legal and tells main.js
// what the player clicked.
//
// "Selection" is what the player is looking at in the side panel:
//   { kind: "space",  id: "O-2-3" }
//   { kind: "weapon", player: 0, weaponIndex: 1 }
//   { kind: "offer",  pile: "parts", slot: 2 }   // a market offer
//   { kind: "shop" }                              // buying units + reserve
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

  render(state, selection, canUndo) {
    UI.renderTopBar(state, canUndo);
    UI.renderBoard(state, selection);
    UI.renderMarket(state, selection);
    UI.renderPlayerBoards(state, selection);
    UI.renderPanel(state, selection);
  },

  renderTopBar(state, canUndo) {
    const player = state.players[state.currentPlayer];
    const turn = document.getElementById("turn");
    turn.textContent =
      state.winner !== null
        ? `${state.players[state.winner].name} wins!`
        : `Round ${state.round} · ${player.name}'s turn`;
    turn.style.color = player.color;

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
    const pile = (id, label) => {
      const offers = (state.market && state.market[id]) || [];
      const chips = offers.length
        ? offers
            .map((instance, slot) => {
              const selected = selection && selection.kind === "offer" && selection.pile === id && selection.slot === slot;
              return instance
                ? `<button class="chip ${selected ? "selected" : ""}" data-pile="${id}" data-slot="${slot}">${UI.partHtml(instance)}</button>`
                : `<span class="chip taken">taken</span>`;
            })
            .join("")
        : `<span class="muted">none in the catalogue yet</span>`;
      return `<div class="market-row"><span class="muted">${label}</span><div class="chips">${chips}</div></div>`;
    };
    const reserve = state.players[state.currentPlayer].reserve.length;
    const shopSelected = selection && selection.kind === "shop";
    root.innerHTML = `
      ${pile("bases", "Bases")}
      ${pile("parts", "Parts")}
      <div class="market-row"><span class="muted">Units</span>
        <div class="chips"><button class="chip ${shopSelected ? "selected" : ""}" id="shop">Buy units · ${reserve} in reserve</button></div>
      </div>`;

    root.querySelectorAll("[data-pile]").forEach((el) => {
      el.onclick = () => UI.handlers.onSelect({ kind: "offer", pile: el.dataset.pile, slot: Number(el.dataset.slot) });
    });
    document.getElementById("shop").onclick = () => UI.handlers.onSelect({ kind: "shop" });
  },

  // ---------- Player weapon boards ----------

  // [slot label, part instance or null] for each part slot (not the base).
  partSlots(weapon) {
    return [
      ["Barrel", weapon.barrel],
      ["Mag", weapon.mag],
      ...weapon.attachments.map((instance, i) => [`Attach ${i + 1}`, instance]),
    ];
  },

  slotRowsHtml(weapon) {
    const empty = `<b class="empty">empty</b>`;
    return [
      `<li><span>Base</span>${weapon.base ? UI.partHtml(weapon.base) : empty}</li>`,
      ...UI.partSlots(weapon).map(([slot, instance]) => `<li><span>${slot}</span>${instance ? UI.partHtml(instance) : empty}</li>`),
    ].join("");
  },

  renderPlayerBoards(state, selection) {
    const root = document.getElementById("player-boards");
    root.innerHTML = state.players
      .map((player, p) => {
        const weapons = player.weapons
          .map((weapon, w) => {
            const base = Armory.base(weapon);
            const isSelected = selection && selection.kind === "weapon" && selection.player === p && selection.weaponIndex === w;
            return `
              <div class="weapon ${isSelected ? "selected" : ""}" data-player="${p}" data-weapon="${w}">
                <h4>${base ? `${base.name} <small>${base.weaponClass}</small>` : `Weapon ${w + 1}`}</h4>
                <ul>${UI.slotRowsHtml(weapon)}</ul>
              </div>`;
          })
          .join("");
        return `
          <section class="player-board ${p === state.currentPlayer ? "active" : ""}" style="--player:${player.color}">
            <h3>${player.name}
              <span><span class="money">$${player.money}</span> <span class="muted">· ${player.reserve.length} in reserve</span></span>
            </h3>
            <div class="weapons">${weapons}</div>
          </section>`;
      })
      .join("");

    root.querySelectorAll(".weapon").forEach((el) => {
      el.addEventListener("click", () =>
        UI.handlers.onSelect({ kind: "weapon", player: Number(el.dataset.player), weaponIndex: Number(el.dataset.weapon) })
      );
    });
  },

  // ---------- Side panel: details + available actions ----------

  renderPanel(state, selection) {
    const title = document.getElementById("panel-title");
    const body = document.getElementById("panel-body");
    const list = document.getElementById("panel-actions");
    let actions = [];

    if (!selection) {
      title.textContent = "Nothing selected";
      body.innerHTML = "<p>Click a space, a market offer or a weapon.</p>";
    } else if (selection.kind === "space") {
      actions = UI.spacePanel(state, state.spaces[selection.id], title, body);
    } else if (selection.kind === "weapon") {
      actions = UI.weaponPanel(state, selection, title, body);
    } else if (selection.kind === "offer") {
      actions = UI.offerPanel(state, selection, title, body);
    } else {
      actions = UI.shopPanel(state, title, body);
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

  spacePanel(state, space, title, body) {
    title.textContent = `${space.kind === "octagon" ? "Octagon" : "Square"} ${space.row + 1}-${space.col + 1}`;
    if (space.unit) {
      const u = space.unit;
      const def = Units.def(u);
      body.innerHTML = `
        <p><b>${def.name}</b> <span class="muted">(${def.category}, ${state.players[u.owner].name})</span></p>
        <p><span class="muted">Health</span> ${Units.health(state, u)}/${Units.maxHealth(state, u)}
           · <span class="muted">Damage</span> ${Units.damage(state, u)}
           · <span class="muted">Range</span> ${Units.range(state, u)}</p>
        <p><span class="muted">Moves left</span> ${Units.movesLeft(state, u)}/${Units.movement(state, u)}
           · <span class="muted">Shots left</span> ${Units.shotsLeft(state, u)}/${Units.shots(state, u)}</p>`;
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

  weaponPanel(state, selection, title, body) {
    const owner = state.players[selection.player];
    const weapon = owner.weapons[selection.weaponIndex];
    title.textContent = `${owner.name} · Weapon ${selection.weaponIndex + 1}`;
    body.innerHTML = Armory.isEmpty(weapon)
      ? "<p>Empty weapon slot. Take a base from the market to start building.</p>"
      : Armory.installed(weapon)
          .map((instance) => `<p>${UI.partHtml(instance)} <span class="muted">${UI.partStatsHtml(instance)}</span></p>`)
          .join("");
    // You can only modify your own weapons on your own turn.
    if (selection.player !== state.currentPlayer) {
      body.innerHTML += `<p class="muted">Not your weapon, so you can only look.</p>`;
      return [];
    }
    return Rules.getActionsForWeapon(state, selection.weaponIndex);
  },

  offerPanel(state, selection, title, body) {
    const instance = Market.offer(state, selection.pile, selection.slot);
    title.textContent = "Market";
    if (!instance) {
      body.innerHTML = `<p class="muted">This offer has been taken.</p>`;
      return [];
    }
    const part = WEAPON_PARTS[instance.partId];
    const rarity = instance.rarity && Rarity.get(instance.rarity);
    const description = part.versionFor(instance).description;
    body.innerHTML = `
      <p>${UI.partHtml(instance)} <span class="muted">${UI.partKind(part)}</span>
         ${rarity ? `<span style="color:${rarity.color}">${rarity.name}</span>` : ""}</p>
      <p>${UI.partStatsHtml(instance)}</p>
      ${description ? `<p class="muted">${description}</p>` : ""}`;
    return Rules.getActionsForOffer(state, selection.pile, selection.slot);
  },

  shopPanel(state, title, body) {
    const player = state.players[state.currentPlayer];
    title.textContent = `${player.name} · Units`;
    const counts = {};
    for (const u of player.reserve) counts[u.typeId] = (counts[u.typeId] || 0) + 1;
    const reserve = Object.entries(counts).map(([typeId, n]) => `${UNIT_TYPES[typeId].name} ×${n}`).join(", ");
    body.innerHTML = `
      <p><span class="muted">Reserve:</span> ${reserve || "empty"}</p>
      <p class="muted">Income next turn: $${Rules.income(state)}. To deploy, click an empty octagon.</p>
      ${Object.keys(UNIT_TYPES).length ? "" : `<p class="muted">No units in the catalogue yet.</p>`}`;
    return Rules.getActionsOfType(state, "BUY_UNIT");
  },
};
