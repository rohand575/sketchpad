// GLSL ES 3.00 shader sources for the WebGL2 painting engine.
// All layer/scratch/accum textures use PREMULTIPLIED alpha and a consistent
// doc-space orientation (doc (0,0) = texture row 0). Only the final screen pass
// applies the camera + y-down mapping.

// Centered unit quad in [-0.5, 0.5]; `unit` = [0,1].
const QUAD_ATTR = `in vec2 aPos;`

// --- Stamp: draws one dab into a doc-resolution target ---
export const STAMP_VERT = `#version 300 es
${QUAD_ATTR}
uniform vec2 uCenter;      // dab center, doc px
uniform float uSize;       // dab diameter, doc px
uniform float uAngle;      // radians
uniform vec2 uResolution;  // doc size px
out vec2 vUV;
out vec2 vDoc;
void main() {
  float c = cos(uAngle), s = sin(uAngle);
  vec2 local = aPos * uSize;
  vec2 rot = vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec2 doc = uCenter + rot;
  vDoc = doc;
  vUV = aPos + 0.5;
  vec2 clip = (doc / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(clip, 0.0, 1.0);
}`

export const STAMP_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
in vec2 vDoc;
uniform sampler2D uShape;
uniform sampler2D uGrain;
uniform bool uUseGrain;
uniform float uGrainScale;
uniform vec3 uColor;   // straight RGB 0..1
uniform float uFlow;   // 0..1
out vec4 frag;
void main() {
  float m = texture(uShape, vUV).a;
  if (uUseGrain) {
    m *= texture(uGrain, vDoc * (uGrainScale / 256.0)).r;
  }
  float a = m * uFlow;
  frag = vec4(uColor * a, a); // premultiplied
}`

// Shared separable blend function.
const BLEND = `
vec3 blendMode(vec3 cb, vec3 cs, int m) {
  if (m == 1) return cb * cs;                         // multiply
  if (m == 2) return cb + cs - cb * cs;               // screen
  if (m == 3) return mix(2.0*cb*cs, 1.0-2.0*(1.0-cb)*(1.0-cs), step(0.5, cb)); // overlay
  if (m == 4) return min(cb, cs);                     // darken
  if (m == 5) return max(cb, cs);                     // lighten
  if (m == 6) return min(cb / max(1.0 - cs, 1e-4), vec3(1.0)); // color-dodge
  if (m == 7) return min(cb + cs, vec3(1.0));         // add
  if (m == 8) return (1.0-2.0*cs)*cb*cb + 2.0*cs*cb;  // soft-light
  return cs;                                          // normal
}`

const FULL_VERT = `#version 300 es
${QUAD_ATTR}
out vec2 vUV;
void main() {
  vec2 unit = aPos + 0.5;
  vUV = unit;
  gl_Position = vec4(aPos * 2.0, 0.0, 1.0);
}`

export const FULL_VERT_SRC = FULL_VERT

// --- Apply a finished stroke (scratch) onto a layer ---
export const STROKE_COMPOSITE_FRAG = `#version 300 es
precision highp float;
${BLEND}
in vec2 vUV;
uniform sampler2D uBase;    // layer, premult
uniform sampler2D uStroke;  // scratch, premult
uniform float uOpacity;
uniform int uMode;          // 0 normal, 1 multiply
uniform bool uErase;
uniform bool uAlphaLock;
out vec4 frag;
void main() {
  vec4 base = texture(uBase, vUV);
  vec4 strk = texture(uStroke, vUV) * uOpacity;
  if (uErase) {
    frag = base * (1.0 - strk.a);
    return;
  }
  float ba = base.a, sa = strk.a;
  vec3 bc = ba > 0.0 ? base.rgb / ba : vec3(0.0);
  vec3 sc = sa > 0.0 ? strk.rgb / sa : vec3(0.0);
  vec3 bl = clamp(blendMode(bc, sc, uMode), 0.0, 1.0);
  vec3 cs = mix(sc, bl, ba);
  if (uAlphaLock) {
    vec3 outC = mix(bc, cs, sa);
    frag = vec4(outC * ba, ba);
    return;
  }
  float outA = sa + ba * (1.0 - sa);
  vec3 outC = cs * sa + bc * ba * (1.0 - sa);
  frag = vec4(outC, outA);
}`

// --- Composite a layer over the accumulation (ping-pong) ---
export const LAYER_COMPOSITE_FRAG = `#version 300 es
precision highp float;
${BLEND}
in vec2 vUV;
uniform sampler2D uPrev;   // accumulation below, premult
uniform sampler2D uLayer;  // layer content, premult
uniform float uOpacity;
uniform int uMode;
uniform bool uClip;
out vec4 frag;
void main() {
  vec4 base = texture(uPrev, vUV);
  vec4 lay = texture(uLayer, vUV) * uOpacity;
  if (uClip) lay *= base.a;
  float ba = base.a, la = lay.a;
  vec3 bc = ba > 0.0 ? base.rgb / ba : vec3(0.0);
  vec3 lc = la > 0.0 ? lay.rgb / la : vec3(0.0);
  vec3 bl = clamp(blendMode(bc, lc, uMode), 0.0, 1.0);
  vec3 cs = mix(lc, bl, ba);
  float outA = la + ba * (1.0 - la);
  vec3 outC = cs * la + bc * ba * (1.0 - la);
  frag = vec4(outC, outA);
}`

// --- Draw the accumulation to screen through the camera ---
export const SCREEN_VERT = `#version 300 es
${QUAD_ATTR}
uniform mat3 uMatrix;   // doc -> clip (includes camera + screen y-flip)
uniform vec2 uDocSize;
out vec2 vUV;
void main() {
  vec2 unit = aPos + 0.5;
  vUV = unit;
  vec3 clip = uMatrix * vec3(unit * uDocSize, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}`

export const SCREEN_FRAG = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uAccum;
out vec4 frag;
void main() {
  frag = texture(uAccum, vUV);
}`
