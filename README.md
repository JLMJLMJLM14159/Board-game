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
js/synergy.js       the Thermal -> Electrical -> Biological circle
js/board.js         board shape: spaces and which ones touch
js/armory.js        weapon-building rules (slots, compatibility)
js/rules.js         game state + every action the game allows
js/ui.js            draws everything and reports clicks
js/main.js          connects rules and UI, plus undo history
```

Rules files (`synergy.js`, `board.js`, `armory.js`, `rules.js`) never touch the screen.
The UI files never change the game state directly. Every change goes through `Rules.applyAction`.

## How to add things

- **A weapon base or part:** add an entry to `js/data/weapons.js` using the template there.
- **A unit or building:** add an entry to `js/data/units.js` or `js/data/buildings.js`.
- **A new kind of move:** add an entry to `ACTIONS` in `js/rules.js` with `list`, `check` and `apply`.
  The side panel will offer it automatically wherever it's legal.

Anything not decided yet is marked `PLACEHOLDER RULE`. Search for it to find what needs filling in.
