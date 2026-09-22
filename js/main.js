import p5 from "p5";
import { generateArtworks, drawArtwork } from "./artGenerator.js";
import { BIDDER_DEFS, createBidders } from "./bidders.js";
import { runAuction, summarize } from "./auction.js";
import { mulberry32 } from "./artGenerator.js";

const app = document.getElementById("app");

// state
let seed = Math.floor(Math.random() * 90000) + 10000;
let artworks = [];
let auctionResults = null;
let summary = null;
let p5Instances = [];

function fmt(n) {
  return "$" + n.toLocaleString();
}

function bidderMeta(id) {
  return BIDDER_DEFS.find(b => b.id === id);
}

function renderShell() {
  app.innerHTML = `
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand">
        <div class="brand-mark">AF</div>
        <div>
          <h1>Auction Fever Simulator</h1>
          <p>10 abstract works · 5 bots · hype vs. intrinsic value</p>
        </div>
      </div>
      <div class="actions">
        <input id="seedInput" class="seed-input" type="number" value="${seed}" title="Seed" />
        <button id="btnReroll" class="btn">🎲 Reroll Art</button>
        <button id="btnRun" class="btn btn-primary">▶ Run Auction</button>
        <button id="btnExport" class="btn btn-ghost">⬇ JSON</button>
      </div>
    </div>
  </header>

  <div class="wrap">
    <div class="hero">
      <div class="card card-pad">
        <h2>How it works</h2>
        <h3>Watch hype distort price vs “real” value.</h3>
        <p style="color:var(--muted); font-size:13px; margin-top:6px">
          Each artwork’s <strong style="color:var(--text)">intrinsic value</strong> is computed from geometry — total shape area, shape count, palette variety and balance. Bots then bid with wildly different logics. Some are rational, most are not.
        </p>
        <div class="divider"></div>
        <div class="kicker">Bidders</div>
        <div class="bidders" id="biddersList" style="margin-top:8px"></div>
      </div>

      <div class="card card-pad" id="statsCard">
        <h2>Auction Results</h2>
        <div id="statsGrid" class="stats-grid"></div>
        <div id="chartWrap" class="chart"></div>
      </div>
    </div>

    <div class="card card-pad">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap">
        <h2 style="margin:0">Gallery — 10 lots</h2>
        <span class="mono" style="font-size:11px; color:var(--muted)">seed ${seed} · p5.js generative</span>
      </div>
      <div id="gallery" class="gallery"></div>
    </div>

    <div class="card card-pad" style="margin-top:14px">
      <h2>Auction log</h2>
      <div id="log" class="log"><div class="log-line" style="color:var(--muted)">Press <strong style="color:var(--text)">Run Auction</strong> to start the bidding war.</div></div>
    </div>

    <div class="foot mono">
      <span>Built with p5.js · Vite · loops + random + simple bidder logic. No APIs, no backends.</span>
      <span><a href="https://github.com" target="_blank">View on GitHub</a> · MIT</span>
    </div>
  </div>
  `;

  document.getElementById("btnReroll").addEventListener("click", () => {
    const input = document.getElementById("seedInput");
    seed = parseInt(input.value) || Math.floor(Math.random() * 90000) + 10000;
    initArtworks();
  });
  document.getElementById("seedInput").addEventListener("change", (e) => {
    seed = parseInt(e.target.value) || seed;
  });
  document.getElementById("btnRun").addEventListener("click", runAuctionUI);
  document.getElementById("btnExport").addEventListener("click", exportJSON);
}

function renderBidders() {
  const el = document.getElementById("biddersList");
  el.innerHTML = BIDDER_DEFS.map(b => `
    <div class="bidder">
      <div class="bidder-emoji">${b.emoji}</div>
      <div class="bidder-meta">
        <div class="bidder-name">${b.name}</div>
        <div class="bidder-bio">${b.bio}</div>
      </div>
      <div class="bidder-budget"><span class="dot" style="background:${b.color}"></span> ${fmt(b.budget)}</div>
    </div>
  `).join("");
}

function renderStats() {
  const grid = document.getElementById("statsGrid");
  const chartWrap = document.getElementById("chartWrap");
  if (!summary) {
    grid.innerHTML = `
      <div class="stat"><div class="stat-label">Total Hammer</div><div class="stat-value">—</div><div class="stat-sub">run auction to see</div></div>
      <div class="stat"><div class="stat-label">Avg Hype</div><div class="stat-value">—</div><div class="stat-sub">hammer / intrinsic</div></div>
      <div class="stat"><div class="stat-label">Sell-through</div><div class="stat-value">—</div><div class="stat-sub">lots sold / 10</div></div>
      <div class="stat"><div class="stat-label">Total Premium</div><div class="stat-value">—</div><div class="stat-sub">over intrinsic</div></div>
    `;
    chartWrap.innerHTML = `<p style="color:var(--muted); font-size:12px; margin-top:10px">Price vs intrinsic chart appears after the auction.</p>`;
    return;
  }

  grid.innerHTML = `
    <div class="stat"><div class="stat-label">Total Hammer</div><div class="stat-value">${fmt(summary.totalHammer)}</div><div class="stat-sub">${summary.soldCount} / ${summary.totalLots} sold</div></div>
    <div class="stat"><div class="stat-label">Avg Hype</div><div class="stat-value">${summary.avgHype.toFixed(2)}×</div><div class="stat-sub">${summary.avgHype > 1.2 ? "fever" : summary.avgHype > 1 ? "warm" : "cold"}</div></div>
    <div class="stat"><div class="stat-label">Sell-through</div><div class="stat-value">${Math.round(summary.sellThrough * 100)}%</div><div class="stat-sub">${summary.unsoldCount} passed</div></div>
    <div class="stat"><div class="stat-label">Total Premium</div><div class="stat-value" style="color:${summary.totalPremium > 0 ? "var(--accent)" : "#30d158"}">${summary.totalPremium > 0 ? "+" : ""}${fmt(summary.totalPremium)}</div><div class="stat-sub">vs intrinsic ${fmt(summary.totalIntrinsic)}</div></div>
  `;

  // Most hyped / best value callouts
  let callouts = "";
  if (summary.mostHypedd) {
    callouts += `<div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px">
      <span class="pill live">🔥 Most hyped: Lot ${summary.mostHypedd.artwork.id + 1} ${fmt(summary.mostHypedd.hammerPrice)} (${summary.mostHypedd.hypeRatio.toFixed(2)}×)</span>
      <span class="pill live">💎 Best value: Lot ${summary.bestValue.artwork.id + 1} ${fmt(summary.bestValue.hammerPrice)} (${summary.bestValue.hypeRatio.toFixed(2)}×)</span>
    </div>`;
  }

  // Bars
  const maxPrice = Math.max(...auctionResults.map(r => Math.max(r.artwork.intrinsicValue, r.hammerPrice || 0))) * 1.05;
  const rows = auctionResults.map(r => {
    const intrinsicPct = (r.artwork.intrinsicValue / maxPrice) * 100;
    const hammer = r.hammerPrice ?? 0;
    const premium = hammer ? hammer - r.artwork.intrinsicValue : 0;
    const hammerPct = hammer ? (hammer / maxPrice) * 100 : 0;
    const barColor = premium > 600 ? "bar-premium" : premium < -300 ? "bar-discount" : "bar-intrinsic";
    const label = `Lot ${r.artwork.id + 1}`;
    return `
      <div class="chart-row">
        <div class="chart-label">${label}</div>
        <div class="chart-track" title="intrinsic ${fmt(r.artwork.intrinsicValue)} → hammer ${r.hammerPrice ? fmt(r.hammerPrice) : "unsold"}">
          <div class="bar-intrinsic" style="width:${intrinsicPct}%"></div>
          ${r.status === "sold" ? `<div class="${premium >= 0 ? "bar-premium" : "bar-discount"}" style="width:${Math.abs(hammer - r.artwork.intrinsicValue) / maxPrice * 100}%"></div>` : ""}
        </div>
        <div class="chart-num" style="color:${r.status === "sold" ? (premium > 800 ? "var(--accent)" : "var(--text)") : "var(--muted)"}">${r.status === "sold" ? fmt(r.hammerPrice) : "—"}</div>
      </div>
    `;
  }).join("");

  chartWrap.innerHTML = `
    <div class="kicker" style="margin-top:12px">Price vs Intrinsic — intrinsic (grey) + premium/discount (color)</div>
    ${callouts}
    <div class="chart-bars">${rows}</div>
    <div style="display:flex; gap:10px; margin-top:8px; font-size:11px; color:var(--muted)">
      <span><span class="dot" style="background:#2a2a30"></span> intrinsic</span>
      <span><span class="dot" style="background:var(--accent)"></span> hype premium</span>
      <span><span class="dot" style="background:#0a84ff"></span> discount</span>
    </div>
  `;
}

function clearP5() {
  p5Instances.forEach(inst => {
    try { inst.remove(); } catch {}
  });
  p5Instances = [];
}

function renderGallery() {
  const gallery = document.getElementById("gallery");
  gallery.innerHTML = "";
  clearP5();

  artworks.forEach((art) => {
    const lotResult = auctionResults?.find(r => r.artwork.id === art.id) || null;
    const card = document.createElement("div");
    card.className = "lot" + (lotResult ? (lotResult.status === "sold" ? " sold" : " passed") : "");
    card.innerHTML = `
      <div class="lot-canvas" id="canvas-${art.id}"></div>
      <div class="lot-head">
        <div class="lot-title">${art.title}</div>
        <div class="lot-meta">${art.palette} · ${art.medium} · ${art.year} · ${art.complexity} shapes</div>
      </div>
      <div class="lot-body">
        <div class="pill-row">
          <span class="pill">${art.isMonochrome ? "◐ monochrome" : "◉ polychrome"}</span>
          <span class="pill">area ${(art.coverage * 100).toFixed(0)}%</span>
          <span class="pill live">intrinsic ${fmt(art.intrinsicValue)}</span>
        </div>
        <div class="price-row" id="price-${art.id}"></div>
        <div class="winner" id="winner-${art.id}"></div>
      </div>
    `;
    gallery.appendChild(card);

    // p5 sketch for this lot
    const container = card.querySelector(`#canvas-${art.id}`);
    const sketch = (p) => {
      p.setup = () => {
        const c = p.createCanvas(container.clientWidth, container.clientWidth);
        c.parent(container);
        p.noLoop();
      };
      p.draw = () => {
        drawArtwork(p, art, 0, 0, p.width);
      };
      p.windowResized = () => {
        p.resizeCanvas(container.clientWidth, container.clientWidth);
        p.redraw();
      };
    };
    const inst = new p5(sketch);
    p5Instances.push(inst);
  });

  updateLotPrices();
}

function updateLotPrices() {
  artworks.forEach(art => {
    const priceEl = document.getElementById(`price-${art.id}`);
    const winnerEl = document.getElementById(`winner-${art.id}`);
    if (!priceEl) return;
    const r = auctionResults?.find(x => x.artwork.id === art.id);
    if (!r) {
      priceEl.innerHTML = `
        <div class="price-box"><div class="price-label">Intrinsic</div><div class="price-val">${fmt(art.intrinsicValue)}</div></div>
        <div class="price-box"><div class="price-label">Hammer</div><div class="price-val" style="color:var(--muted)">— run auction</div></div>
      `;
      winnerEl.innerHTML = `<span style="color:var(--muted)">Awaiting bids…</span>`;
      return;
    }
    if (r.status === "sold") {
      const premium = r.premium;
      const hype = r.hypeRatio;
      priceEl.innerHTML = `
        <div class="price-box"><div class="price-label">Intrinsic</div><div class="price-val">${fmt(art.intrinsicValue)}</div></div>
        <div class="price-box"><div class="price-label">Hammer</div><div class="price-val ${hype > 1.35 ? "hype" : hype < 0.92 ? "good" : ""}">${fmt(r.hammerPrice)}</div>
          <div style="font-size:10px; color:${premium > 0 ? "var(--accent)" : "#30d158"}">${premium > 0 ? "+" : ""}${fmt(premium)} · ${hype.toFixed(2)}×</div>
          <div class="hype-bar"><div class="hype-fill" style="width:${Math.min(100, hype * 42)}%; background:${hype > 1.3 ? "var(--accent)" : hype > 1.08 ? "#ff8a30" : "#30d158"}"></div></div>
        </div>
      `;
      const meta = bidderMeta(r.winner);
      winnerEl.innerHTML = `Winner <strong>${meta.emoji} ${meta.name}</strong> · ${r.bidCount} bids`;
    } else {
      priceEl.innerHTML = `
        <div class="price-box"><div class="price-label">Intrinsic</div><div class="price-val">${fmt(art.intrinsicValue)}</div></div>
        <div class="price-box"><div class="price-label">Hammer</div><div class="price-val" style="color:var(--muted)">PASSED</div><div style="font-size:10px; color:var(--muted)">no bids met reserve</div></div>
      `;
      winnerEl.innerHTML = `<span style="color:var(--muted)">● Passed — reserve not met</span>`;
    }
  });
}

function renderLog(log) {
  const el = document.getElementById("log");
  if (!log || log.length === 0) {
    el.innerHTML = `<div class="log-line" style="color:var(--muted)">No bids.</div>`;
    return;
  }
  el.innerHTML = log.map(l => {
    const tagClass = l.type === "bid" ? "bid" : l.type === "hammer" ? "hammer" : l.type;
    const tag = l.type === "bid" ? `BID ${l.bidder}` : l.type.toUpperCase();
    return `<div class="log-line"><span class="log-tag ${tagClass}">${tag}</span><span>${l.msg}</span><span style="margin-left:auto; color:var(--muted-2)">${l.price ? fmt(l.price) : ""}</span></div>`;
  }).join("");
  el.scrollTop = el.scrollHeight;
}

function initArtworks() {
  const { artworks: arts } = generateArtworks(10, seed);
  artworks = arts;
  auctionResults = null;
  summary = null;
  // also reset seed display in subheader if rerolled
  const mono = document.querySelector(".wrap .mono");
  if (mono) mono.textContent = `seed ${seed} · p5.js generative`;
  renderGallery();
  renderStats();
  renderLog([]);
  document.getElementById("btnRun").disabled = false;
  document.getElementById("btnRun").textContent = "▶ Run Auction";
}

function runAuctionUI() {
  const btn = document.getElementById("btnRun");
  btn.disabled = true;
  btn.textContent = "⏳ Bidding…";

  // create bidders with rand derived from seed for reproducibility per auction run
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const bidders = createBidders(rand);
  const { results, globalLog } = runAuction(artworks, bidders, rand);
  auctionResults = results;
  summary = summarize(results);

  // animate log lines
  const logEl = document.getElementById("log");
  logEl.innerHTML = "";
  let i = 0;
  const timer = setInterval(() => {
    if (i >= globalLog.length) {
      clearInterval(timer);
      btn.disabled = false;
      btn.textContent = "↺ Re-run Auction";
      updateLotPrices();
      renderStats();
      // re-apply lot sold/passed classes
      document.querySelectorAll(".lot").forEach((el, idx) => {
        el.classList.remove("sold", "passed");
        const r = results[idx];
        if (r) el.classList.add(r.status === "sold" ? "sold" : "passed");
      });
      return;
    }
    const l = globalLog[i];
    const line = document.createElement("div");
    line.className = "log-line";
    const tagClass = l.type === "bid" ? "bid" : l.type === "hammer" ? "hammer" : l.type;
    line.innerHTML = `<span class="log-tag ${tagClass}">${l.type === "bid" ? "BID " + l.bidder : l.type.toUpperCase()}</span><span>${l.msg}</span><span style="margin-left:auto; color:var(--muted-2)">${l.price ? fmt(l.price) : ""}</span>`;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;

    // live update hammer for this lot if hammer
    if (l.type === "hammer" || l.type === "pass") {
      // subtle price flash
    }

    i++;
  }, 55);
}

function exportJSON() {
  const payload = {
    seed,
    generatedAt: new Date().toISOString(),
    artworks: artworks.map(a => ({
      id: a.id, title: a.title, palette: a.palette, isMonochrome: a.isMonochrome,
      complexity: a.complexity, coverage: a.coverage, intrinsicValue: a.intrinsicValue,
      shapes: a.shapes.length, year: a.year, medium: a.medium
    })),
    results: auctionResults ? auctionResults.map(r => ({
      lot: r.artwork.id + 1,
      title: r.artwork.title,
      intrinsicValue: r.artwork.intrinsicValue,
      startingPrice: r.startingPrice,
      hammerPrice: r.hammerPrice,
      status: r.status,
      winner: r.winner,
      bidCount: r.bidCount,
      hypeRatio: r.hypeRatio,
      premium: r.premium,
    })) : null,
    summary,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `auction-fever-${seed}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// boot
renderShell();
renderBidders();
initArtworks();
