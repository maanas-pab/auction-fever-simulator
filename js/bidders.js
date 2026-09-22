/**
 * bidders.js — 5 bot bidder personas
 *
 * Each bot implements: willBid(artwork, currentPrice, context) -> { bid: boolean, amount: number, reason: string }
 * and has a budget / personality.
 */

export const BIDDER_DEFS = [
  {
    id: "hypebeast",
    name: "The Hypebeast",
    emoji: "🔥",
    color: "#FF3B30",
    bio: "Overpays when others bid. Feeds on momentum. FOMO incarnate.",
    budget: 15000,
    // logic: bids aggressively if bidCount >=2, willing to pay 2.2x intrinsic
  },
  {
    id: "snob",
    name: "The Snob",
    emoji: "🎩",
    color: "#8E8E93",
    bio: "Only likes black/white & minimal palettes. Pays premium for monochrome, ignores the rest.",
    budget: 12000,
  },
  {
    id: "flipper",
    name: "The Flipper",
    emoji: "⚡",
    color: "#30D158",
    bio: "Only buys cheap. Hunts undervalued lots, caps at $2,800, flips fast.",
    budget: 9000,
  },
  {
    id: "rational",
    name: "The Rational",
    emoji: "📐",
    color: "#0A84FF",
    bio: "Bids based on actual geometry — area + complexity. Walks away if price > 1.15× intrinsic.",
    budget: 11000,
  },
  {
    id: "whale",
    name: "The Whale",
    emoji: "🐋",
    color: "#BF5AF2",
    bio: "Deep pockets, erratic taste. Randomly fixates on 2–3 lots and refuses to lose.",
    budget: 25000,
  },
];

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

/**
 * Factory that returns bidder instances with state (spent, fixation, etc.)
 */
export function createBidders(rand) {
  // Whale picks fixation lots
  const whaleFixation = new Set();
  while (whaleFixation.size < 3) whaleFixation.add(Math.floor(rand() * 10));

  const state = {
    hypebeast: { spent: 0, wins: 0 },
    snob: { spent: 0, wins: 0 },
    flipper: { spent: 0, wins: 0 },
    rational: { spent: 0, wins: 0 },
    whale: { spent: 0, wins: 0, fixation: whaleFixation },
  };

  return {
    state,

    /**
     * @param {string} bidderId
     * @param {object} artwork
     * @param {number} currentPrice
     * @param {object} ctx - { bidCount, topBidder, round, competingBidders }
     * @returns {{bid:boolean, amount:number, reason:string}}
     */
    decide(bidderId, artwork, currentPrice, ctx) {
      const s = state[bidderId];
      const remaining = BIDDER_DEFS.find(b => b.id === bidderId).budget - s.spent;
      if (remaining < 100) return { bid: false, amount: 0, reason: "broke" };

      const intrinsic = artwork.intrinsicValue;
      const nextMin = currentPrice + Math.max(75, Math.round(currentPrice * 0.06));

      // Prevent bidding beyond budget
      if (nextMin > remaining + s.spent) return { bid: false, amount: 0, reason: "over budget" };

      switch (bidderId) {
        case "hypebeast": {
          // Hypebeast loves momentum
          const hype = ctx.bidCount >= 2 ? 1.35 : 1.0;
          const socialProof = ctx.bidCount * 0.09; // each bid adds willingness
          const willingness = intrinsic * (1.6 + socialProof) * hype;
          // even more if whale or others active
          const contestedBonus = ctx.bidCount >= 4 ? 1.25 : 1;
          const maxPay = willingness * contestedBonus;
          if (nextMin <= maxPay && nextMin <= remaining + s.spent) {
            const jitter = 1 + (rand() * 0.08 - 0.02);
            const amount = clamp(Math.round(nextMin * jitter), nextMin, Math.round(maxPay));
            return { bid: true, amount, reason: ctx.bidCount >= 3 ? "FOMO — everyone wants it" : "momentum" };
          }
          return { bid: false, amount: 0, reason: "not hyped enough" };
        }

        case "snob": {
          if (!artwork.isMonochrome) {
            // 12% chance to still bid if very minimal
            if (artwork.complexity > 5 || rand() > 0.12) return { bid: false, amount: 0, reason: "too colorful" };
          }
          const premium = artwork.isMonochrome ? 1.65 : 1.1;
          const maxPay = intrinsic * premium + (artwork.complexity <= 5 ? 800 : 0);
          if (nextMin <= maxPay) {
            return { bid: true, amount: nextMin, reason: artwork.isMonochrome ? "exquisite restraint" : "minimal enough" };
          }
          return { bid: false, amount: 0, reason: "overpriced for taste" };
        }

        case "flipper": {
          if (intrinsic > 3200) return { bid: false, amount: 0, reason: "too rich for flip" };
          if (currentPrice > 2800) return { bid: false, amount: 0, reason: "cap $2.8k" };
          // wants discount: only if price < 0.92 * intrinsic
          if (currentPrice < intrinsic * 0.92) {
            return { bid: true, amount: nextMin, reason: "undervalued — flip opportunity" };
          }
          // sometimes gambles on hype lots early
          if (ctx.bidCount <= 1 && currentPrice < 1800 && rand() > 0.55) {
            return { bid: true, amount: nextMin, reason: "cheap entry" };
          }
          return { bid: false, amount: 0, reason: "no margin" };
        }

        case "rational": {
          // Strict: never pays more than 1.15× intrinsic, values area
          const maxPay = intrinsic * 1.15;
          // rational also discounts high-coverage (less rare) slightly
          const adjustedMax = maxPay * (artwork.coverage > 0.6 ? 0.96 : 1);
          if (nextMin <= adjustedMax) {
            return { bid: true, amount: nextMin, reason: `area-valuation $${intrinsic.toLocaleString()} → max $${Math.round(adjustedMax).toLocaleString()}` };
          }
          return { bid: false, amount: 0, reason: "above intrinsic +15%" };
        }

        case "whale": {
          const isFixated = s.fixation.has(artwork.id);
          const base = isFixated ? intrinsic * 2.6 : intrinsic * 0.85;
          // Whale gets stubborn if outbid on fixation
          const stubborn = isFixated && ctx.topBidder && ctx.topBidder !== "whale" ? 1.35 : 1;
          const maxPay = base * stubborn * (0.9 + rand() * 0.3);
          if (nextMin <= maxPay) {
            const bump = isFixated ? Math.round(nextMin * (1 + rand() * 0.12)) : nextMin;
            return { bid: true, amount: clamp(bump, nextMin, Math.round(maxPay)), reason: isFixated ? "must have it" : "casual interest" };
          }
          return { bid: false, amount: 0, reason: isFixated ? "finally priced out" : "not my lot" };
        }

        default:
          return { bid: false, amount: 0, reason: "unknown bidder" };
      }
    },
  };
}

export function bidderById(id) {
  return BIDDER_DEFS.find(b => b.id === id);
}
