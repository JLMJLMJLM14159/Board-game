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
js/board.js         board shape: spaces and which ones touch
js/parts.js         weapon part classes (see below)
js/armory.js        working with a whole weapon
js/rules.js         game state + every action the game allows
js/ui.js            draws everything and reports clicks
js/main.js          connects rules and UI, plus undo history
```

Rules files (`synergy.js`, `board.js`, `parts.js`, `armory.js`, `rules.js`) never touch the screen.
The UI files never change the game state directly. Every change goes through `Rules.applyAction`.

## Turn structure

Each turn goes **Beginning → Main → Unit control → End**.
Beginning and End are automatic: they run any triggers ("at the beginning of your turn...")
and then skip straight on. A unit or building gets a trigger by adding
`triggers: { beginning(state, space) {...} }` to its entry in `js/data/`.

During **Main** you spend money to recruit units, which are either `civilian` or `military`.
Prices go in `CONFIG.unitCosts` in `js/config.js`. They're `null` (shown as "price TBD", and free) until decided.

## Weapon part classes

```
WeaponPart                 any part: id, name, synergy, stats
├── WeaponBase             the weapon's class (pistol, ar...). No rarity.
└── CustomPart             random rarity, stats x multiplier, optional class restriction
    ├── Barrel             one per weapon
    ├── Mag                one per weapon
    └── Attachment         2 per weapon, each a different type
```

Each class holds its own rules (`canInstallOn`, `installOn`, `createInstance`, `statsFor`).
A new kind of part is a new subclass. Parts in play are stored as plain `{ partId, rarity }`
data so the game state can be copied for undo.

## Part rarity

Every weapon part except the base gets a random rarity when it appears in the game:
Common ×1, Uncommon ×2, Rare ×3, Epic ×5, Legendary ×8. The multiplier scales the part's stats.
Rarities, colours, multipliers and odds are in `CONFIG.rarities`.

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
