# Scorekeeper

An offline score sheet for playing **Romanian Whist** and **Rentz** with real
cards: set up a table in seconds, write each round's numbers with a stylus (or
tap them in), and the scores are calculated with exactly the same rules as the
card game *Whist With A Twist*.

- **Works offline.** It is an installable web app (PWA). After the first visit,
  everything — including the handwriting model — is cached on the tablet.
- **Handwriting.** Write a digit into a cell with the pen; it is recognised on
  the device. Cells only accept values that make sense there (a 1-card round
  allows 0 or 1, the last bettor's banned bet is excluded), which keeps
  recognition reliable. Unsure readings offer the best guesses to tap. Scratch a
  cell out to clear it; tap it for a number pad. A resting hand is ignored while
  writing with a pen (Settings can allow finger writing).
- **Whist:** the round plan (1s, 2–7, 8s, 7–2, 1s, or starting with 8s), who
  bets first, the banned last bet, trick-sum checks, 5 + bet / −difference
  scoring, running totals and places.
- **Rentz:** each player chooses each of the 8 contracts once; each round asks
  only for what its contract needs (tricks, queens, diamonds, who took the King
  of Hearts, or finishing places), checks the totals and scores it.
- Undo/redo, editing past rounds, autosave, game history, export/import as JSON.

## Use it

Open https://ilightyx.github.io/whist-scoreboard/ on the tablet and choose
**Add to Home Screen** / **Install app**. It then opens like an app and keeps
working in airplane mode.

## Develop

```bash
npm ci
npm run dev          # local dev server
npm test             # rules (vs. the game), game model, handwriting
npm run e2e          # Playwright: full games, pen input, offline (builds first)
npm run build        # production build in dist/
```

### Rules stay identical to the game

`src/rules/` is a TypeScript port of the rules of *Whist With A Twist*, a
Godot card game (a separate, private project). The game generates test cases
from its real rules into `src/rules/fixtures/*.json`, and `npm test` must
reproduce every case. When the game's rules change, regenerate the fixtures in
the game project, copy them here, and update `src/rules/` until the tests pass.

### Handwriting model

`public/models/digits.json` is a small neural network (784 → 512 → 256 → 10,
int8 weights, ~700 KB) run by `src/ink/recognizer.ts` without any ML library.
Retrain it with NumPy + Pillow:

```bash
npm run train-model    # python3 model/train_digits.py
```

It trains on MNIST, augmented to look like pen strokes, and reaches about 98.9%
on the MNIST test set. **Settings → Handwriting check** measures accuracy on
your own handwriting and can export samples.

## Publish

`.github/workflows/pages.yml` builds and deploys to GitHub Pages on every push
to `main`, at https://ilightyx.github.io/whist-scoreboard/. Turn it on once
under **Settings → Pages → Source: GitHub Actions**.

`.github/workflows/ci.yml` type-checks, lints and runs the unit and
end-to-end tests on every push and pull request.

## Credits

The handwriting model is trained on the [MNIST](http://yann.lecun.com/exdb/mnist/)
database of handwritten digits (Y. LeCun, C. Cortes, C. J. C. Burges),
licensed CC BY-SA 3.0. The app uses React (MIT), Dexie.js (Apache-2.0) and
Workbox via vite-plugin-pwa (MIT).
