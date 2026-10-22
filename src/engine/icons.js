// Soft, rounded "icon" objects built from primitives. Each result is a single
// indexed geometry with merged vertices and smooth normals, dense enough for
// the vertex displacement to bend it, and roughly unit-sized like the others.
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

// Split every triangle into 4, sharing edge midpoints so the mesh stays closed.
function subdivide(geometry, iterations) {
  let pos = Array.from(geometry.attributes.position.array)
  let idx = Array.from(geometry.index.array)
  for (let it = 0; it < iterations; it++) {
    const cache = new Map()
    const mid = (a, b) => {
      const key = a < b ? a * 4194304 + b : b * 4194304 + a
      let m = cache.get(key)
      if (m === undefined) {
        m = pos.length / 3
        pos.push((pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2)
        cache.set(key, m)
      }
      return m
    }
    const next = []
    for (let i = 0; i < idx.length; i += 3) {
      const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]]
      const ab = mid(a, b)
      const bc = mid(b, c)
      const ca = mid(c, a)
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca)
    }
    idx = next
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  out.setIndex(idx)
  return out
}

// position-only, merged, indexed — the common format for combining parts
function clean(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name)
  g.clearGroups()
  return mergeVertices(g, 1e-4)
}

function finish(parts, fit) {
  const g = mergeVertices(mergeGeometries(parts.map(clean)), 1e-4)
  g.center()
  if (fit) {
    // scale so the larger of width / height equals `fit`
    g.computeBoundingBox()
    const size = g.boundingBox.getSize(new THREE.Vector3())
    const k = fit / Math.max(size.x, size.y)
    g.scale(k, k, k)
  }
  g.computeVertexNormals()
  // simple planar UVs so the geometry has the same attributes as the built-ins
  g.computeBoundingBox()
  const { min, max } = g.boundingBox
  const p = g.attributes.position
  const uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    uv[i * 2] = (p.getX(i) - min.x) / (max.x - min.x)
    uv[i * 2 + 1] = (p.getY(i) - min.y) / (max.y - min.y)
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

function tube(points, radius, segments = 48) {
  const curve =
    points.length === 2
      ? new THREE.LineCurve3(...points)
      : new THREE.CatmullRomCurve3(points, false, 'centripetal')
  const parts = [new THREE.TubeGeometry(curve, segments, radius, 40, false)]
  // rounded end caps
  for (const end of [points[0], points[points.length - 1]]) {
    parts.push(new THREE.SphereGeometry(radius, 40, 24).translate(end.x, end.y, end.z))
  }
  return parts
}

export function padlockGeometry() {
  const w = 1.5
  const h = 1.2
  const r = 0.24
  const body = new THREE.Shape()
  body.moveTo(-w / 2 + r, -h / 2)
  body.lineTo(w / 2 - r, -h / 2)
  body.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r)
  body.lineTo(w / 2, h / 2 - r)
  body.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2)
  body.lineTo(-w / 2 + r, h / 2)
  body.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r)
  body.lineTo(-w / 2, -h / 2 + r)
  body.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2)

  // keyhole: round top with a tapered slot below
  const kr = 0.19
  const ky = 0.1
  const topHalf = 0.08
  const dy = Math.sqrt(kr * kr - topHalf * topHalf)
  const start = Math.atan2(-dy, -topHalf)
  const end = Math.atan2(-dy, topHalf)
  const key = new THREE.Path()
  key.moveTo(-0.15, -0.36)
  key.lineTo(-topHalf, ky - dy)
  key.absarc(0, ky, kr, start, end - Math.PI * 2, true)
  key.lineTo(0.15, -0.36)
  key.closePath()
  body.holes.push(key)

  const depth = 0.42
  const bevel = 0.13
  const box = new THREE.ExtrudeGeometry(body, {
    depth,
    curveSegments: 20,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 6,
  })
  box.translate(0, -0.35, -depth / 2)
  const dense = subdivide(clean(box), 2)

  // shackle: two legs sunk into the body joined by a half circle
  const sr = 0.46
  const legBottom = 0.05
  const legTop = 0.62
  const arc = []
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI - (i / 24) * Math.PI
    arc.push(new THREE.Vector3(Math.cos(a) * sr, legTop + Math.sin(a) * sr, 0))
  }
  const path = [new THREE.Vector3(-sr, legBottom, 0), ...arc, new THREE.Vector3(sr, legBottom, 0)]
  return finish([dense, ...tube(path, 0.14, 160)])
}

export function musicNoteGeometry() {
  // two beamed eighth notes (♫)
  const parts = []
  const heads = [
    { x: -0.55, y: -0.78 },
    { x: 0.5, y: -0.52 },
  ]
  const headR = 0.3
  const stemR = 0.08
  const stemTops = []
  for (const hd of heads) {
    const head = new THREE.SphereGeometry(headR, 96, 64)
    head.scale(1.32, 0.95, 0.8)
    head.rotateZ(0.38)
    head.translate(hd.x, hd.y, 0)
    parts.push(head)
    const sx = hd.x + headR * 1.05
    const top = new THREE.Vector3(sx, hd.y + 1.65, 0)
    stemTops.push(top)
    parts.push(...tube([new THREE.Vector3(sx, hd.y + 0.05, 0), top], stemR, 64))
  }
  // beam: a chunky soft bar across the stem tops
  const [a, b] = stemTops
  parts.push(...tube([a.clone().add(new THREE.Vector3(-0.02, 0, 0)), b.clone().add(new THREE.Vector3(0.02, 0, 0))], 0.13, 64))
  return finish(parts)
}

// --- more icons ------------------------------------------------------------

// Polygon with every corner rounded (radius per corner or one for all)
function roundedPoly(points, radius) {
  const shape = new THREE.Shape()
  const n = points.length
  const corner = (i) => {
    const p = points[i]
    const prev = points[(i - 1 + n) % n]
    const next = points[(i + 1) % n]
    const r0 = Array.isArray(radius) ? radius[i] : radius
    const r = Math.min(r0, p.distanceTo(prev) / 2, p.distanceTo(next) / 2)
    const a = p.clone().add(prev.clone().sub(p).normalize().multiplyScalar(r))
    const b = p.clone().add(next.clone().sub(p).normalize().multiplyScalar(r))
    return { p, a, b }
  }
  const corners = points.map((_, i) => corner(i))
  shape.moveTo(corners[n - 1].b.x, corners[n - 1].b.y)
  for (const { p, a, b } of corners) {
    shape.lineTo(a.x, a.y)
    shape.quadraticCurveTo(p.x, p.y, b.x, b.y)
  }
  return shape
}

const v2 = (x, y) => new THREE.Vector2(x, y)
const v3 = (x, y, z = 0) => new THREE.Vector3(x, y, z)

// soft extrusion: bevel eats into the outline so the silhouette stays as drawn
function extrudeIcon(shape, { depth = 0.4, bevel = 0.12, subdiv = 2 } = {}) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments: 16,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 6,
  })
  g.translate(0, 0, -depth / 2)
  return subdivide(clean(g), subdiv)
}

const ICON_SIZE = 2.2

export function heartGeometry() {
  const h = new THREE.Shape()
  h.moveTo(0, -1)
  h.bezierCurveTo(0.35, -0.6, 1.1, -0.2, 1.1, 0.35)
  h.bezierCurveTo(1.1, 0.8, 0.75, 1.05, 0.45, 1.05)
  h.bezierCurveTo(0.2, 1.05, 0.05, 0.9, 0, 0.72)
  h.bezierCurveTo(-0.05, 0.9, -0.2, 1.05, -0.45, 1.05)
  h.bezierCurveTo(-0.75, 1.05, -1.1, 0.8, -1.1, 0.35)
  h.bezierCurveTo(-1.1, -0.2, -0.35, -0.6, 0, -1)
  return finish([extrudeIcon(h, { depth: 0.45, bevel: 0.16 })], ICON_SIZE)
}

export function starGeometry() {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? 0.48 : 1.15
    pts.push(v2(Math.cos(a) * r, Math.sin(a) * r))
  }
  return finish([extrudeIcon(roundedPoly(pts, 0.14), { depth: 0.35, bevel: 0.12 })], ICON_SIZE)
}

export function boltGeometry() {
  const pts = [v2(0.3, 1.2), v2(-0.62, -0.08), v2(-0.04, -0.08), v2(-0.3, -1.2), v2(0.64, 0.18), v2(0.06, 0.18)]
  return finish([extrudeIcon(roundedPoly(pts, 0.09), { depth: 0.35, bevel: 0.08 })], ICON_SIZE)
}

export function playGeometry() {
  const pts = [v2(-0.75, 1), v2(1, 0), v2(-0.75, -1)]
  return finish([extrudeIcon(roundedPoly(pts, 0.32), { depth: 0.45, bevel: 0.16 })], ICON_SIZE * 0.9)
}

export function plusGeometry() {
  const a = 0.32
  const l = 1
  const pts = [
    v2(-a, l), v2(a, l), v2(a, a), v2(l, a), v2(l, -a), v2(a, -a),
    v2(a, -l), v2(-a, -l), v2(-a, -a), v2(-l, -a), v2(-l, a), v2(-a, a),
  ]
  const r = pts.map((_, i) => (i % 3 === 2 ? 0.06 : 0.22))
  return finish([extrudeIcon(roundedPoly(pts, r), { depth: 0.45, bevel: 0.14 })], ICON_SIZE * 0.9)
}

export function speechGeometry() {
  const pts = [v2(-1.1, 0.75), v2(1.1, 0.75), v2(1.1, -0.55), v2(-0.15, -0.55), v2(-0.75, -1.1), v2(-0.6, -0.55), v2(-1.1, -0.55)]
  const r = [0.4, 0.4, 0.4, 0.1, 0.08, 0.1, 0.4]
  return finish([extrudeIcon(roundedPoly(pts, r), { depth: 0.4, bevel: 0.14 })], ICON_SIZE)
}

export function gearGeometry() {
  const pts = []
  const teeth = 9
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    const step = (Math.PI * 2) / teeth
    for (const [da, r] of [[-0.3, 0.78], [-0.17, 1.05], [0.17, 1.05], [0.3, 0.78]]) {
      pts.push(v2(Math.cos(a + da * step * 1.6) * r, Math.sin(a + da * step * 1.6) * r))
    }
  }
  const gear = roundedPoly(pts, 0.05)
  const hole = new THREE.Path()
  hole.absarc(0, 0, 0.34, 0, Math.PI * 2, true)
  gear.holes.push(hole)
  return finish([extrudeIcon(gear, { depth: 0.35, bevel: 0.08, subdiv: 1 })], ICON_SIZE)
}

export function cloudGeometry() {
  const puffs = [
    [-0.7, -0.2, 0.5],
    [-0.25, 0.2, 0.62],
    [0.35, 0.3, 0.72],
    [0.85, -0.1, 0.5],
    [0.3, -0.35, 0.5],
    [-0.25, -0.38, 0.48],
  ]
  const parts = puffs.map(([x, y, r]) => new THREE.SphereGeometry(r, 72, 48).scale(1, 1, 0.75).translate(x, y, 0))
  return finish(parts, ICON_SIZE)
}

export function keyGeometry() {
  const parts = [new THREE.TorusGeometry(0.42, 0.15, 40, 96).translate(-0.72, 0, 0)]
  parts.push(...tube([v3(-0.3, 0), v3(1.15, 0)], 0.14, 48))
  parts.push(...tube([v3(0.72, 0), v3(0.72, -0.36)], 0.11, 16))
  parts.push(...tube([v3(1.02, 0), v3(1.02, -0.3)], 0.11, 16))
  return finish(parts, ICON_SIZE)
}

export function microphoneGeometry() {
  const parts = [new THREE.CapsuleGeometry(0.4, 0.62, 24, 64).translate(0, 0.42, 0)]
  // U-shaped holder around the bottom of the head
  const arc = []
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i / 24) * Math.PI
    arc.push(v3(Math.cos(a) * 0.62, 0.32 + Math.sin(a) * 0.62))
  }
  parts.push(...tube([v3(-0.62, 0.62), ...arc, v3(0.62, 0.62)], 0.08, 96))
  parts.push(...tube([v3(0, -0.3), v3(0, -0.85)], 0.08, 24))
  parts.push(...tube([v3(-0.42, -0.85), v3(0.42, -0.85)], 0.1, 24))
  return finish(parts, ICON_SIZE)
}

export function headphonesGeometry() {
  const parts = []
  const band = []
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI * 0.08 + (i / 32) * Math.PI * 0.84
    band.push(v3(Math.cos(a) * 0.95, -0.05 + Math.sin(a) * 0.95))
  }
  parts.push(...tube(band, 0.1, 120))
  for (const side of [-1, 1]) {
    const end = band[side < 0 ? band.length - 1 : 0]
    parts.push(...tube([end, v3(side * 0.95, -0.35)], 0.1, 16))
    parts.push(new THREE.SphereGeometry(0.38, 64, 48).scale(0.75, 1.15, 0.9).translate(side * 0.95, -0.55, 0))
  }
  return finish(parts, ICON_SIZE)
}
