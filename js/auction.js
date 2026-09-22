/**
 * auction.js — sequential auction engine
 * Runs 10 lots, each with English ascending auction among bots.
 */

export function runAuction(artworks, bidders, rand) {
  const results = [];
  const globalLog = [];

  for (const art of artworks) {
    const lot = runLot(art, bidders, rand);
    results.push(lot);
    globalLog.push(...lot.log.map(l => ({ lot: art.id + 1, ...l })));

    // update bidder spent if sold
    if (lot.winner) {
      bidders.state[lot.winner].spent += lot.hammerPrice;
      bidders.state[lot.winner].wins += 1;
    }
  }

  return { results, globalLog };
}

function runLot(artwork, bidders, rand) {
  const startingPrice = Math.max(400, Math.round(artwork.intrinsicValue * (0.35 + rand() * 0.25)));
  let currentPrice = startingPrice;
  let topBidder = null;
  let bidCount = 0;
  const log = [];
  const history = [{ price: currentPrice, bidder: null, label: "Opening" }];

  // Random bidder order each round, 12-20 rounds max
  const maxRounds = 14 + Math.floor(rand() * 8);
  let noBidStreak = 0;

  log.push({ type: "open", price: currentPrice, bidder: null, msg: `Lot ${artwork.id + 1} — "${artwork.title}" opens at $${currentPrice.toLocaleString()} (intrinsic $${artwork.intrinsicValue.toLocaleString()})` });

  for (let round = 0; round < maxRounds; round++) {
    // shuffle bidder order
    const order = ["hypebeast", "snob", "flipper", "rational", "whale"].sort(() => rand() - 0.5);
    let bidsThisRound = 0;

    for (const bidderId of order) {
      if (bidderId === topBidder) continue; // can't outbid self immediately
      const decision = bidders.decide(bidderId, artwork, currentPrice, {
        bidCount,
        topBidder,
        round,
        artwork,
      });

      if (decision.bid) {
        const amount = Math.max(decision.amount, currentPrice + Math.max(75, Math.round(currentPrice * 0.06)));
        currentPrice = amount;
        topBidder = bidderId;
        bidCount++;
        bidsThisRound++;
        noBidStreak = 0;
        history.push({ price: currentPrice, bidder: bidderId, reason: decision.reason });
        log.push({ type: "bid", price: currentPrice, bidder: bidderId, msg: `${label(bidderId)} bids $${currentPrice.toLocaleString()} — ${decision.reason}` });
      }
    }

    if (bidsThisRound === 0) {
      noBidStreak++;
      if (noBidStreak >= 2 || (bidCount > 0 && noBidStreak >= 1 && round > 4)) break;
      if (bidCount === 0 && round >= 2) break; // no interest
    }

    // hype escalation: if many bids, hypebeast may jump again next round (handled via decide)
  }

  let hammerPrice = null;
  let winner = null;
  let premium = null;
  let hypeRatio = null;
  let status = "unsold";

  if (topBidder && bidCount > 0) {
    hammerPrice = currentPrice;
    winner = topBidder;
    premium = hammerPrice - artwork.intrinsicValue;
    hypeRatio = hammerPrice / artwork.intrinsicValue;
    status = "sold";
    log.push({ type: "hammer", price: hammerPrice, bidder: winner, msg: `🔨 SOLD to ${label(winner)} for $${hammerPrice.toLocaleString()} (${hypeRatio.toFixed(2)}× intrinsic)` });
  } else {
    log.push({ type: "pass", price: currentPrice, bidder: null, msg: `⏭️  PASSED — no bids met reserve` });
  }

  return {
    artwork,
    startingPrice,
    hammerPrice,
    winner,
    bidCount,
    history,
    log,
    premium,
    hypeRatio,
    status,
  };
}

function label(id) {
  const map = { hypebeast: "Hypebeast 🔥", snob: "Snob 🎩", flipper: "Flipper ⚡", rational: "Rational 📐", whale: "Whale 🐋" };
  return map[id] || id;
}

export function summarize(results) {
  const sold = results.filter(r => r.status === "sold");
  const totalHammer = sold.reduce((a, r) => a + r.hammerPrice, 0);
  const totalIntrinsic = results.reduce((a, r) => a + r.artwork.intrinsicValue, 0);
  const totalPremium = sold.reduce((a, r) => a + r.premium, 0);
  const avgHype = sold.length ? sold.reduce((a, r) => a + r.hypeRatio, 0) / sold.length : 0;
  const mostHypedd = [...sold].sort((a, b) => b.hypeRatio - a.hypeRatio)[0] || null;
  const bestValue = [...sold].sort((a, b) => a.hypeRatio - b.hypeRatio)[0] || null;

  // per-bidder stats
  const byBidder = {};
  for (const r of sold) {
    byBidder[r.winner] = (byBidder[r.winner] || 0) + 1;
  }

  return {
    totalLots: results.length,
    soldCount: sold.length,
    unsoldCount: results.length - sold.length,
    totalHammer,
    totalIntrinsic,
    totalPremium,
    avgHype,
    mostHypedd,
    bestValue,
    byBidder,
    sellThrough: sold.length / results.length,
  };
}
