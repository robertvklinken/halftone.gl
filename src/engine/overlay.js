// Typography + tracking boxes drawn on a 2D canvas, then composited by the
// raster shader (so exports include it).

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const pad2 = (n) => String(n).padStart(2, '0')

function timecode(t) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  const cs = Math.floor((t % 1) * 100)
  return `${pad2(m)}:${pad2(s)}.${pad2(cs)}`
}

function fillTokens(str, state) {
  return str
    .replaceAll('{t}', timecode(state.time))
    .replaceAll('{f}', String(state.frame).padStart(6, '0'))
    .replaceAll('{fps}', String(Math.round(state.fps)))
    .replaceAll('{hex}', Math.floor(hash(Math.floor(state.time * 2)) * 0xffffff).toString(16).toUpperCase().padStart(6, '0'))
}

function setSpacing(ctx, em, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${em * px}px`
}

function lines(ctx, text, x, y, lh, align = 'left') {
  ctx.textAlign = align
  text.split('\n').forEach((line, i) => ctx.fillText(line, x, y + i * lh))
}

export function drawOverlay(ctx, w, h, dpr, o, state) {
  ctx.clearRect(0, 0, w, h)
  if (!o.show) return

  const s = dpr * o.textScale
  const m = 24 * dpr
  const font = `"${o.font}", monospace`
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#fff'
  ctx.textBaseline = 'top'

  // header
  const titlePx = 56 * s
  ctx.font = `700 ${titlePx}px ${font}`
  setSpacing(ctx, 0.04, titlePx)
  lines(ctx, o.title, m, m, titlePx)

  const metaPx = 11 * s
  ctx.font = `400 ${metaPx}px ${font}`
  setSpacing(ctx, 0.06, metaPx)
  const titleH = o.title ? titlePx * o.title.split('\n').length + 8 * s : 0
  // the running timecode lives bottom right only, so strip {t} up here
  // (older saved texts still contain "TC {t}")
  const meta = o.meta
    .split('\n')
    .map((line) => line.replace(/(TC\s*)?\{t\}\s*/g, '').trimEnd())
    .filter((line, i, all) => line || all.length === 1)
    .join('\n')
  lines(ctx, fillTokens(meta, state), m, m + titleH, metaPx * 1.25)

  // bottom row: asterisk on the left, timecode on the right, same baseline
  ctx.font = `400 ${metaPx}px ${font}`
  setSpacing(ctx, 0.06, metaPx)
  ctx.textBaseline = 'bottom'
  if (o.symbol) {
    const size = metaPx * 1.6
    const bottom = h - m - metaPx * 0.2
    drawAsterisk(ctx, m + size / 2, bottom - size / 2, size, Math.max(dpr, metaPx * 0.14))
  }
  ctx.textAlign = 'right'
  ctx.fillText(`${timecode(state.time)}  F${String(state.frame).padStart(6, '0')}`, w - m, h - m)
  ctx.textBaseline = 'top'

  if (o.boxes > 0) drawBoxes(ctx, w, h, dpr, o, state, metaPx, font)
}

function drawAsterisk(ctx, cx, cy, size, weight) {
  const r = size / 2
  ctx.save()
  ctx.lineWidth = weight
  ctx.lineCap = 'butt'
  ctx.beginPath()
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 4
    ctx.moveTo(cx - Math.cos(a) * r, cy - Math.sin(a) * r)
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  }
  ctx.stroke()
  ctx.restore()
}

function drawBoxes(ctx, w, h, dpr, o, state, metaPx, font) {
  const snap = Math.max(1, state.cell * dpr)
  const q = (v) => Math.round(v / snap) * snap + 0.5
  ctx.lineWidth = Math.max(1, 1.5 * dpr)
  ctx.font = `400 ${metaPx * 0.9}px ${font}`

  for (let i = 0; i < o.boxes; i++) {
    // each box holds a position for a while, drifts, then jumps
    const phase = state.time * o.boxSpeed + hash(i + 0.5) * 7
    const epoch = Math.floor(phase)
    const local = phase - epoch
    const r = (k) => hash(i * 17.13 + epoch * 3.71 + k)

    const bw = (0.05 + r(1) * 0.16) * w
    const bh = (0.12 + r(2) * 0.38) * h
    const x = (0.12 + r(3) * 0.76) * w - bw / 2 + Math.sin(local * 3 + i) * snap * 2
    const y = (0.16 + r(4) * 0.68) * h - bh / 2 + Math.cos(local * 2 + i) * snap * 2

    // flicker in at the start of each epoch
    if (local < 0.06 && hash(epoch + i * 9.1) > 0.5) continue

    ctx.strokeRect(q(x), q(y), q(bw), q(bh))
    if (o.boxLabels) {
      ctx.textAlign = 'left'
      ctx.textBaseline = 'bottom'
      const conf = (0.62 + r(5) * 0.37).toFixed(2)
      ctx.fillText(`ID_${pad2(i)} ${conf}`, q(x), q(y) - 4 * dpr)
      ctx.textBaseline = 'top'
    }
  }
}
