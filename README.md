# 🔥 Auction Fever Simulator

> Generate 10 abstract artworks and watch 5 bot bidders fight for them.  
> Watch how hype distorts price vs. “real” value — in real time.

![p5.js](https://img.shields.io/badge/p5.js-1.9.4-ED225D?style=flat-square) ![vite](https://img.shields.io/badge/vite-5.x-646CFF?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-black?style=flat-square)

**Live demo:** `npm run dev` → http://localhost:5173

---

## Concept

Each run generates **10 abstract artworks** as random compositions of circles, rects, triangles, ellipses and arcs. Every piece gets a computed **intrinsic value** from pure geometry:

```
intrinsic = f(total shape area, shape count, palette variety, size variance)
```

Then **5 bot bidders** compete in a sequential English ascending auction — each with a different, deliberately biased strategy. The result is a small behavioral-economics experiment: does hype inflate price beyond fundamentals?

## The Bots

| Bot | Emoji | Budget | Strategy |
|-----|-------|--------|----------|
| **The Hypebeast** | 🔥 | $15,000 | Overpays when others bid. FOMO multiplier: +35% if ≥2 bids, +25% if contested. Will pay up to 2.2× intrinsic when hyped. |
| **The Snob** | 🎩 | $12,000 | Only likes black/white. Pays 1.65× for monochrome, ignores polychrome unless minimal (≤5 shapes, 12% chance). |
| **The Flipper** | ⚡ | $9,000 | Only buys cheap. Caps at $2,800, wants discount: only bids if price < 0.92× intrinsic. Hunts undervalued lots to flip. |
| **The Rational** | 📐 | $11,000 | Bids on actual area. Strict cap at 1.15× intrinsic (0.96× if coverage >60%). Walks away otherwise. |
| **The Whale** | 🐋 | $25,000 | Deep pockets, random fixation on 3 lots per session. On fixated lots will pay 2.6× intrinsic + 35% stubborn bonus if outbid. |

The **Whale’s fixation lots** and all randomness are seeded, so re-running with the same seed reproduces the same artworks and fixations. Change the seed to reroll.

## How the Auction Works

1. Starting price = `max(400, intrinsic × (0.35–0.60))`
2. English ascending: each round, bidders are shuffled. Each decides to bid `current + max(75, 6%)` or pass.
3. If a round has no bids, a no-bid streak counts — after 2 empty rounds (or 1 if >4 rounds in), the lot hammers.
4. If no one ever bids, the lot is **PASSED**.
5. After 10 lots, totals, avg hype (`hammer / intrinsic`), sell-through and most-hyped / best-value lots are summarized.

All bidder decisions include a human-readable `reason` shown in the live log.

## Tech

- **p5.js 1.9.4** — generative drawing, one instance per lot (instance mode, rounded paper, per-shape opacity/rotation)
- **Vite 5** — dev + build, no backend, no APIs
- **Vanilla JS** — three focused modules: `artGenerator.js`, `bidders.js`, `auction.js`
- Seeded RNG (`mulberry32`) for reproducible galleries

```
js/
  artGenerator.js  — palettes, shape generation, intrinsic valuation, drawArtwork()
  bidders.js       — 5 personas + decide() logic
  auction.js       — sequential engine + summarize()
  main.js          — UI, p5 mounting, chart, log animation, JSON export
css/style.css      — dark gallery theme
data/sample-auction.json — example run (seed 12345)
```

### Valuation in detail

`css/style.css:11` and `js/artGenerator.js:34`

```js
coverage  = totalShapeArea / canvasArea   // 0–0.9
areaScore = coverage * 4200
countScore = shapes.length * 85
paletteBonus = distinctColors * 120
varianceBonus = clamp(sqrt(var(areas))/40, 0, 600)
intrinsic = clamp(600 + areaScore + countScore + paletteBonus + varianceBonus + jitter, 450, 9200)
```

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # → dist/
npm run preview  # serve dist
```

No env vars. Works offline after install.

## Interact

- **Seed input** — type a number, hit *Reroll Art* to regenerate the same 10 compositions
- **Run Auction** — animates the bidding log at ~55ms/line, updates hammers live
- **Re-run Auction** — same artworks, new bidder shuffle order + whale fixation randomness seeded from `seed ^ 0x9e3779b9`
- **⬇ JSON** — downloads `{ seed, artworks, results, summary }` for analysis

## Data

A sample run is checked in at `data/sample-auction.json:1` (seed 12345): 9/10 sold, avg hype **1.63×**, total premium **+$9,169** over intrinsic. The most-hyped lot went for 2.24× intrinsic (Hypebeast vs Whale bidding war); the best-value lot was 1.12× (Flipper’s flip).

Export more runs via the UI and compare — hype variance is the point.

## What you’ll see

- Polychrome lots with high coverage tend to attract Hypebeast/Whale wars and the biggest premiums
- Monochrome minimal lots get sniped by the Snob at 1.7× even when Rational would call them overpriced
- The Flipper only wins when something slips cheap — often the best-value result
- Rational is the control: if only Rationals bid, `avgHype ≈ 1.05×`

## License

MIT — do what you want, just don’t blame the bots when you overpay.

---

*Built as a small behavioral-econ sketch: loops + random + simple bidder logic, just as spec’d. No servers, no wallets, just shapes and fever.*
