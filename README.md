# Board Game Prototype

A same-screen prototype of a dystopian sci-fi board game. Plain HTML, CSS and JavaScript, with no build step.

**To play:** open `index.html` in a browser.

## Project structure

```
index.html          page layout
css/style.css       look and feel
js/config.js        tweakable numbers: board size, players, weapon slots, synergy elements
js/data/            the catalogues (currently empty, with templates)
  weapons.js          weapon bases + parts (barrels, mags, attachments)
  units.js            units that go on octagons
  buildings.js        buildings that go on squares
js/random.js        seeded randomness (undo-safe)
js/rarity.js        part rarity rolls
js/synergy.js       the Thermal -> Electrical -> Biological circle
js/board.js         board shape: spaces and which ones touch
js/armory.js        weapon-building rules (slots, compatibility)
js/rules.js         game state + every action the game allows
js/ui.js            draws everything and reports clicks
js/main.js          connects rules and UI, plus undo history
```

Rules files (`synergy.js`, `board.js`, `armory.js`, `rules.js`) never touch the screen.
The UI files never change the game state directly. Every change goes through `Rules.applyAction`.

## Turn structure

Each turn goes **Beginning → Main → Unit control → End**.
Beginning and End are automatic: they run any triggers ("at the beginning of your turn...")
and then skip straight on. A unit or building gets a trigger by adding
`triggers: { beginning(state, space) {...} }` to its entry in `js/data/`.

During **Main** you spend money to recruit units, which are either `civilian` or `military`.
Prices go in `CONFIG.unitCosts` in `js/config.js`. They're `null` (shown as "price TBD", and free) until decided.

## Part rarity

Every weapon part except the base gets a random rarity when it appears in the game:
Common ×1, Uncommon ×2, Rare ×3, Epic ×5, Legendary ×8. The multiplier scales the part's stats.
Rarities, colours, multipliers and odds are in `CONFIG.rarities`.

All randomness goes through `js/random.js`, which stores its position in the game state,
so undoing and redoing a roll gives the same result.

## Layout rule

The whole game must fit on one screen with no page scrolling, on laptops and tablets
in landscape or portrait. The board shrinks to fit the space that's left.

## How to add things

- **A weapon base or part:** add an entry to `js/data/weapons.js` using the template there.
- **A unit or building:** add an entry to `js/data/units.js` or `js/data/buildings.js`.
- **A new kind of move:** add an entry to `ACTIONS` in `js/rules.js` with `list`, `check` and `apply`.
  The side panel will offer it automatically wherever it's legal.

Anything not decided yet is marked `PLACEHOLDER RULE`. Search for it to find what needs filling in.
