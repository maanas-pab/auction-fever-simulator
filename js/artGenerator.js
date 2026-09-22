/**
 * artGenerator.js — generates 10 abstract artworks with random shapes
 * Each artwork has a computed "intrinsic value" based on geometry (area + complexity)
 * so we can later compare against hype-inflated auction prices.
 */

const PALETTES = [
  { name: "Monochrome", colors: ["#0a0a0a", "#f5f5f5", "#8a8a8e", "#cfcfd1"], monochrome: true },
  { name: "Neon Pop", colors: ["#FF3B30", "#FFD60A", "#30D158", "#0A84FF", "#BF5AF2"], monochrome: false },
  { name: "Earth Mineral", colors: ["#8B5A2B", "#D4A574", "#2F4F3A", "#C9B99A", "#1A1A18"], monochrome: false },
  { name: "Oceanic", colors: ["#001F3F", "#0074D9", "#7FDBFF", "#39CCCC", "#F0F6FC"], monochrome: false },
  { name: "Noir Gold", colors: ["#0B0B0B", "#C9A86A", "#F5F1E8", "#6B6B6B", "#1A1A1A"], monochrome: false },
  { name: "Pastel Void", colors: ["#FFB5D8", "#B5DEFF", "#C3F0C8", "#FFE5B4", "#E8D5F2"], monochrome: false },
];

const TITLES = [
  "Untitled (Fever #", "Composition in ", "Study for Hype #",
  "Market Anxiety #", "Chromatic Drift #", "Signal / Noise #",
  "Late Capital #", "Volume & Void #", "After the Bid #", "Price Discovery #"
];

const SHAPE_TYPES = ["circle", "rect", "triangle", "ellipse", "arc"];

// Seeded RNG for reproducibility per session
export function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

function randRange(rand, min, max) {
  return min + rand() * (max - min);
}

/**
 * Compute intrinsic value from geometry.
 * Formula: normalized area contribution + shape count + color variety + balance bonus
 * Returns value in $ (500 - 8000 range roughly)
 */
export function computeIntrinsicValue(artwork, canvasSize = 400) {
  const canvasArea = canvasSize * canvasSize;
  let totalArea = 0;

  for (const s of artwork.shapes) {
    if (s.type === "circle") totalArea += Math.PI * s.r * s.r;
    else if (s.type === "ellipse") totalArea += Math.PI * s.rx * s.ry;
    else if (s.type === "rect") totalArea += s.w * s.h;
    else if (s.type === "triangle") totalArea += (s.size * s.size * Math.sqrt(3)) / 4;
    else if (s.type === "arc") totalArea += Math.PI * s.r * s.r * 0.5;
  }

  const coverage = Math.min(totalArea / canvasArea, 0.9); // 0-0.9
  const areaScore = coverage * 4200;
  const countScore = artwork.shapes.length * 85;
  const paletteBonus = new Set(artwork.shapes.map(s => s.color)).size * 120;
  const sizeVariance = (() => {
    const areas = artwork.shapes.map(s => {
      if (s.type === "circle") return Math.PI * s.r * s.r;
      if (s.type === "ellipse") return Math.PI * s.rx * s.ry;
      if (s.type === "rect") return s.w * s.h;
      if (s.type === "triangle") return (s.size * s.size * Math.sqrt(3)) / 4;
      return Math.PI * s.r * s.r * 0.5;
    });
    const mean = areas.reduce((a, b) => a + b, 0) / areas.length;
    const variance = areas.reduce((a, b) => a + (b - mean) ** 2, 0) / areas.length;
    return Math.min(Math.sqrt(variance) / 40, 600);
  })();

  const raw = 600 + areaScore + countScore + paletteBonus + sizeVariance;
  // add small noise
  const jitter = (Math.random() * 200 - 100);
  return Math.round(Math.max(450, Math.min(9200, raw + jitter)));
}

export function generateArtwork(id, rand) {
  const palette = pick(rand, PALETTES);
  const shapeCount = Math.floor(randRange(rand, 4, 11));
  const shapes = [];

  for (let i = 0; i < shapeCount; i++) {
    const type = pick(rand, SHAPE_TYPES);
    const color = pick(rand, palette.colors);
    const x = randRange(rand, 0.08, 0.92);
    const y = randRange(rand, 0.08, 0.92);
    const rotation = randRange(rand, 0, Math.PI * 2);
    const opacity = rand() > 0.35 ? 1 : randRange(rand, 0.55, 0.9);

    if (type === "circle") {
      shapes.push({ type, x, y, r: randRange(rand, 0.04, 0.18), color, rotation, opacity });
    } else if (type === "ellipse") {
      shapes.push({ type, x, y, rx: randRange(rand, 0.05, 0.2), ry: randRange(rand, 0.03, 0.14), color, rotation, opacity });
    } else if (type === "rect") {
      shapes.push({ type, x, y, w: randRange(rand, 0.08, 0.3), h: randRange(rand, 0.05, 0.22), color, rotation, opacity });
    } else if (type === "triangle") {
      shapes.push({ type, x, y, size: randRange(rand, 0.08, 0.28), color, rotation, opacity });
    } else if (type === "arc") {
      shapes.push({ type, x, y, r: randRange(rand, 0.06, 0.2), color, rotation, opacity, sweep: randRange(rand, Math.PI * 0.5, Math.PI * 1.4) });
    }
  }

  // sort by size descending so big shapes are background
  shapes.sort((a, b) => {
    const areaA = a.r ? a.r * a.r : a.w ? a.w * a.h : a.size ? a.size * a.size : a.rx * a.ry;
    const areaB = b.r ? b.r * b.r : b.w ? b.w * b.h : b.size ? b.size * b.size : b.rx * b.ry;
    return areaB - areaA;
  });

  const titleBase = pick(rand, TITLES);
  const titleSuffix = titleBase.includes("#") ? `${String(id + 1).padStart(2, "0")}` : "";
  const title = titleBase.includes("#") ? `${titleBase}${titleSuffix}` : `${titleBase} #${String(id + 1).padStart(2, "0")}`;

  const artwork = {
    id,
    title: title.replace("  ", " "),
    palette: palette.name,
    paletteColors: palette.colors,
    isMonochrome: palette.monochrome,
    shapes,
    year: 2024 + Math.floor(rand() * 2),
    medium: pick(rand, ["Digital pigment on canvas", "Generative vector", "Plotter ink on archival paper", "Algorithmic acrylic"]),
  };

  artwork.intrinsicValue = computeIntrinsicValue(artwork);
  artwork.complexity = shapes.length;
  artwork.coverage = Math.round((shapes.reduce((acc, s) => {
    if (s.type === "circle") return acc + Math.PI * s.r * s.r;
    if (s.type === "ellipse") return acc + Math.PI * s.rx * s.ry;
    if (s.type === "rect") return acc + s.w * s.h;
    if (s.type === "triangle") return acc + (s.size * s.size * Math.sqrt(3)) / 4;
    return acc + Math.PI * s.r * s.r * 0.5;
  }, 0) / 1) * 100) / 100; // normalized 0-1ish

  return artwork;
}

export function generateArtworks(count = 10, seed = Date.now() % 100000) {
  const rand = mulberry32(seed);
  const artworks = [];
  for (let i = 0; i < count; i++) {
    artworks.push(generateArtwork(i, rand));
  }
  return { artworks, seed };
}

/**
 * Draw an artwork into a p5 canvas region.
 * @param {p5} p - p5 instance
 * @param {Object} artwork - artwork object
 * @param {number} x - top-left x
 * @param {number} y - top-left y
 * @param {number} size - canvas size (square)
 */
export function drawArtwork(p, artwork, x, y, size) {
  p.push();
  p.translate(x, y);

  // paper
  p.noStroke();
  p.fill(245, 243, 238);
  p.rect(0, 0, size, size, 6);

  // subtle paper grain
  p.noFill();
  for (let i = 0; i < 40; i++) {
    p.stroke(0, 6);
    const gx = p.random(size);
    // grain - will be replaced by deterministic in gallery; keep light
  }
  p.noStroke();

  // clip to rounded rect? just draw shapes inside with padding
  const pad = size * 0.06;

  for (const s of artwork.shapes) {
    const cx = s.x * size;
    const cy = s.y * size;
    const col = p.color(s.color);
    col.setAlpha(Math.round((s.opacity ?? 1) * 255));
    p.fill(col);
    p.noStroke();
    p.push();
    p.translate(cx, cy);
    p.rotate(s.rotation || 0);

    if (s.type === "circle") {
      p.circle(0, 0, s.r * 2 * size);
    } else if (s.type === "ellipse") {
      p.ellipse(0, 0, s.rx * 2 * size, s.ry * 2 * size);
    } else if (s.type === "rect") {
      p.rectMode(p.CENTER);
      p.rect(0, 0, s.w * size, s.h * size, Math.min(8, size * 0.03));
    } else if (s.type === "triangle") {
      const sz = s.size * size;
      const h = (sz * Math.sqrt(3)) / 2;
      p.triangle(0, -h / 2, -sz / 2, h / 2, sz / 2, h / 2);
    } else if (s.type === "arc") {
      p.arc(0, 0, s.r * 2 * size, s.r * 2 * size, 0, s.sweep || p.PI, p.PIE);
    }
    p.pop();
  }

  // thin border
  p.noFill();
  p.stroke(0, 18);
  p.strokeWeight(1);
  p.rect(0, 0, size, size, 6);
  p.pop();
}
