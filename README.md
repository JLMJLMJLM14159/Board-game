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
js/icons.js         simple board icons for units and buildings
js/main.js          connects rules and UI, plus undo history
```

Rules files (`synergy.js`, `board.js`, `units.js`, `territory.js`, `market.js`, `parts.js`, `armory.js`, `rules.js`) never touch the screen.
The UI files never change the game state directly. Every change goes through `Rules.applyAction`.

## Game length

Every new game starts with a choice of length (also from the **New game** button). Each length sets the
starting money, the units each player starts with in reserve, and all prices (`CONFIG.gameLengths`):

| | Quick | Standard | Long |
|---|---|---|---|
| Starting money | $10 | $5 | $3 |
| Starting reserve | 3 Troops, Builder, Medic | 2 Troops, Builder | Troop, Builder |
| Troop / Builder / Medic | $2 / $2 / $3 | $4 / $3 / $4 | $6 / $4 / $6 |
| Weapon base | $2 | $3 | $4 |
| Barrel / mag / attachment | $1 | $2 | $3 |
| Buildings | $2 | $4 | $6 |

Rarity adds $1 per step on top of a part's price. A unit, part or building can set its own `cost` in
`js/data/` (a number, or `{ quick, standard, long }`) to override the length's price.

## Turn structure

Each turn goes **Beginning → Main → Unit control → End**.
Beginning and End are automatic: they run any triggers ("at the beginning/end of each turn...")
and then skip straight on. Triggers fire on **both** players' turns. A unit or building gets a trigger by adding
`triggers: { beginning(state, space) {...} }` to its entry in `js/data/`.

At the **Beginning** of your turn you gain $1 plus $1 for every unit in your reserve (not deployed).

During **Main**:
- the **Shop** holds everything you can buy: your market of 5 random weapon parts and 2 random bases
  (`CONFIG.market`), and units. Rarity is rolled the moment a part appears in the market. Click one of
  your units (on the board, or in the **Reserve & storage** panel just above the Shop), click an offer,
  and buy it onto that unit's weapon, or buy it into your **storage**. The Reserve & storage panel is always
  visible: its unit list (deployed and reserve) and its storage list scroll separately. Click a unit there to
  see it in the info panel and weapon menu, then fit stored parts onto it, or **sell** them for half their price, rounded down (`CONFIG.sellRate`). The ✕ next to a fitted part in the
  weapon menu unequips it to storage (a base only comes off once it's the only part).
  Putting a part where one already is **replaces** it, and the old part goes to storage. Stored parts
  can be fitted onto any of your units later. A part's price is its game-length price plus $1 per rarity step
  (Common +0 … Legendary +4). Unbought offers reroll at your next main phase unless you **lock** them;
- **bought units** (civilian or military) go to your reserve; **deploy** reserve units onto
  empty octagons next to your deployable buildings, up to 2 per turn (`CONFIG.deploysPerTurn`); civilians can **build**. Storage can only be used
  during Main. Prices and starting units come from the game length.

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

## Units

| Unit | Type | Ability |
|---|---|---|
| **Troop** | military | fights; takes and holds octagons |
| **Builder** | civilian | builds one building per turn on a square next to it |
| **Medic** | civilian | once per turn, restores one of your units within 1 step (or itself) to full health |

Their stats are starting guesses in `js/data/units.js`. Abilities are set per unit type (`abilities: { build, heal }`),
and each unit type has a board icon (`icon`, drawn from `js/icons.js`).

## Element counters

Units can hold **positive and negative counters for each element** (thermal, electrical, biological), e.g.
3 positive electrical. Positive and negative counters of the **same** element cancel out, so each element is
stored as one net number (`unit.counters`, changed with `Units.addCounters(unit, element, amount)`). They're shown
above the unit on the board and in the info panel. What gives or uses counters will come from weapon parts.

## Territory and buildings

The board is 8×8 octagons. Squares sit where four octagons meet; along the edges there are **half squares**
(touching 2 octagons) and in the corners **quarter squares** (touching 1). The game is for 2 players:
Player 1's **HQ** is on the middle half square of the bottom edge, Player 2's on the top edge
(`CONFIG.startingBuildings`), and each starts controlling the octagons around it.
**Capturing the enemy HQ ends the game and wins it.**

- **Control:** when your **military** unit steps onto an octagon it becomes yours (tinted your colour) and
  stays yours until an enemy military unit steps on it. Civilian units never take control.
- **Deploying:** units can only be deployed onto empty octagons touching one of your buildings that is
  `deployable` (like the HQ). Other buildings, like a future hospital, don't allow deploying.
- **Building:** only units with the build ability (the **Builder**) can build, on an empty square touching
  them, once per turn. Buildings cost money (`cost`).
  The HQ can't be built.
- **Capturing:** a building switches to the enemy when they control a **majority** of the octagons around
  it: 3 of 4 for a full square, 2 of 2 for an edge half square (like the HQs), 1 of 1 for a corner.
  Buildings are coloured by owner.

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
