// =============================================================
// ui.js — draws the game and reports clicks. It never changes the
// game state itself; it asks Rules what's legal and tells main.js
// what the player clicked.
//
// "Selection" is what the player is looking at in the side panel:
//   { kind: "space",  id: "O-2-3" }
//   { kind: "weapon", player: 0, weaponIndex: 1 }
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
    UI.renderSynergyCircle();
  },

  render(state, selection, canUndo) {
    UI.renderTopBar(state, canUndo);
    UI.renderBoard(state, selection);
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

  renderBoard(state, selection) {
    const svg = document.getElementById("board");
    const { octagonRows: rows, octagonCols: cols } = CONFIG.board;
    svg.setAttribute("viewBox", `0 0 ${cols * OCT + PAD * 2} ${rows * OCT + PAD * 2}`);
    svg.replaceChildren();

    const selectedSpace = selection && selection.kind === "space" ? state.spaces[selection.id] : null;
    const neighborIds = selectedSpace ? Board.neighbors(state.spaces, selectedSpace) : [];
    const actionSpaceIds = new Set(Rules.getLegalActions(state).map((a) => a.spaceId).filter(Boolean));

    // Octagons first, then squares on top so their edges stay crisp,
    // then the selected space last so its outline isn't covered.
    const layer = (s) => (selectedSpace && s.id === selectedSpace.id ? 2 : s.kind === "octagon" ? 0 : 1);
    const spaces = Object.values(state.spaces).sort((a, b) => layer(a) - layer(b));

    for (const space of spaces) {
      const g = document.createElementNS(SVG_NS, "g");
      g.classList.add("space", space.kind);
      if (selectedSpace && space.id === selectedSpace.id) g.classList.add("selected");
      if (neighborIds.includes(space.id)) g.classList.add("neighbor");
      if (actionSpaceIds.has(space.id)) g.classList.add("actionable");
      g.dataset.id = space.id;

      const shape = document.createElementNS(SVG_NS, "polygon");
      shape.setAttribute("points", UI.shapePoints(space));
      g.appendChild(shape);

      const occupant = space.unit || space.building;
      if (occupant) {
        const def = space.unit ? UNIT_TYPES[occupant.typeId] : BUILDING_TYPES[occupant.typeId];
        const { x, y } = UI.center(space);
        const label = document.createElementNS(SVG_NS, "text");
        label.setAttribute("x", x);
        label.setAttribute("y", y);
        label.setAttribute("fill", state.players[occupant.owner].color);
        label.classList.add("occupant", space.kind);
        label.textContent = def ? def.name.slice(0, 2).toUpperCase() : "?";
        g.appendChild(label);
      }

      g.addEventListener("click", () => UI.handlers.onSelect({ kind: "space", id: space.id }));
      svg.appendChild(g);
    }
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

  // A part's name, coloured by its rarity.
  partHtml(instance) {
    const rarity = Rarity.get(instance.rarity);
    return `<b style="color:${rarity.color}" title="${rarity.name} ×${rarity.multiplier}">${WEAPON_PARTS[instance.partId].name}</b>`;
  },

  slotRowsHtml(weapon) {
    const empty = `<b class="empty">empty</b>`;
    const base = Armory.base(weapon);
    return [
      `<li><span>Base</span>${base ? `<b>${base.name}</b>` : empty}</li>`,
      ...UI.partSlots(weapon).map(([slot, instance]) => `<li><span>${slot}</span>${instance ? UI.partHtml(instance) : empty}</li>`),
    ].join("");
  },

  synergyPips(counts) {
    return CONFIG.synergyElements
      .map((e) => `<span class="pip" style="--c:${e.color}" title="${e.name}">${counts[e.id]}</span>`)
      .join("");
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
                <div class="pips">${UI.synergyPips(Armory.synergy(weapon))}</div>
              </div>`;
          })
          .join("");
        return `
          <section class="player-board ${p === state.currentPlayer ? "active" : ""}" style="--player:${player.color}">
            <h3>${player.name} <span class="money">$${player.money}</span></h3>
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
      body.innerHTML = "<p>Click a space on the board or a weapon on a player board.</p>";
    } else if (selection.kind === "space") {
      const space = state.spaces[selection.id];
      const occupant = space.unit || space.building;
      const holds = space.kind === "octagon" ? "Unit" : "Building";
      title.textContent = `${space.kind === "octagon" ? "Octagon" : "Square"} ${space.row + 1}-${space.col + 1}`;
      body.innerHTML = `<p><span class="muted">${holds}:</span> ${occupant ? UI.occupantText(state, space) : "none"}</p>`;
      actions = Rules.getActionsForSpace(state, space.id);
    } else {
      const owner = state.players[selection.player];
      const weapon = owner.weapons[selection.weaponIndex];
      title.textContent = `${owner.name} · Weapon ${selection.weaponIndex + 1}`;
      body.innerHTML = Armory.isEmpty(weapon)
        ? "<p>Empty weapon slot. Choose a base to start building.</p>"
        : `<p><span class="muted">Class:</span> ${Armory.base(weapon).weaponClass}</p>` +
          UI.partSlots(weapon)
            .filter(([, instance]) => instance)
            .map(([slot, instance]) => {
              const rarity = Rarity.get(instance.rarity);
              return `<p><span class="muted">${slot}:</span> ${UI.partHtml(instance)} <span style="color:${rarity.color}">${rarity.name} ×${rarity.multiplier}</span></p>`;
            })
            .join("");
      // You can only modify your own weapons on your own turn.
      if (selection.player === state.currentPlayer) actions = Rules.getActionsForWeapon(state, selection.weaponIndex);
      else body.innerHTML += `<p class="muted">Not your weapon, so you can only look.</p>`;
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
      list.innerHTML = `<p class="muted">No actions available here yet.</p>`;
    }
  },

  occupantText(state, space) {
    const o = space.unit || space.building;
    const def = space.unit ? UNIT_TYPES[o.typeId] : BUILDING_TYPES[o.typeId];
    return `${def ? def.name : o.typeId} (${state.players[o.owner].name})`;
  },

  // ---------- Synergy circle (static diagram) ----------

  renderSynergyCircle() {
    const svg = document.getElementById("synergy");
    const els = CONFIG.synergyElements;
    const r = 34;
    const pos = els.map((_, i) => {
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / els.length;
      return { x: 80 + Math.cos(angle) * 48, y: 72 + Math.sin(angle) * 48 };
    });
    let html = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" class="arrowhead"/></marker></defs>`;
    els.forEach((_, i) => {
      const a = pos[i];
      const b = pos[(i + 1) % els.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      const trim = r * 0.62;
      html += `<line class="synergy-link" x1="${a.x + (dx / len) * trim}" y1="${a.y + (dy / len) * trim}" x2="${b.x - (dx / len) * trim}" y2="${b.y - (dy / len) * trim}" marker-end="url(#arrow)"/>`;
    });
    els.forEach((e, i) => {
      html += `<circle cx="${pos[i].x}" cy="${pos[i].y}" r="${r * 0.55}" fill="${e.color}"/>`;
      html += `<text x="${pos[i].x}" y="${pos[i].y}" class="synergy-label">${e.name.slice(0, 4)}</text>`;
    });
    svg.innerHTML = html;
  },
};
