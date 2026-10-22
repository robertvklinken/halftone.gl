import { useEffect, useRef, useState } from 'react'
import { DialRoot, DialStore, useDialKitController } from 'dialkit'
import 'dialkit/styles.css'
import { Engine } from './engine/Engine'
import { imageFromFile, storedImage } from './engine/image'
import { LOOKS, randomLook } from './looks'

const config = {
  randomize: { type: 'action', label: 'Randomize' },
  palette: {
    type: 'select',
    options: [
      { value: 'dark', label: 'Dark' },
      { value: 'print', label: 'Print' },
      { value: 'blueprint', label: 'Blueprint' },
    ],
    default: 'dark',
  },
  source: {
    type: 'select',
    options: [
      { value: 'object', label: '3D object' },
      { value: 'image', label: 'Image' },
    ],
    default: 'object',
  },
  looks: {
    _collapsed: true,
    signal: { type: 'action', label: 'Signal (default)' },
    scanner: { type: 'action', label: 'Scanner' },
    topo: { type: 'action', label: 'Topo' },
    halftone: { type: 'action', label: 'Halftone' },
    code: { type: 'action', label: 'Code' },
    tiles: { type: 'action', label: 'Tiles' },
    frost: { type: 'action', label: 'Frost (image)' },
    shadow: { type: 'action', label: 'Shadow tiles (image)' },
    window: { type: 'action', label: 'Window (image)' },
    liquid: { type: 'action', label: 'Liquid (image)' },
  },

  // image mode: where the raster goes on the photo and how the photo looks there
  image: {
    _collapsed: true,
    load: { type: 'action', label: 'Load image…' },
    target: {
      type: 'select',
      options: [
        { value: 'dark', label: 'Dark areas' },
        { value: 'light', label: 'Light areas' },
        { value: 'all', label: 'Everywhere' },
      ],
      default: 'dark',
    },
    // brightness cut-off
    level: [0.35, 0, 1],
    softness: [0.08, 0, 0.5],
    spread: [8, 0, 40],
    drift: [0.3, 0, 1],
    tone: {
      type: 'select',
      options: [
        { value: 'image', label: 'Follow image' },
        { value: 'inverted', label: 'Inverted' },
        { value: 'even', label: 'Even' },
      ],
      default: 'inverted',
    },
    frost: [0.7, 0, 1],
    blur: [14, 0, 60],
    shade: [0.08, -1, 1],
    marks: {
      type: 'select',
      options: [
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
        { value: 'tinted', label: 'Tinted' },
      ],
      default: 'light',
    },
    opacity: [0.85, 0, 1],
    color: {
      type: 'select',
      options: [
        { value: 'original', label: 'Original' },
        { value: 'mono', label: 'Mono' },
        { value: 'duotone', label: 'Duotone (palette)' },
      ],
      default: 'original',
    },
    zoom: [1, 1, 3],
    // crop the photo to a centred circle; the raster keeps covering the canvas
    shape: {
      type: 'select',
      options: [
        { value: 'circle', label: 'Circle' },
        { value: 'full', label: 'Full frame' },
      ],
      default: 'circle',
    },
    // circle diameter, as a fraction of the canvas
    size: [0.8, 0.2, 1],
    // off: marks are clipped to the circle; on: they also follow the photo's corners outside it
    marksOutside: false,
  },

  // image mode: reshape the photo into flowing, abstract shapes first
  abstract: {
    style: {
      type: 'select',
      options: [
        { value: 'none', label: 'Off' },
        { value: 'liquid', label: 'Liquid' },
        { value: 'vortex', label: 'Vortex' },
        { value: 'smear', label: 'Smear' },
      ],
      default: 'none',
    },
    amount: [0.7, 0, 2],
    scale: [0.8, 0.2, 5],
    speed: [0.08, 0, 1],
    softness: [0.55, 0, 1],
    // light and dark swirls along the flow
    swirl: [0.35, 0, 1],
  },

  object: {
    shape: {
      type: 'select',
      options: [
        { value: 'padlock', label: 'Padlock' },
        { value: 'note', label: 'Music note' },
        { value: 'heart', label: 'Heart' },
        { value: 'star', label: 'Star' },
        { value: 'bolt', label: 'Lightning' },
        { value: 'play', label: 'Play' },
        { value: 'plus', label: 'Plus' },
        { value: 'speech', label: 'Speech bubble' },
        { value: 'gear', label: 'Gear' },
        { value: 'cloud', label: 'Cloud' },
        { value: 'key', label: 'Key' },
        { value: 'microphone', label: 'Microphone' },
        { value: 'headphones', label: 'Headphones' },
      ],
      default: 'padlock',
    },
    scale: [1, 0.2, 3],
    spin: { type: 'pad', x: [0.04, -1, 1, 0.01], y: [0.02, -1, 1, 0.01], labels: { x: 'Spin Y', y: 'Spin X' } },
    displace: {
      amount: [0.15, 0, 1.5],
      frequency: [1.2, 0.1, 6],
      speed: [0.3, 0, 3],
      twist: [0, -4, 4],
    },
  },

  surface: {
    pattern: { type: 'select', options: ['fingerprint', 'topo', 'stripes', 'spots', 'cloud', 'none'], default: 'fingerprint' },
    scale: [11, 1, 60],
    warp: [0.7, 0, 3],
    speed: [0.3, -4, 4],
    width: [0.5, 0.02, 1],
    mix: [0.85, 0, 1],
    light: { type: 'pad', x: [-0.35, -1, 1, 0.01], y: [0.55, -1, 1, 0.01] },
    lightFollowsMouse: false,
    ambient: [0.04, 0, 1],
    diffuse: [0.95, 0, 2],
    specular: [0.35, 0, 2],
    rim: [0.7, 0, 2],
    rimPower: [2.5, 0.5, 8],
    gain: [1.1, 0, 3],
  },

  raster: {
    cell: [7, 2, 40, 1],
    shape: {
      type: 'select',
      options: [
        { value: 'binary', label: 'Binary 0 1' },
        { value: 'code', label: 'Code symbols' },
        { value: 'hex', label: 'Hex' },
        { value: 'math', label: 'Math' },
        { value: 'arrows', label: 'Arrows' },
        { value: 'matrix', label: 'Matrix' },
        { value: 'letters', label: 'Letters' },
        { value: 'circle', label: 'Dot' },
        { value: 'square', label: 'Square' },
        { value: 'diamond', label: 'Diamond' },
        { value: 'plus', label: 'Plus' },
        { value: 'ring', label: 'Ring' },
        { value: 'vbar', label: 'Vertical bar' },
        { value: 'hbar', label: 'Horizontal bar' },
        // older saved versions use this: characters from the Glyphs folder's set
        { value: 'glyph', label: 'Glyph (legacy set)' },
      ],
      default: 'binary',
    },
    dotMin: [0, 0, 1],
    dotMax: [0.9, 0, 1.6],
    levels: [0, 0, 12, 1],
    dither: false,
    contrast: [1.5, 0, 4],
    brightness: [0, -1, 1],
    gamma: [1, 0.2, 3],
    threshold: [0.05, 0, 1],
    baseGrid: [0.16, 0, 1],
    baseSize: [0.1, 0, 0.5],
    glow: [0.25, 0, 2],
    flicker: [0.15, 0, 1],
  },

  glyphs: {
    _collapsed: true,
    set: {
      type: 'select',
      options: [
        { value: 'code', label: 'Code symbols' },
        { value: 'binary', label: 'Binary 0 1' },
        { value: 'hex', label: 'Hex' },
        { value: 'letters', label: 'Letters' },
      ],
      default: 'code',
    },
    font: {
      type: 'select',
      options: ['Space Mono', 'IBM Plex Mono', 'Share Tech Mono', 'VT323', 'Silkscreen'],
      default: 'Space Mono',
    },
    weight: { type: 'select', options: ['regular', 'bold'], default: 'regular' },
    rate: [1.5, 0, 12],
    jitter: [0.3, 0, 1],
    strays: [0, 0, 1],
  },

  tiles: {
    _collapsed: true,
    mode: {
      type: 'select',
      options: [
        { value: 'off', label: 'Off' },
        { value: 'behind', label: 'Square behind' },
        { value: 'knockout', label: 'Knocked out' },
      ],
      default: 'off',
    },
    amount: [0.45, 0, 1],
    size: [1, 0.3, 1],
    grain: [0.5, 0, 1],
    coverage: [0.7, 0, 1],
  },

  blobs: {
    _collapsed: true,
    amount: [0, 0, 1],
    threshold: [0.4, 0, 1],
    softness: [0.08, 0, 0.5],
    blur: [8, 0, 30],
    grain: [0.5, 0, 1],
  },

  overlay: {
    _collapsed: true,
    show: true,
    font: {
      type: 'select',
      options: ['Space Mono', 'Share Tech Mono', 'IBM Plex Mono', 'VT323', 'Silkscreen', 'Major Mono Display'],
      default: 'Space Mono',
    },
    textScale: [1, 0.5, 2.5],
    title: { type: 'text', default: '', placeholder: 'Title' },
    meta: { type: 'text', default: 'OBJ 001  /  3D RASTER STUDY\nSIGNAL, NOISE & SURFACE\nID {hex}' },
    symbol: true,
    boxes: [0, 0, 16, 1],
    boxSpeed: [0.35, 0, 3],
    boxLabels: true,
    blend: { type: 'select', options: ['normal', 'difference'], default: 'difference' },
    resetText: { type: 'action', label: 'Reset text' },
  },

  output: {
    timeScale: [1, 0, 3],
    png: { type: 'action', label: 'Save PNG' },
    record: { type: 'action', label: 'Record 6s video' },
    resetAll: { type: 'action', label: 'Reset everything' },
  },
}

// Default values of one folder of the config, for partial resets via setValues
function folderDefaults(folder) {
  const out = {}
  for (const [key, def] of Object.entries(folder)) {
    if (key.startsWith('_')) continue
    if (Array.isArray(def)) out[key] = def[0]
    else if (def && typeof def === 'object') {
      if (def.type === 'action') continue
      if (def.type === 'pad') out[key] = { x: def.x[0], y: def.y[0] }
      else if ('default' in def) out[key] = def.default
      else if (!def.type) out[key] = folderDefaults(def)
    } else out[key] = def
  }
  return out
}

// kept from the old name so versions saved in the browser keep loading
const PANEL_ID = 'raster-lab'

function withoutActions(values) {
  const out = {}
  for (const [k, v] of Object.entries(values)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (v.type === 'action') continue
      out[k] = 'x' in v && 'y' in v ? v : withoutActions(v)
    } else out[k] = v
  }
  return out
}

// Edits go into whichever saved version is selected. Before randomizing, step
// off it (keeping what's on screen) so saved versions are never overwritten.
function randomize(d) {
  if (DialStore.getActivePresetId(PANEL_ID)) {
    const current = withoutActions(d.getValues())
    DialStore.clearActivePreset(PANEL_ID)
    d.setValues(current)
  }
  d.setValues(randomLook(d.getValues().source))
}

const imageFile = (list) => [...(list ?? [])].find((f) => f.type.startsWith('image/'))

export default function App() {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const dialRef = useRef(null)
  const fileRef = useRef(null)
  const [recording, setRecording] = useState(false)

  const dial = useDialKitController('halftone.gl', config, {
    id: PANEL_ID,
    persist: true,
    onAction(path) {
      const d = dialRef.current
      const engine = engineRef.current
      if (path === 'randomize') randomize(d)
      else if (path.startsWith('looks.')) {
        // looks change the shader, never the palette; object looks keep the
        // current source, so they also work on an image
        const { palette, source } = d.getValues()
        const look = LOOKS[path.slice(6)] ?? {}
        d.resetValues()
        d.setValues(look)
        d.setValues({ palette, source: look.source ?? source })
      } else if (path === 'image.load') fileRef.current?.click()
      else if (path === 'overlay.resetText') d?.setValues({ overlay: folderDefaults(config.overlay) })
      else if (path === 'output.resetAll') d?.resetValues()
      else if (path === 'output.png') engine?.exportPNG()
      else if (path === 'output.record') engine?.record(6)
    },
  })
  dialRef.current = dial

  useEffect(() => {
    const engine = new Engine(canvasRef.current)
    engine.onRecordChange = setRecording
    engineRef.current = engine
    if (import.meta.env.DEV) window.__engine = engine
    engine.setParams(dialRef.current.getValues())
    storedImage().then((img) => img && engine.setImage(img))
    return () => engine.dispose()
  }, [])

  const loadImage = async (file) => {
    if (!file) return
    try {
      engineRef.current?.setImage(await imageFromFile(file))
      dialRef.current?.setValues({ source: 'image' })
    } catch (err) {
      console.error(err)
    }
  }

  // drop an image anywhere, or paste one
  useEffect(() => {
    const onDragOver = (e) => e.preventDefault()
    const onDrop = (e) => {
      e.preventDefault()
      loadImage(imageFile(e.dataTransfer?.files))
    }
    const onPaste = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable]')) return
      loadImage(imageFile(e.clipboardData?.files))
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
      window.removeEventListener('paste', onPaste)
    }
  }, [])

  useEffect(() => {
    engineRef.current?.setParams(dial.values)
  }, [dial.values])

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, [contenteditable], .dialkit-root')) return
      if (e.key === 's') engineRef.current?.exportPNG()
      if (e.key === 'r') randomize(dialRef.current)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const imageMode = dial.values.source === 'image'

  // index.css hides the folders that do nothing for this source
  useEffect(() => {
    document.body.dataset.source = dial.values.source
  }, [dial.values.source])

  return (
    <>
      <div className={imageMode ? 'stage image' : 'stage'}>
        <canvas ref={canvasRef} />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          loadImage(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {recording && <div className="rec">● REC</div>}
      <div className="hint">
        {imageMode ? 'DROP OR PASTE AN IMAGE' : 'DRAG TO ORBIT · SCROLL TO ZOOM'} · R RANDOMIZE · S SAVE PNG
      </div>
      <DialRoot position="top-right" theme="dark" defaultOpen productionEnabled />
    </>
  )
}
