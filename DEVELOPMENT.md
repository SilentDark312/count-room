# Development notes — The Count Room

This file exists so a future session (Claude or otherwise) can pick up work on this
project without re-deriving everything from scratch. If you're starting a new session
to make a change, read this first.

## What this is

A single-file, self-contained blackjack + card-counting trainer. No build step, no
runtime dependencies for the app itself — `index.html` is the entire app (HTML, CSS,
and JS inline, fonts pulled from Google Fonts). Node/npm/Playwright/ffmpeg are only
used by the CI tooling that generates the README showcase, never by the app.

## Where things live

- **Repo:** https://github.com/SilentDark312/count-room (public)
- **Live app:** https://silentdark312.github.io/count-room/ (GitHub Pages, auto-deploys
  from `master` on every push — no separate deploy step needed)
- A private Claude Artifact mirror of this app also exists, made before Pages was
  public (the original ask was for something playable on a phone without a claude.ai
  login). **It's probably safe to stop maintaining that mirror** — Pages is public now
  and works everywhere without login, so the Artifact copy is redundant unless the user
  says otherwise.
- Everything is in **`index.html`** — one file, no separate CSS/JS files.

## Architecture (`index.html`)

- Type is a `<style>` block, the body markup, then one big IIFE `<script>` at the very
  bottom (runs after all DOM elements exist, no `DOMContentLoaded` wrapper needed).
- Visual design: single dark "casino backroom" theme (felt green / brass / cream),
  deliberately *not* light/dark-adaptive — a considered choice (see git history /
  artifact-design rationale), not an oversight.
- Fonts: Fraunces (display headings), Archivo (UI/body), IBM Plex Mono (every number:
  bankroll, counts, card ranks, strategy tables) — via Google Fonts `<link>` tags.
- Four tabs (Learn / Strategy / Play / Trainer), toggled via the `hidden` attribute,
  bottom tab bar navigation.

### Key subsystems

- **Card/shoe helpers**: `buildDecks`, `shuffle`, `handValue`, `hiLoValue`, `rankValue`.
- **Basic strategy engine**: `hardAction`, `softAction`, `pairAction`, `recommend`.
  These all take rule flags (`h17`, `das`) as parameters — there is **one** set of
  strategy functions serving every deck-count/ruleset combination, not separate
  hardcoded tables per deck count. `tableRules(numDecks)` is the single place that maps
  shoe size to `{h17, das, label}`:
  - 1 deck → dealer hits soft 17, double-after-split (DAS) allowed
  - 2 decks → dealer stands on soft 17, DAS allowed
  - 3–8 decks → dealer stands on soft 17, no DAS (the original baseline ruleset)
  This mapping models how real casinos actually pair rules with deck count (fewer
  decks favors the player, so casinos add back player-unfriendly rules) rather than
  just shrinking the shoe with everything else held constant.
- **Illustrious 18 index plays**: `DEVIATIONS` array + `deviationAction()`. These
  numbers are the standard multi-deck, no-DAS calibration — **not** recalibrated per
  deck count. This is a documented, deliberate approximation (see the Strategy tab
  caption and "Known simplifications" below), not an oversight.
- **Game state**: one `game` object. Phase machine: `betting → insurance → player →
  dealer → done → betting…`. `game.numDecks` drives `tableRules()` everywhere.
- **Persistence**: `localStorage` key `countroom_save_v1` (bankroll, numDecks, stats
  for the trainer drills). Nothing else is persisted; no backend/capabilities used.
- **Trainer**: Speed Drill (cards flash on a timer, player enters their tracked
  running count) and True Count Quiz (multiple choice on running-count ÷
  decks-remaining arithmetic).

## Known, deliberate simplifications (already documented in-app — don't "fix" without asking)

- One split per hand, ever — no re-splitting.
- Split aces get exactly one card each, then stand automatically.
- Blackjack always pays 3:2 — no 6:5 tables modeled.
- Insurance/dealer-peek rules are constant across every deck count.
- Illustrious 18 is one fixed table for all deck counts (see above).
- No surrender.

## A real bug that got fixed along the way (context if something double-related looks off)

Double-after-split used to be silently allowed *regardless* of the posted "no DAS"
rule, contradicting both the UI copy and the pair-strategy chart's own math. Fixed by
`canDoubleFor(hand, rules)`, which now correctly gates it per the active ruleset. If
you're debugging doubling behavior, that function is the one place it's decided.

## Testing approach (there is no real browser in most Claude Code sandboxes)

This sandbox is ARM64 Linux; Chrome/Chromium has no official Linux ARM build, and
there's no root to install a system one — so Puppeteer/Playwright can't launch a
browser locally. The verification approach that worked, in order of how each change
should be checked:

1. **Syntax check**: extract the `<script>...</script>` contents to a `.js` file and
   run `node --check` on it.
2. **Pure-function unit tests**: copy just the strategy functions you're touching
   (`hardAction`, `softAction`, `pairAction`, `deviationAction`, `canDoubleFor`, etc.)
   into a throwaway Node script and assert against known strategy facts. This is how
   the H17/DAS deltas and the Illustrious 18 table were verified — dozens of assertions
   against published/cross-checked values before shipping. Re-run something like this
   any time the strategy engine changes.
3. **jsdom smoke test**: `npm install jsdom --no-save`, then load the full
   `index.html` with `runScripts: 'dangerously'` and click through tabs/buttons to
   confirm no runtime errors and that state updates (bankroll, hint text, etc.) render
   correctly. Good for catching wiring bugs unit tests on isolated functions would miss.
4. **Real visual verification happens via CI**, not locally — see below.

   Gotcha: `npm install <pkg> --no-save` in a directory with no `package.json` will
   prune previously-installed packages on each call (npm treats them as extraneous).
   Install everything you need for a session in **one** `npm install a b c --no-save`
   call, not several separate ones.

## CI showcase pipeline

`.github/workflows/showcase.yml` runs a scripted Playwright walkthrough
(`scripts/record-showcase.mjs`) on GitHub's own x64 runners — this is also, in
practice, the only way to get a *real* rendered screenshot of a change from this
sandbox, since it can't run Chrome locally. It triggers automatically on any push that
touches `index.html`, or manually:

```
gh workflow run showcase.yml --repo SilentDark312/count-room
gh run watch <run-id> --repo SilentDark312/count-room --exit-status
```

It records a walkthrough, converts it to `docs/showcase.gif` + `docs/showcase.mp4`
with ffmpeg, and commits those back to the repo (that's why the workflow needs
`permissions: contents: write`). To pull a still frame out locally for visual review
after a run finishes:

```
npm install ffmpeg-static --no-save
git pull
node_modules/ffmpeg-static/ffmpeg -y -ss 5.3 -i docs/showcase.mp4 -vframes 1 frame.png
# then Read frame.png
```

`videos/`, `node_modules/`, and `package-lock.json` are gitignored — they're
CI/local-only artifacts, never committed.

## CI screenshot verification (for reviewing a specific change, not showcasing)

The showcase walkthrough only visits what it's scripted to visit, so it won't show a
new feature unless you update it. For quickly checking how a specific screen/state
actually renders, use `.github/workflows/verify-screens.yml` instead — it runs
`scripts/capture-screens.mjs` (edit this to capture whatever states you're checking)
and uploads plain PNGs as a build artifact rather than committing anything:

```
gh workflow run verify-screens.yml --repo SilentDark312/count-room
gh run watch <run-id> --repo SilentDark312/count-room --exit-status
gh run download <run-id> --repo SilentDark312/count-room -n verify-screens -D verify-out
# then Read the PNGs in verify-out/
```

## Workflow for making a change

1. Clone the repo fresh — don't assume any previous session's scratchpad copy of
   `index.html` still exists; those live in a session-temp directory.
2. Edit `index.html` directly (it's the only source file).
3. Run the syntax + unit-test + jsdom checks above for whatever you touched.
4. Commit, push to `master`. Pages redeploys and the showcase workflow reruns
   automatically — no manual deploy step.
5. Optionally watch the showcase run and pull a frame to visually confirm the change
   actually looks right, per the CI section above.

## Open questions / things worth revisiting if the user asks

- Whether to keep the private Claude Artifact mirror in sync going forward (see above
  — probably not needed anymore).
- The Illustrious 18 table could eventually be split per ruleset (1-deck vs 2-deck vs
  3+-deck) for more precision, if that's ever worth the added complexity.
- No resplitting, no surrender, no 6:5 payout tables — all deliberate scope cuts that
  would each be a real, if bounded, feature addition if requested.
