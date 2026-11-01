# Board Game Prototype

A same-screen prototype of a dystopian sci-fi board game. Plain HTML, CSS and JavaScript, with no build step.

**To play:** open `index.html` in a browser.

## Project structure

```
index.html          page layout
css/style.css       look and feel
js/config.js        tweakable numbers: board size, players, weapon slots, synergy elements
js/data/            the catalogues (currently empty, with templates)
  weapons.js          weapon parts, bases included
  units.js            units that go on octagons
  buildings.js        buildings that go on squares
js/random.js        seeded randomness (undo-safe)
js/rarity.js        part rarity rolls
js/synergy.js       the Thermal -> Electrical -> Biological circle
js/board.js         board shape: spaces, which ones touch, distances
js/units.js         unit stats, health and per-turn tracking
js/market.js        each player's market: offers, rerolls and locks
js/territory.js     octagon control, building capture, where you can deploy and build
js/parts.js         weapon part classes (see below)
js/armory.js        working with a whole weapon (each unit has one)
js/rules.js         game state + every action the game allows
js/ui.js            draws everything and reports clicks
js/main.js          connects rules and UI, plus undo history
```

Rules files (`synergy.js`, `board.js`, `units.js`, `territory.js`, `market.js`, `parts.js`, `armory.js`, `rules.js`) never touch the screen.
The UI files never change the game state directly. Every change goes through `Rules.applyAction`.

## Turn structure

Each turn goes **Beginning → Main → Unit control → End**.
Beginning and End are automatic: they run any triggers ("at the beginning of your turn...")
and then skip straight on. A unit or building gets a trigger by adding
`triggers: { beginning(state, space) {...} }` to its entry in `js/data/`.

At the **Beginning** of your turn you gain $1 plus $1 for every unit in your reserve (not deployed).

During **Main**:
- your **market** offers 5 random weapon parts and 2 random bases (`CONFIG.market`). Rarity is rolled
  the moment a part appears there. Click one of your units (on the board, or in your reserve via the
  Army button), click an offer, and buy it onto that unit's weapon, or buy it into your **storage**.
  Putting a part where one already is **replaces** it, and the old part goes to storage. Stored parts
  can be fitted onto any of your units later. A part's price is its `cost` plus $1 per rarity step
  (Common +0 … Legendary +4). Unbought offers reroll at your next main phase unless you **lock** them;
- you can **buy units** (civilian or military) into your reserve, and **deploy** reserve units onto
  empty octagons next to your deployable buildings; civilians can **build**. Prices go in `CONFIG.unitCosts`; they're `null` ("price TBD", free) until decided.
  Starting units go in `CONFIG.startingUnits`.

During **Unit control** each of your units can do these in any order (e.g. move, shoot, move again):
- **move** up to its `movement` value, one step at a time, only into octagons sharing a side (no diagonals),
  never onto or through other units;
- **shoot** enemy units within its `range` (counted without diagonals, so a diagonal neighbour is 2 away),
  up to `shots` times per turn, each dealing its `damage`. Only octagons can be targeted.

Every unit carries **its own weapon** (base, barrel, mag, 2 attachments), shown in the weapon menu when
you select the unit. A unit's stats (`health`, `movement`, `range`, `damage`, `shots`) come from its type in
`js/data/units.js`, plus or minus the same-named stats of the parts on its weapon. The game stores damage taken, not current
health, so current health = max health − damage taken: when max health changes, current health changes by the
same amount, and a unit at 0 health is removed. Click a unit to see where it can go (green) and what it
can hit (red), then click the space to do it.

## Territory and buildings

The game is for 2 players. Player 1 starts at the bottom, Player 2 at the top, each with an **HQ**
(`CONFIG.startingBuildings`), and controls the 4 octagons around it.
**Capturing the enemy HQ ends the game and wins it.**

- **Control:** when your **military** unit steps onto an octagon it becomes yours (tinted your colour) and
  stays yours until an enemy military unit steps on it. Civilian units never take control.
- **Deploying:** units can only be deployed onto empty octagons touching one of your buildings that is
  `deployable` (like the HQ). Other buildings, like a future hospital, don't allow deploying.
- **Building:** only **civilian** units can build, on an empty square touching them, and each civilian
  can build one building per turn (`CONFIG.buildsPerCivilianPerTurn`). Buildings cost money (`cost`).
  The HQ can't be built.
- **Capturing:** a building switches to the enemy when they control 3 of the 4 octagons around it
  (`CONFIG.captureThreshold`). Buildings are coloured by owner.

## Weapon part classes

```
WeaponPart                 any part: id, name, synergy, stats
├── WeaponBase             the weapon's class (pistol, ar...). No rarity.
└── CustomPart             random rarity, optional legendary version, optional class restriction
    ├── Barrel             one per weapon
    ├── Mag                one per weapon
    └── Attachment         2 per weapon, each a different type
```

Each class holds its own rules (`places`, `canInstallOn`, `installOn`, `createInstance`, `statsFor`).
A part goes into a place (`base`, `barrel`, `mag`, or attachment slot `0`/`1`); a filled place is replaced.
A new kind of part is a new subclass. Parts in play are stored as plain `{ partId, rarity }`
data so the game state can be copied for undo.

## Part rarity

Every weapon part except the base gets a random rarity when it appears in the market:
Common ×1, Uncommon ×2, Rare ×3, Epic ×5, Legendary ×8. The multiplier only applies to the stats a part
lists in `rarityStats`, which are shown bold in the rarity colour; every other stat stays as written.
A part can also have a separate `legendary` version that replaces it when it rolls legendary,
instead of multiplying by 8. Rarities, colours, multipliers and odds are in `CONFIG.rarities`.

All randomness goes through `js/random.js`, which stores its position in the game state,
so undoing and redoing a roll gives the same result.

## Calculation rule

Nothing derived is stored or kept up to date in advance (synergy, stat totals, bonuses...).
Values are worked out at the moment an effect triggers or something asks for them,
from the parts and pieces as they are right then.

## Layout rule

The whole game must fit on one screen with no page scrolling, on laptops and tablets
in landscape or portrait. The board shrinks to fit the space that's left.

## How to add things

- **A weapon base or part:** add `new WeaponBase({...})`, `new Barrel({...})`, `new Mag({...})` or
  `new Attachment({...})` to the list in `js/data/weapons.js`. Typos in classes or types show an error.
- **A unit or building:** add an entry to `js/data/units.js` or `js/data/buildings.js`.
- **A new kind of move:** add an entry to `ACTIONS` in `js/rules.js` with `list`, `check` and `apply`.
  The side panel will offer it automatically wherever it's legal.

Anything not decided yet is marked `PLACEHOLDER RULE`. Search for it to find what needs filling in.
