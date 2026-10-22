// 3D simplex noise (Ashima Arts / Stefan Gustavson, MIT)
const noise = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
    i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`

const common = /* glsl */ `
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
`

// ---------------------------------------------------------------------------
// Pass 1: the 3D object. Outputs a single luminance value into a float target;
// the raster pass turns that luminance into dots.
// ---------------------------------------------------------------------------

export const sceneVert = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform float uDisp;
uniform float uDispFreq;
uniform float uDispSpeed;
uniform float uTwist;

varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vObj;
varying vec2 vUv;

${noise}

vec3 twist(vec3 p){
  float a = p.y * uTwist;
  float c = cos(a), s = sin(a);
  return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}

float field(vec3 p){
  vec3 q = p * uDispFreq + vec3(uSeed * 13.1, uTime * uDispSpeed, uSeed * 7.3);
  return snoise(q) + 0.35 * snoise(q * 2.3 + 4.0);
}

vec3 deform(vec3 p, vec3 n){
  return twist(p + n * field(p) * uDisp);
}

void main(){
  vec3 n = normalize(normal);
  vec3 t = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 b = normalize(cross(n, t));
  float e = 0.008;
  vec3 p0 = deform(position, n);
  vec3 p1 = deform(position + t * e, n);
  vec3 p2 = deform(position + b * e, n);
  vec3 dn = normalize(cross(p1 - p0, p2 - p0));
  if (dot(dn, twist(n)) < 0.0) dn = -dn;

  vec4 wp = modelMatrix * vec4(p0, 1.0);
  vPosW = wp.xyz;
  vNormalW = normalize(mat3(modelMatrix) * dn);
  vObj = position;
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

export const sceneFrag = /* glsl */ `
uniform float uTime;
uniform float uSeed;
uniform vec3 uLight;
uniform float uAmbient;
uniform float uDiffuse;
uniform float uSpec;
uniform float uRim;
uniform float uRimPow;
uniform float uGain;
uniform int uPattern;
uniform float uPatScale;
uniform float uPatWarp;
uniform float uPatSpeed;
uniform float uPatWidth;
uniform float uPatMix;

varying vec3 vNormalW;
varying vec3 vPosW;
varying vec3 vObj;
varying vec2 vUv;

${noise}

float band(float f){
  float l = abs(fract(f) - 0.5) * 2.0;
  float aa = fwidth(f) * 2.0 + 0.02;
  return 1.0 - smoothstep(uPatWidth - aa, uPatWidth + aa, 1.0 - l);
}

float pattern(vec3 p){
  float t = uTime * uPatSpeed;
  float w = snoise(p * 1.3 + vec3(uSeed * 3.0, 0.0, uTime * 0.15)) * uPatWarp;

  if (uPattern == 0) {
    // fingerprint whorl: rings around a wandering point on the surface
    vec3 c = vec3(sin(uTime * 0.13 + uSeed) * 0.4, cos(uTime * 0.11 + uSeed) * 0.4, 1.0);
    return band(length(p - c) * uPatScale + w * 2.0 - t);
  }
  if (uPattern == 1) {
    // topographic contours of a noise field
    float h = snoise(p * 0.9 + vec3(0.0, 0.0, t * 0.1 + uSeed)) + w * 0.5;
    return band(h * uPatScale * 0.35);
  }
  if (uPattern == 2) {
    return band((p.y + w * 0.3) * uPatScale - t);
  }
  if (uPattern == 3) {
    vec3 q = p * uPatScale * 0.45 + w;
    float s = sin(q.x) * sin(q.y + t) * sin(q.z);
    return smoothstep(0.0, 0.08, s - (1.0 - uPatWidth) * 0.6);
  }
  if (uPattern == 4) {
    float c = snoise(p * uPatScale * 0.25 + vec3(0.0, t * 0.3, uSeed)) * 0.5 + 0.5;
    return smoothstep(0.5 - uPatWidth * 0.5, 0.5 + uPatWidth * 0.5, c + w * 0.2);
  }
  return 1.0;
}

void main(){
  vec3 n = normalize(vNormalW);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vPosW);
  vec3 L = normalize(uLight);

  float diff = max(dot(n, L), 0.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), uRimPow);
  float spec = pow(max(dot(reflect(-L, n), v), 0.0), 24.0);

  float pat = pattern(vObj);
  float shade = uAmbient + diff * uDiffuse + spec * uSpec;
  float lum = shade * mix(1.0, pat, uPatMix) + rim * uRim * mix(1.0, pat, uPatMix * 0.5);

  gl_FragColor = vec4(lum * uGain, 0.0, 0.0, 1.0);
}
`

// ---------------------------------------------------------------------------
// Fullscreen passes
// ---------------------------------------------------------------------------

export const quadVert = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

// Pass 2: the raster. Luminance -> dot grid, blobs, overlay, color.
export const postFrag = /* glsl */ `
uniform sampler2D tSrc;
uniform sampler2D tOverlay;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;

uniform float uCell;
uniform int uShape;
uniform float uDotMin;
uniform float uDotMax;
uniform float uAngle;
uniform float uLevels;
uniform float uDither;
uniform float uContrast;
uniform float uBright;
uniform float uGamma;
uniform float uThresh;
uniform float uBase;
uniform float uBaseSize;
uniform float uGlow;
uniform float uFlicker;

uniform sampler2D tGlyphs;
uniform float uGlyphCount;
uniform float uGlyphRandom;
uniform float uGlyphRate;
uniform float uGlyphJitter;
uniform float uGlyphStray;

uniform int uTileMode;
uniform float uTileAmt;
uniform float uTileSize;
uniform float uTileGrain;
uniform float uTileCover;

uniform float uBlobAmt;
uniform float uBlobThr;
uniform float uBlobSoft;
uniform float uBlobBlur;
uniform float uBlobGrain;


uniform float uGrain;
uniform float uVignette;
uniform int uOverlayMode;
uniform vec3 uInk;
uniform vec3 uPaper;

varying vec2 vUv;

${common}

float bayer2(vec2 a){ a = floor(a); return fract(dot(a, vec2(0.5, a.y * 0.75))); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }

float tone(float l){
  l = (l - 0.5) * uContrast + 0.5 + uBright;
  return pow(clamp(l, 0.0, 1.0), uGamma);
}

float src(vec2 uv){ return texture2D(tSrc, uv).r; }

float shapeMask(vec2 q, float r, float aa){
  if (r <= 0.0) return 0.0;
  vec2 a = abs(q);
  float d;
  if (uShape == 0) d = length(q);
  else if (uShape == 1) d = max(a.x, a.y);
  else if (uShape == 2) d = (a.x + a.y) * 0.7071;
  else if (uShape == 3) {
    float w = r * 0.32;
    d = min(max(a.x - w, a.y - r), max(a.y - w, a.x - r));
    return 1.0 - smoothstep(-aa, aa, d);
  }
  else if (uShape == 4) {
    d = abs(length(q) - r * 0.75) - r * 0.25;
    return 1.0 - smoothstep(-aa, aa, d);
  }
  else if (uShape == 5) {
    d = max(a.x - r * 0.5, a.y - 0.46);
    return 1.0 - smoothstep(-aa, aa, d);
  }
  else {
    d = max(a.y - r * 0.5, a.x - 0.46);
    return 1.0 - smoothstep(-aa, aa, d);
  }
  return 1.0 - smoothstep(r - aa, r + aa, d);
}

float render(vec2 frag){
  float cellPx = uCell * uDpr;
  vec2 center = uRes * 0.5;

  // dot grid (optionally rotated, like a print halftone screen)
  vec2 g = rot(uAngle) * (frag - center);
  vec2 cid = floor(g / cellPx);
  vec2 q = fract(g / cellPx) - 0.5;
  vec2 cc = rot(-uAngle) * ((cid + 0.5) * cellPx) + center;

  float l = tone(src(cc / uRes));
  l *= 1.0 + (hash12(cid + floor(uTime * 12.0)) - 0.5) * 2.0 * uFlicker;
  l = clamp(l, 0.0, 1.0);
  if (uLevels > 0.5) l = floor(l * uLevels + 0.5) / uLevels;
  if (uDither > 0.5) l = step(bayer4(cid) + 0.001, l);

  float aa = 1.2 / cellPx;
  float dots;
  if (uShape == 7) {
    // characters from the glyph atlas: picked by brightness (or at random),
    // each cell swapping its character at its own moment
    float tick = floor(uTime * uGlyphRate + hash12(cid * 0.71) * 4.0);
    float h = hash12(cid * 1.31 + tick * 17.7);
    float lit = step(uThresh, l) * step(0.001, l);
    // strays: bare symbols on the object's dimmer fringe, just below the threshold
    float fringe = step(uThresh * 0.45, l) * step(0.02, l) * (1.0 - lit);
    float stray = fringe * step(hash12(cid * 3.7 + tick * 1.3), uGlyphStray);
    float idx = uGlyphRandom > 0.5 || stray > 0.5
      ? floor(h * uGlyphCount)
      : clamp(floor(l * uGlyphCount + (h - 0.5) * uGlyphJitter * uGlyphCount), 0.0, uGlyphCount - 1.0);
    float sc = max(mix(uDotMin, uDotMax, stray > 0.5 ? 0.6 : l), 0.001);
    vec2 tuv = q / sc + 0.5;
    float inside = step(0.0, tuv.x) * step(tuv.x, 1.0) * step(0.0, tuv.y) * step(tuv.y, 1.0);
    vec2 auv = vec2((idx + clamp(tuv.x, 0.0, 1.0)) / uGlyphCount, clamp(tuv.y, 0.0, 1.0));
    float lod = max(0.0, log2(64.0 / (cellPx * sc)));
    dots = textureLod(tGlyphs, auv, lod).a * inside * max(lit, stray);
  } else {
    dots = shapeMask(q, mix(uDotMin, uDotMax, l) * 0.5, aa) * step(uThresh, l);
  }

  // grainy mid-tone square under each active cell (or with the mark cut out)
  // Coverage < 1 leaves some marks bare; each cell re-rolls every few seconds.
  float tileRoll = hash12(cid * 2.17 + floor(uTime * 0.2 + hash12(cid * 0.53) * 3.0) * 9.1);
  if (uTileMode > 0 && l >= uThresh && l > 0.001 && tileRoll < uTileCover) {
    vec2 a = abs(q);
    // at full size the tiles butt together seamlessly (no anti-aliased edge)
    float tile = uTileSize >= 0.999 ? 1.0 : 1.0 - smoothstep(uTileSize * 0.5 - aa, uTileSize * 0.5 + aa, max(a.x, a.y));
    tile *= uTileAmt * mix(1.0, 0.55 + 0.45 * hash12(frag + fract(uTime) * 53.1), uTileGrain);
    dots = uTileMode == 1 ? max(dots, tile) : tile * (1.0 - dots);
  }
  float base = (1.0 - smoothstep(uBaseSize * 0.5 - aa, uBaseSize * 0.5 + aa, length(q))) * uBase;
  float glow = exp(-dot(q, q) * 14.0) * l * uGlow;
  float v = max(dots, base) + glow;

  // soft blobs: blurred, thresholded, grainy copy of the image under the dots
  if (uBlobAmt > 0.0) {
    vec2 uv = frag / uRes;
    vec2 px = uBlobBlur * uDpr / uRes;
    float s = src(uv) * 0.2;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785398;
      s += src(uv + vec2(cos(a), sin(a)) * px) * 0.06;
      s += src(uv + vec2(cos(a + 0.39), sin(a + 0.39)) * px * 0.5) * 0.04;
    }
    s = tone(s);
    float gn = hash12(frag + fract(uTime) * 91.7);
    float blob = smoothstep(uBlobThr - uBlobSoft, uBlobThr + uBlobSoft, s + (gn - 0.5) * uBlobGrain * 0.5);
    blob *= mix(1.0, 0.55 + 0.45 * gn, uBlobGrain);
    v = max(v, blob * uBlobAmt);
  }

  return v;
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec3 vv = vec3(render(frag));

  float o = texture2D(tOverlay, frag / uRes).a;
  vv = uOverlayMode == 0 ? max(vv, vec3(o)) : abs(vv - vec3(o));

  vv += (hash12(frag * 1.37 + fract(uTime * 7.0) * 100.0) - 0.5) * uGrain;
  vec2 c = frag / uRes - 0.5;
  vv *= 1.0 - uVignette * dot(c, c) * 2.5;
  vv = clamp(vv, 0.0, 1.0);

  gl_FragColor = vec4(mix(uPaper, uInk, vv), 1.0);
}
`
