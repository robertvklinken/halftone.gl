import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { sceneVert, sceneFrag, quadVert, postFrag } from './shaders'
import { drawOverlay } from './overlay'
import * as icons from './icons'

const GEOMETRIES = {
  padlock: icons.padlockGeometry,
  note: icons.musicNoteGeometry,
  heart: icons.heartGeometry,
  star: icons.starGeometry,
  bolt: icons.boltGeometry,
  play: icons.playGeometry,
  plus: icons.plusGeometry,
  speech: icons.speechGeometry,
  gear: icons.gearGeometry,
  cloud: icons.cloudGeometry,
  key: icons.keyGeometry,
  microphone: icons.microphoneGeometry,
  headphones: icons.headphonesGeometry,
}

const PATTERNS = ['fingerprint', 'topo', 'stripes', 'spots', 'cloud', 'none']
const SHAPES = ['circle', 'square', 'diamond', 'plus', 'ring', 'vbar', 'hbar', 'glyph']

// Ramp sets are ordered sparse -> dense and picked by brightness; random sets
// pick any character and let brightness drive size and visibility.
const GLYPH_SETS = {
  code: { chars: '.:0-=1+*0/<1>(0){1}[0];1!?0#$1%&', random: false },
  binary: { chars: '01', random: true },
  hex: { chars: '0123456789ABCDEF', random: true },
  letters: { chars: '.*!?%=+>$#HCASER', random: false },
  math: { chars: '·-+=±×÷≈≠<>√∑∏∞', random: false },
  arrows: { chars: '←↑→↓↖↗↘↙↔↕', random: true },
  matrix: { chars: 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄ0123456789', random: true },
}

// which character set a Raster shape draws (null for the plain dot shapes)
function glyphSetFor(p) {
  if (p.raster.shape === 'glyph') return p.glyphs.set in GLYPH_SETS ? p.glyphs.set : 'code'
  return p.raster.shape in GLYPH_SETS ? p.raster.shape : null
}
const GLYPH_TILE = 64

// ink / paper in sRGB 0..1 (the raster pass outputs these directly)
const PALETTES = {
  dark: { ink: [0.95, 0.95, 0.95], paper: [0.02, 0.02, 0.02] },
  print: { ink: [0.08, 0.067, 0.06], paper: [0.925, 0.9, 0.855] },
  blueprint: { ink: [1, 1, 1], paper: [0, 0.251, 1] }, // #0040FF
}
const GRAIN = 0.06
const VIGNETTE = 0.2

function quad(material) {
  const scene = new THREE.Scene()
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))
  return scene
}

export class Engine {
  constructor(canvas) {
    this.canvas = canvas
    this.params = null
    this.time = 0
    this.frame = 0
    this.fps = 60
    this.spin = new THREE.Vector2()
    this.mouse = new THREE.Vector2()
    this.shapeKey = null
    this.onRecordChange = null

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true })
    renderer.setClearColor(0x000000, 1)
    renderer.autoClear = true
    this.renderer = renderer
    this.dpr = Math.min(window.devicePixelRatio, 2)

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100)
    this.camera.position.set(0, 0, 6.5)
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.minDistance = 2
    this.controls.maxDistance = 20

    this.scene = new THREE.Scene()
    this.mesh = null
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }
    this.sceneRT = new THREE.WebGLRenderTarget(1, 1, { ...rtOpts, depthBuffer: true })

    this.glyphCanvas = document.createElement('canvas')
    this.glyphTex = new THREE.CanvasTexture(this.glyphCanvas)
    this.glyphTex.minFilter = THREE.LinearMipmapLinearFilter
    this.glyphKey = ''

    this.u = {
      uTime: { value: 0 },
      uDisp: { value: 0 },
      uDispFreq: { value: 1 },
      uDispSpeed: { value: 0 },
      uTwist: { value: 0 },
      uLight: { value: new THREE.Vector3(0, 1, 1) },
      uAmbient: { value: 0 },
      uDiffuse: { value: 1 },
      uSpec: { value: 0 },
      uRim: { value: 0 },
      uRimPow: { value: 2 },
      uGain: { value: 1 },
      uPattern: { value: 0 },
      uPatScale: { value: 1 },
      uPatWarp: { value: 0 },
      uPatSpeed: { value: 0 },
      uPatWidth: { value: 0.5 },
      uPatMix: { value: 0 },
      uSeed: { value: 0 },
    }

    this.overlayCanvas = document.createElement('canvas')
    this.overlayCtx = this.overlayCanvas.getContext('2d')
    this.overlayTex = new THREE.CanvasTexture(this.overlayCanvas)
    this.overlayTex.generateMipmaps = false
    this.overlayTex.minFilter = THREE.LinearFilter

    const f = (value) => ({ value })
    this.postMat = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: postFrag,
      uniforms: {
        tSrc: f(this.sceneRT.texture),
        tOverlay: f(this.overlayTex),
        uRes: f(new THREE.Vector2(1, 1)),
        uDpr: f(this.dpr),
        uTime: f(0),
        uCell: f(8),
        uShape: f(0),
        uDotMin: f(0),
        uDotMax: f(1),
        uAngle: f(0),
        uLevels: f(0),
        uDither: f(0),
        uContrast: f(1),
        uBright: f(0),
        uGamma: f(1),
        uThresh: f(0),
        uBase: f(0),
        uBaseSize: f(0.1),
        uGlow: f(0),
        uFlicker: f(0),
        tGlyphs: f(this.glyphTex),
        uGlyphCount: f(1),
        uGlyphRandom: f(0),
        uGlyphRate: f(1),
        uGlyphJitter: f(0),
        uTileMode: f(0),
        uTileAmt: f(0.45),
        uTileSize: f(0.9),
        uTileGrain: f(0),
        uTileCover: f(1),
        uGlyphStray: f(0),
        uBlobAmt: f(0),
        uBlobThr: f(0.5),
        uBlobSoft: f(0.1),
        uBlobBlur: f(4),
        uBlobGrain: f(0),
        uGrain: f(GRAIN),
        uVignette: f(VIGNETTE),
        uOverlayMode: f(0),
        uInk: f(new THREE.Vector3(1, 1, 1)),
        uPaper: f(new THREE.Vector3(0, 0, 0)),
      },
      depthTest: false,
      depthWrite: false,
    })
    this.postScene = quad(this.postMat)

    this.onPointer = (e) => {
      const r = canvas.getBoundingClientRect()
      this.mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
    }
    window.addEventListener('pointermove', this.onPointer)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(canvas)
    this.resize()

    this.clock = new THREE.Clock()
    renderer.setAnimationLoop(() => this.tick())
  }

  resize() {
    const w = Math.max(1, this.canvas.clientWidth)
    const h = Math.max(1, this.canvas.clientHeight)
    const pw = Math.floor(w * this.dpr)
    const ph = Math.floor(h * this.dpr)
    this.renderer.setPixelRatio(this.dpr)
    this.renderer.setSize(w, h, false)
    this.sceneRT.setSize(pw, ph)
    this.overlayCanvas.width = pw
    this.overlayCanvas.height = ph
    this.postMat.uniforms.uRes.value.set(pw, ph)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  setParams(p) {
    this.params = p
    if (p.object.shape !== this.shapeKey) this.rebuild()
    const set = glyphSetFor(p)
    const glyphKey = `${set}|${p.glyphs.font}|${p.glyphs.weight}`
    if (set && glyphKey !== this.glyphKey) {
      this.glyphKey = glyphKey
      this.drawGlyphs()
      // redraw once the webfont has actually loaded
      document.fonts.load(`${p.glyphs.weight === 'bold' ? 700 : 400} 48px "${p.glyphs.font}"`).then(() => this.glyphKey === glyphKey && this.drawGlyphs())
    }
  }

  drawGlyphs() {
    const { font, weight } = this.params.glyphs
    const { chars } = GLYPH_SETS[glyphSetFor(this.params)]
    const c = this.glyphCanvas
    c.width = chars.length * GLYPH_TILE
    c.height = GLYPH_TILE
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#fff'
    ctx.font = `${weight === 'bold' ? 700 : 400} ${GLYPH_TILE * 0.9}px "${font}", monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ;[...chars].forEach((ch, i) => ctx.fillText(ch, (i + 0.5) * GLYPH_TILE, GLYPH_TILE * 0.54))
    // canvas size changes need a fresh GPU texture
    this.glyphTex.dispose()
    this.glyphTex.needsUpdate = true
  }

  rebuild() {
    const { shape } = this.params.object
    this.geometry?.dispose()
    this.geometry = (GEOMETRIES[shape] ?? GEOMETRIES.padlock)()
    this.shapeKey = shape
    if (!this.mesh) {
      const material = new THREE.ShaderMaterial({
        vertexShader: sceneVert,
        fragmentShader: sceneFrag,
        uniforms: this.u,
        side: THREE.DoubleSide,
      })
      this.mesh = new THREE.Mesh(this.geometry, material)
      this.mesh.frustumCulled = false
      this.scene.add(this.mesh)
    }
    this.mesh.geometry = this.geometry
  }

  tick() {
    const p = this.params
    if (!p) return
    const dt = Math.min(this.clock.getDelta(), 0.1)
    this.fps += (1 / Math.max(dt, 1e-4) - this.fps) * 0.05
    this.time += dt * p.output.timeScale
    this.frame++
    const t = this.time
    const { object: o, surface: s, raster: r, blobs: b, overlay: ov } = p

    // the object always sits in the center and just turns
    this.spin.x += o.spin.x * dt * 2 * p.output.timeScale
    this.spin.y += o.spin.y * dt * 2 * p.output.timeScale
    this.mesh.scale.setScalar(o.scale)
    this.mesh.rotation.set(this.spin.y, this.spin.x, 0)
    this.controls.update()

    const u = this.u
    u.uTime.value = t
    u.uDisp.value = o.displace.amount
    u.uDispFreq.value = o.displace.frequency
    u.uDispSpeed.value = o.displace.speed
    u.uTwist.value = o.displace.twist
    const lx = s.lightFollowsMouse ? this.mouse.x : s.light.x
    const ly = s.lightFollowsMouse ? this.mouse.y : s.light.y
    u.uLight.value.set(lx * 2, ly * 2, 1).applyQuaternion(this.camera.quaternion)
    u.uAmbient.value = s.ambient
    u.uDiffuse.value = s.diffuse
    u.uSpec.value = s.specular
    u.uRim.value = s.rim
    u.uRimPow.value = s.rimPower
    u.uGain.value = s.gain
    u.uPattern.value = Math.max(0, PATTERNS.indexOf(s.pattern))
    u.uPatScale.value = s.scale
    u.uPatWarp.value = s.warp
    u.uPatSpeed.value = s.speed
    u.uPatWidth.value = s.width
    u.uPatMix.value = s.mix

    const R = this.renderer
    R.setRenderTarget(this.sceneRT)
    R.render(this.scene, this.camera)

    drawOverlay(this.overlayCtx, this.overlayCanvas.width, this.overlayCanvas.height, this.dpr, ov, {
      time: t,
      frame: this.frame,
      fps: this.fps,
      cell: r.cell,
    })
    this.overlayTex.needsUpdate = true

    const pu = this.postMat.uniforms
    pu.uTime.value = t
    pu.uCell.value = r.cell
    pu.uShape.value = glyphSetFor(p) ? 7 : Math.max(0, SHAPES.indexOf(r.shape))
    pu.uDotMin.value = r.dotMin
    pu.uDotMax.value = r.dotMax
    pu.uAngle.value = (r.angle * Math.PI) / 180
    pu.uLevels.value = r.levels
    pu.uDither.value = r.dither ? 1 : 0
    pu.uContrast.value = r.contrast
    pu.uBright.value = r.brightness
    pu.uGamma.value = r.gamma
    pu.uThresh.value = r.threshold
    pu.uBase.value = r.baseGrid
    pu.uBaseSize.value = r.baseSize
    pu.uGlow.value = r.glow
    pu.uFlicker.value = r.flicker
    const glyphSet = GLYPH_SETS[glyphSetFor(p) ?? 'code']
    pu.uGlyphCount.value = glyphSet.chars.length
    pu.uGlyphRandom.value = glyphSet.random ? 1 : 0
    pu.uGlyphRate.value = p.glyphs.rate
    pu.uGlyphJitter.value = p.glyphs.jitter
    pu.uTileMode.value = ['off', 'behind', 'knockout'].indexOf(p.tiles.mode)
    pu.uTileAmt.value = p.tiles.amount
    pu.uTileSize.value = p.tiles.size
    pu.uTileGrain.value = p.tiles.grain
    pu.uTileCover.value = p.tiles.coverage
    pu.uGlyphStray.value = p.glyphs.strays
    pu.uBlobAmt.value = b.amount
    pu.uBlobThr.value = b.threshold
    pu.uBlobSoft.value = b.softness
    pu.uBlobBlur.value = b.blur
    pu.uBlobGrain.value = b.grain
    pu.uOverlayMode.value = ov.blend === 'difference' ? 1 : 0
    const palette = PALETTES[p.palette] ?? PALETTES.dark
    pu.uInk.value.fromArray(palette.ink)
    pu.uPaper.value.fromArray(palette.paper)
    R.setRenderTarget(null)
    R.render(this.postScene, this.orthoCam)
  }

  exportPNG() {
    this.canvas.toBlob((blob) => download(blob, `halftone-${Date.now()}.png`), 'image/png')
  }

  record(seconds = 6) {
    if (this.recorder) return
    const mimeType = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find((m) =>
      MediaRecorder.isTypeSupported(m),
    )
    const stream = this.canvas.captureStream(60)
    const rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 20_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    rec.onstop = () => {
      const ext = mimeType?.startsWith('video/mp4') ? 'mp4' : 'webm'
      download(new Blob(chunks, { type: mimeType }), `halftone-${Date.now()}.${ext}`)
      this.recorder = null
      this.onRecordChange?.(false)
    }
    this.recorder = rec
    rec.start()
    this.onRecordChange?.(true)
    setTimeout(() => rec.state !== 'inactive' && rec.stop(), seconds * 1000)
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.resizeObserver.disconnect()
    window.removeEventListener('pointermove', this.onPointer)
    this.controls.dispose()
    this.recorder?.stop()
    this.geometry?.dispose()
    this.mesh?.material.dispose()
    this.sceneRT.dispose()
    this.postMat.dispose()
    this.overlayTex.dispose()
    this.glyphTex.dispose()
    this.renderer.dispose()
  }
}

function download(blob, name) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}
