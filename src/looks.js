// Partial value sets applied with controller.setValues(). Anything not listed
// falls back to the panel defaults (we reset first). Looks never set colors:
// the palette is chosen separately so every look works in every palette.
// All looks share the Scanner's slow pace: gentle spin, slow surface motion.

export const LOOKS = {
  signal: {},

  scanner: {
    object: { shape: 'cloud', scale: 1.6, displace: { amount: 0.5, frequency: 0.9, speed: 0.3, twist: 0 } },
    surface: { pattern: 'cloud', scale: 6, mix: 0.9, width: 0.6, speed: 0.6 },
    raster: { cell: 9, shape: 'circle', dotMax: 0.55, baseGrid: 0.35, baseSize: 0.14, glow: 0.4 },
    blobs: { amount: 0.75, threshold: 0.42, softness: 0.06, blur: 10, grain: 0.7 },
    overlay: { boxes: 6, boxLabels: true },
  },

  topo: {
    object: { shape: 'gear', scale: 1.3, displace: { amount: 0.15, frequency: 1.6, speed: 0.2, twist: 0 } },
    surface: { pattern: 'topo', scale: 22, width: 0.35, speed: 0.25, mix: 1, rim: 0.3 },
    raster: { cell: 5, shape: 'square', dotMax: 0.85, angle: 45, baseGrid: 0.08 },
  },

  halftone: {
    object: { shape: 'heart', scale: 1.4, displace: { amount: 0.15, frequency: 1.1, speed: 0.15, twist: 0 } },
    surface: { pattern: 'fingerprint', scale: 7, width: 0.5, speed: 0.2 },
    raster: { cell: 7, shape: 'circle', angle: 15, dotMax: 1.25, baseGrid: 0, threshold: 0, glow: 0, flicker: 0 },
    overlay: { blend: 'normal' },
  },

  code: {
    object: { shape: 'headphones', scale: 1.35, spin: { x: 0.04, y: 0.03 }, displace: { amount: 0.18, frequency: 1.2, speed: 0.25, twist: 0 } },
    surface: { pattern: 'cloud', scale: 5, width: 0.7, mix: 0.6, speed: 0.4, rim: 0.9 },
    raster: { cell: 13, shape: 'code', dotMin: 0.75, dotMax: 1.1, contrast: 1.7, threshold: 0.1, baseGrid: 0, glow: 0, flicker: 0 },
    glyphs: { rate: 1.5, jitter: 0.3 },
  },
}

// glyphs on grainy squares, Scanner-style surface
LOOKS.tiles = {
  object: { shape: 'speech', scale: 1.6, displace: { amount: 0.3, frequency: 0.9, speed: 0.3, twist: 0 } },
  surface: { pattern: 'cloud', scale: 6, mix: 0.9, width: 0.6, speed: 0.6 },
  raster: { cell: 12, shape: 'code', dotMin: 0.8, dotMax: 0.95, contrast: 1.7, threshold: 0.3, baseGrid: 0, glow: 0, flicker: 0 },
  glyphs: { rate: 1, jitter: 0.4, strays: 0.5 },
  tiles: { mode: 'behind', amount: 0.45, size: 1, grain: 0.5, coverage: 1 },
}

const rnd = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const chance = (p) => Math.random() < p

export function randomLook() {
  return {
    object: {
      shape: pick(['padlock', 'note', 'heart', 'star', 'bolt', 'play', 'plus', 'speech', 'gear', 'cloud', 'key', 'microphone', 'headphones']),
      spin: { x: rnd(-0.08, 0.08), y: rnd(-0.04, 0.04) },
      displace: { amount: rnd(0, 0.5), frequency: rnd(0.4, 3), speed: rnd(0.1, 0.35), twist: chance(0.3) ? rnd(-2, 2) : 0 },
    },
    surface: {
      pattern: pick(['fingerprint', 'topo', 'stripes', 'spots', 'cloud']),
      scale: rnd(4, 30),
      warp: rnd(0, 1.5),
      speed: rnd(-0.4, 0.4),
      width: rnd(0.2, 0.7),
      light: { x: rnd(-1, 1), y: rnd(-1, 1) },
    },
    raster: {
      cell: Math.round(rnd(4, 14)),
      shape: pick(['binary', 'code', 'hex', 'math', 'arrows', 'matrix', 'letters', 'circle', 'circle', 'square', 'diamond', 'plus', 'ring', 'vbar', 'hbar']),
      dotMax: rnd(0.6, 1.3),
      angle: chance(0.4) ? Math.round(rnd(0, 90)) : 0,
      levels: chance(0.3) ? Math.round(rnd(2, 6)) : 0,
      dither: chance(0.15),
      contrast: rnd(0.9, 2.2),
      glow: rnd(0, 0.7),
    },
    blobs: { amount: chance(0.35) ? rnd(0.3, 0.8) : 0, threshold: rnd(0.25, 0.55), blur: rnd(3, 14) },
  }
}
