// WebGL2 renderer for the 3D view.
//
// Everything is light: nodes and filaments are drawn additively into a float buffer,
// each sprite widened by its own circle of confusion (depth of field without a blur
// pass), then a bloom chain and a filmic composite over a procedural night sky.

const NODE_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aPos;
layout(location=2) in vec4 aData;   // world radius, time radius, seed, kind
layout(location=3) in vec4 aColor;  // rgb (linear), intensity
layout(location=4) in vec4 aState;  // previous (brightness, highlight), next (brightness, highlight)
uniform mat4 uVP;
uniform vec2 uViewport;
uniform float uPxScale, uFocus, uAperture, uMaxCoc, uGrow, uTime, uTint, uSelMix, uDpr, uFog;
uniform vec3 uIce, uHot;
out vec2 vP;
out vec3 vCol;
out vec3 vShape;
void main() {
  vec4 c = uVP * vec4(aPos, 1.0);
  float d = c.w;
  float kind = aData.w;
  float age = uGrow - aData.y;
  if (d < 0.02 || age <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 st = mix(aState.xy, aState.zw, uSelMix);
  float appear = min(age / 0.014, 1.0);
  float flash = exp(-age * 30.0);
  float raw = aData.x * uPxScale / d;
  float lo = 0.8 * uDpr;
  float px = clamp(raw, lo, 34.0 * uDpr) * (0.45 + 0.55 * appear) * (1.0 + 0.5 * st.y);
  float dof = kind > 4.5 ? 0.1 : 1.0;                      // far stars stay crisp
  float coc = min(uAperture * abs(1.0 - uFocus / d) * dof, uMaxCoc);
  float rb = px + coc;
  float blur = coc / (coc + px * 1.5);
  float R = max(px * 3.4, rb * 1.06) + 1.5;
  vP = aCorner * R;
  vShape = vec3(px, rb, blur);
  float tw = 0.84 + 0.16 * sin(uTime * (0.5 + aData.z * 1.9) + aData.z * 40.0);
  float fog = kind > 3.5 ? 1.0 : exp(-max(d - uFocus, 0.0) * uFog);
  float thin = clamp(raw / lo, 0.3, 1.0);
  float I = st.x * tw * fog * thin * appear * (1.0 + flash * 2.6);
  vec3 ice = kind > 0.5 ? uIce : uIce * vec3(0.56, 0.77, 1.0);   // older forms sit deeper in the blue
  vec3 base = kind > 1.5 ? aColor.rgb : mix(ice, aColor.rgb, uTint);
  base = mix(base, uHot, st.y);
  vCol = base * aColor.a * I * (1.0 + 1.5 * st.y);
  gl_Position = vec4(c.xy + vP * 2.0 / uViewport * c.w, c.zw);
}`;

const NODE_FS = `#version 300 es
precision highp float;
in vec2 vP;
in vec3 vCol;
in vec3 vShape;
out vec4 o;
void main() {
  float r = length(vP);
  float px = vShape.x, rb = vShape.y, blur = vShape.z;
  float q = r / px;
  // in focus: a hot core with a soft halo
  float sharp = (exp(-q * q * 0.95) + 0.2 * exp(-q * q * 0.13)) * smoothstep(3.4, 2.2, q);
  // out of focus: a flat disc with a slightly brighter rim, like a lens would draw it
  float edge = max(1.3, rb * 0.16);
  float disc = smoothstep(rb, rb - edge, r) * (0.7 + 0.42 * pow(r / rb, 3.0));
  float energy = pow(px / rb, 1.32) * 1.45;
  o = vec4(vCol * mix(sharp, disc * energy, blur), 1.0);
}`;

const SEG_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 aA;
layout(location=2) in vec3 aB;
layout(location=3) in vec4 aE;      // time radius at A, at B, pulse phase, kind
layout(location=4) in vec4 aColor;  // rgb (linear), intensity
layout(location=5) in vec4 aState;
uniform mat4 uVP;
uniform vec2 uViewport;
uniform float uPxScale, uFocus, uAperture, uMaxCoc, uGrow, uTint, uSelMix, uDpr, uFog, uLine, uThin;
uniform vec3 uIce, uHot;
out float vAcross;
out float vRad;
out float vPhase;
out vec3 vCol;
const float NEAR = 0.03;
// how much of a line's light is left at depth d: far things fade, thin things thin, blurred things spread
float lightAt(float d) {
  float raw = uLine * uPxScale / d;
  float lw = clamp(raw, 0.5 * uDpr, 2.4 * uDpr);
  float coc = min(uAperture * abs(1.0 - uFocus / d), uMaxCoc) * 0.8;
  return exp(-max(d - uFocus, 0.0) * uFog) * clamp(raw / (0.5 * uDpr), 0.35, 1.0) * lw / (lw + coc);
}
void main() {
  vec4 ca = uVP * vec4(aA, 1.0);
  vec4 cb = uVP * vec4(aB, 1.0);
  float ra = aE.x, rb = aE.y;
  if (min(ra, rb) > uGrow || (ca.w < NEAR && cb.w < NEAR)) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  if (ca.w < NEAR) { float t = (NEAR - ca.w) / (cb.w - ca.w); ca = mix(ca, cb, t); ra = mix(ra, rb, t); }
  else if (cb.w < NEAR) { float t = (NEAR - cb.w) / (ca.w - cb.w); cb = mix(cb, ca, t); rb = mix(rb, ra, t); }
  vec2 sa = ca.xy / ca.w * uViewport * 0.5;
  vec2 sb = cb.xy / cb.w * uViewport * 0.5;
  vec2 dir = sb - sa;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  bool first = aCorner.x < 0.0;
  vec4 c = first ? ca : cb;
  float d = c.w;
  vec2 st = mix(aState.xy, aState.zw, uSelMix);
  float raw = uLine * uPxScale / d;
  float lo = 0.5 * uDpr;
  float lw = clamp(raw, lo, 2.4 * uDpr) * (1.0 + 1.3 * st.y);
  float coc = min(uAperture * abs(1.0 - uFocus / d), uMaxCoc) * 0.8;
  float hw = lw + coc;
  vRad = first ? ra : rb;
  vPhase = aE.z;
  float fog = exp(-max(d - uFocus, 0.0) * uFog);
  float thin = clamp(raw / lo, 0.35, 1.0);
  vec3 base = aE.w > 1.5 ? aColor.rgb : mix(uIce * vec3(0.5, 0.72, 1.0), aColor.rgb, uTint);
  base = mix(base, uHot, st.y);
  float gain = aColor.a * st.x * (1.0 + 2.4 * st.y);
  vCol = base * gain * fog * thin * (lw / hw);
  float tail = 1.9, pad = 1.0;
  if (uThin > 0.0) {
    // A line too faint to be seen by itself is one of many that make a haze. Of such lines one in
    // so many is drawn, as bright as the many were together: the haze stays, the work does not.
    // The choice is made once for the whole line (at its middle), and a line near the edge of
    // being chosen is faded, so that nothing pops as the eye moves.
    float top = max(base.r, max(base.g, base.b)) * gain;
    float keep = clamp(top * lightAt(0.5 * (ca.w + cb.w)) / uThin, 0.0, 1.0);
    if (keep < 1.0) {
      float band = min(0.12, 0.3 * keep);   // narrow, so that what is drawn is hardly brighter than uThin
      float mine = band * 0.5 + fract(aE.w) * 2.0408 * (1.0 - band);   // the line's own number
      float w = clamp((keep - mine) / max(band, 1e-5) + 0.5, 0.0, 1.0);
      if (w <= 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
      vCol *= w * (1.0 - band) / max(keep - 0.5 * band, 1e-5);
    }
    // and the ribbon is no wider than its light reaches; what the cut takes off the sides goes to the middle
    float peak = max(vCol.r, max(vCol.g, vCol.b));
    tail = clamp(sqrt(log(max(peak, 2.0e-4) / 1.0e-4) * 0.625), 0.85, 1.9);
    vCol /= sqrt(1.0 - exp(-2.037 * tail * tail));
    pad = 0.6;
  }
  float W = hw * tail + pad;
  vAcross = aCorner.y * W / hw;
  gl_Position = vec4(c.xy + nrm * aCorner.y * W * 2.0 / uViewport * c.w, c.zw);
}`;

const SEG_FS = `#version 300 es
precision highp float;
in float vAcross;
in float vRad;
in float vPhase;
in vec3 vCol;
uniform float uGrow, uTime, uPulse;
out vec4 o;
void main() {
  if (vRad > uGrow) discard;
  float a = exp(-vAcross * vAcross * 1.6);
  float tip = exp(-(uGrow - vRad) * 38.0);
  float ph = fract(vRad * 1.2 - uTime * 0.07 + vPhase) - 0.5;
  float bead = exp(-ph * ph * 900.0);
  o = vec4(vCol * a * (1.0 + tip * 3.2 + bead * uPulse), 1.0);
}`;

const FULL_VS = `#version 300 es
out vec2 vUV;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uHp;
out vec4 o;
void main() {
  vec3 s = texture(uTex, vUV).rgb * 4.0;
  s += texture(uTex, vUV + uHp).rgb;
  s += texture(uTex, vUV - uHp).rgb;
  s += texture(uTex, vUV + vec2(uHp.x, -uHp.y)).rgb;
  s += texture(uTex, vUV - vec2(uHp.x, -uHp.y)).rgb;
  o = vec4(s / 8.0, 1.0);
}`;

const UP_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uHp;
out vec4 o;
void main() {
  vec3 s = texture(uTex, vUV + vec2(-uHp.x * 2.0, 0.0)).rgb;
  s += texture(uTex, vUV + vec2(-uHp.x, uHp.y)).rgb * 2.0;
  s += texture(uTex, vUV + vec2(0.0, uHp.y * 2.0)).rgb;
  s += texture(uTex, vUV + vec2(uHp.x, uHp.y)).rgb * 2.0;
  s += texture(uTex, vUV + vec2(uHp.x * 2.0, 0.0)).rgb;
  s += texture(uTex, vUV + vec2(uHp.x, -uHp.y)).rgb * 2.0;
  s += texture(uTex, vUV + vec2(0.0, -uHp.y * 2.0)).rgb;
  s += texture(uTex, vUV + vec2(-uHp.x, -uHp.y)).rgb * 2.0;
  o = vec4(s / 12.0, 1.0);
}`;

const COMP_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene, uBloom;
uniform samplerCube uSky;   // two fields of slow noise over the sphere of directions, drawn once
uniform float uBloomK, uExposure, uTime, uTanHalf, uAspect;
uniform vec3 uRight, uUp, uFwd;
uniform vec4 uGlow;   // organism centre (uv), radius, strength
uniform vec2 uShift;
out vec4 o;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
void main() {
  vec2 ndc = vUV * 2.0 - 1.0 + uShift;
  vec3 dir = normalize(uFwd + uRight * ndc.x * uTanHalf * uAspect + uUp * ndc.y * uTanHalf);
  vec2 n = texture(uSky, dir).rg;
  vec3 bg = vec3(0.0017, 0.0027, 0.0080);
  bg += vec3(0.0022, 0.0042, 0.0125) * smoothstep(0.32, 0.8, n.x);
  bg += vec3(0.0034, 0.0016, 0.0062) * smoothstep(0.5, 0.9, n.y);
  vec2 gp = (vUV - uGlow.xy) * vec2(uAspect, 1.0);
  bg += vec3(0.0085, 0.0125, 0.030) * exp(-dot(gp, gp) / (uGlow.z * uGlow.z)) * uGlow.w;
  vec3 col = bg + texture(uScene, vUV).rgb + texture(uBloom, vUV).rgb * uBloomK;
  col = 1.0 - exp(-col * uExposure);
  vec2 v = vUV - 0.5;
  col *= mix(1.0, 0.35, smoothstep(0.18, 0.62, dot(v, v)));
  col = pow(col, vec3(1.0 / 2.2));
  col += (hash(vec3(gl_FragCoord.xy, fract(uTime) * 91.0)) - 0.5) * (1.6 / 255.0);
  o = vec4(col, 1.0);
}`;

// The night sky: slow noise, a value for every direction. It never changes, so it is drawn once
// into the six faces of a cube and looked up from then on.
const SKY_FS = `#version 300 es
precision highp float;
in vec2 vUV;
uniform vec3 uA, uB, uC;   // the face: its middle, and the directions its two sides run in
out vec4 o;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) {
  return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.03 + 11.0) + 0.15 * vnoise(p * 4.1 + 23.0);
}
void main() {
  vec2 f = vUV * 2.0 - 1.0;
  vec3 dir = normalize(uA + uB * f.x + uC * f.y);
  o = vec4(fbm(dir * 1.6 + 3.1), fbm(dir * 3.3 - 7.7), 0.0, 1.0);
}`;

// the faces of a cube map in the order WebGL numbers them: middle, then where s and t run
const FACES = [
  [[1, 0, 0], [0, 0, -1], [0, -1, 0]], [[-1, 0, 0], [0, 0, 1], [0, -1, 0]],
  [[0, 1, 0], [1, 0, 0], [0, 0, 1]], [[0, -1, 0], [1, 0, 0], [0, 0, -1]],
  [[0, 0, 1], [1, 0, 0], [0, -1, 0]], [[0, 0, -1], [-1, 0, 0], [0, -1, 0]],
];

const LEVELS = 6;

export class SpaceGL {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: false, alpha: false, depth: false, stencil: false,
      premultipliedAlpha: false, powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL 2 is not available');
    this.gl = gl;
    this.scene = null;
    this.w = 0;
    this.h = 0;
    this.init();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.init();
      if (this.scene) this.setScene(this.scene);
      const { w, h } = this;
      this.w = this.h = 0;
      this.resize(w, h);
    });
  }

  init() {
    const gl = this.gl;
    this.float = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
    this.pNode = this.program(NODE_VS, NODE_FS);
    this.pSeg = this.program(SEG_VS, SEG_FS);
    this.pDown = this.program(FULL_VS, DOWN_FS);
    this.pUp = this.program(FULL_VS, UP_FS);
    this.pComp = this.program(FULL_VS, COMP_FS);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.emptyVao = gl.createVertexArray();
    this.pSky = this.program(FULL_VS, SKY_FS);
    this.sky = this.bakeSky(256);
    this.targets = null;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
  }

  program(vsSrc, fsSrc) {
    const gl = this.gl;
    const make = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, make(gl.VERTEX_SHADER, vsSrc));
    gl.attachShader(p, make(gl.FRAGMENT_SHADER, fsSrc));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`program: ${gl.getProgramInfoLog(p)}`);
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return { p, u };
  }

  bakeSky(size) {
    const gl = this.gl, tex = gl.createTexture(), fbo = gl.createFramebuffer(), u = this.pSky.u;
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, tex);
    for (let f = 0; f < 6; f++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, 0, gl.RGBA8, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, size, size);
    gl.disable(gl.BLEND);
    gl.useProgram(this.pSky.p);
    gl.bindVertexArray(this.emptyVao);
    FACES.forEach(([a, b, c], f) => {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_CUBE_MAP_POSITIVE_X + f, tex, 0);
      gl.uniform3fv(u.uA, a);
      gl.uniform3fv(u.uB, b);
      gl.uniform3fv(u.uC, c);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);
    gl.bindVertexArray(null);
    return tex;
  }

  // instanced layout: a per-vertex corner, a static interleaved buffer, and (optionally) a dynamic state buffer
  vao(staticData, sizes, stateLoc, stateData) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, staticData, gl.STATIC_DRAW);
    const stride = sizes.reduce((a, b) => a + b, 0) * 4;
    let off = 0;
    sizes.forEach((size, i) => {
      const loc = i + 1;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, off);
      gl.vertexAttribDivisor(loc, 1);
      off += size * 4;
    });
    let state = null;
    if (stateData) {
      state = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, state);
      gl.bufferData(gl.ARRAY_BUFFER, stateData, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(stateLoc);
      gl.vertexAttribPointer(stateLoc, 4, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(stateLoc, 1);
    }
    gl.bindVertexArray(null);
    return { vao, buf, state };
  }

  // scene: { nodes (11 floats each), nodeState, segs (14 floats each), segState, dust (11 floats each) }
  setScene(s) {
    const gl = this.gl;
    for (const k of ['nodes', 'segs', 'dust']) {
      const o = this[k];
      if (!o) continue;
      gl.deleteVertexArray(o.vao);
      gl.deleteBuffer(o.buf);
      if (o.state) gl.deleteBuffer(o.state);
    }
    this.scene = s;
    this.nodes = this.vao(s.nodes, [3, 4, 4], 4, s.nodeState);
    this.nodeCount = s.nodes.length / 11;
    this.segs = this.vao(s.segs, [3, 3, 4, 4], 5, s.segState);
    this.segCount = s.segs.length / 14;
    this.dust = this.vao(s.dust, [3, 4, 4], 4, null);
    this.dustCount = s.dust.length / 11;
  }

  setState(nodeState, segState) {
    const gl = this.gl;
    if (!this.nodes) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.nodes.state);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, nodeState);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.segs.state);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, segState);
  }

  target(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.float) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }

  // w, h in device pixels
  resize(w, h) {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    if (w === this.w && h === this.h && this.targets) return;
    const gl = this.gl;
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    if (this.targets) {
      for (const t of this.targets) {
        gl.deleteTexture(t.tex);
        gl.deleteFramebuffer(t.fbo);
      }
    }
    const list = [this.target(w, h)];
    let tw = w, th = h;
    for (let i = 0; i < LEVELS; i++) {
      tw = Math.max(2, tw >> 1);
      th = Math.max(2, th >> 1);
      list.push(this.target(tw, th));
    }
    this.targets = list;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  // thin: the light below which a line or a dot is one of a haze and may be thinned out (0: never)
  shared(prog, p, thin = 0) {
    const gl = this.gl;
    const u = prog.u;
    gl.useProgram(prog.p);
    gl.uniform1f(u.uThin, thin);
    gl.uniformMatrix4fv(u.uVP, false, p.vp);
    gl.uniform2f(u.uViewport, this.w, this.h);
    gl.uniform1f(u.uPxScale, p.pxScale);
    gl.uniform1f(u.uFocus, p.focus);
    gl.uniform1f(u.uAperture, p.aperture);
    gl.uniform1f(u.uMaxCoc, p.maxCoc);
    gl.uniform1f(u.uGrow, p.grow);
    gl.uniform1f(u.uTime, p.time);
    gl.uniform1f(u.uTint, p.tint);
    gl.uniform1f(u.uSelMix, p.selMix);
    gl.uniform1f(u.uDpr, p.dpr);
    gl.uniform1f(u.uFog, p.fog);
    gl.uniform3fv(u.uIce, p.ice);
    gl.uniform3fv(u.uHot, p.hot);
  }

  render(p) {
    const gl = this.gl;
    if (this.lost || !this.targets || !this.nodes) return;
    const T = this.targets;

    // 1. the scene, additively, into the float buffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, T[0].fbo);
    gl.viewport(0, 0, this.w, this.h);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    this.shared(this.pSeg, p, p.thin || 0);
    gl.uniform1f(this.pSeg.u.uLine, p.line);
    gl.uniform1f(this.pSeg.u.uPulse, p.pulse);
    gl.bindVertexArray(this.segs.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.segCount);

    this.shared(this.pNode, p);
    gl.bindVertexArray(this.nodes.vao);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.nodeCount);

    // dust and stars are not part of the growth, nor of any selection
    gl.uniform1f(this.pNode.u.uGrow, 9.0);
    gl.bindVertexArray(this.dust.vao);
    gl.vertexAttrib4f(4, p.dustGain, 0, p.dustGain, 0);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.dustCount);

    // 2. bloom: down the chain, then back up, adding as it goes
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.useProgram(this.pDown.p);
    gl.uniform1i(this.pDown.u.uTex, 0);
    for (let i = 1; i <= LEVELS; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T[i].fbo);
      gl.viewport(0, 0, T[i].w, T[i].h);
      gl.bindTexture(gl.TEXTURE_2D, T[i - 1].tex);
      gl.uniform2f(this.pDown.u.uHp, 1 / T[i - 1].w, 1 / T[i - 1].h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.enable(gl.BLEND);
    gl.useProgram(this.pUp.p);
    gl.uniform1i(this.pUp.u.uTex, 0);
    for (let i = LEVELS - 1; i >= 1; i--) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T[i].fbo);
      gl.viewport(0, 0, T[i].w, T[i].h);
      gl.bindTexture(gl.TEXTURE_2D, T[i + 1].tex);
      gl.uniform2f(this.pUp.u.uHp, 0.5 / T[i + 1].w, 0.5 / T[i + 1].h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);

    // 3. composite over the sky
    const u = this.pComp.u;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.w, this.h);
    gl.useProgram(this.pComp.p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, T[0].tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, T[1].tex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.sky);
    gl.uniform1i(u.uScene, 0);
    gl.uniform1i(u.uBloom, 1);
    gl.uniform1i(u.uSky, 2);
    gl.uniform1f(u.uBloomK, p.bloom / LEVELS);
    gl.uniform1f(u.uExposure, p.exposure);
    gl.uniform1f(u.uTime, p.time);
    gl.uniform1f(u.uTanHalf, p.tanHalf);
    gl.uniform1f(u.uAspect, this.w / this.h);
    gl.uniform3fv(u.uRight, p.right);
    gl.uniform3fv(u.uUp, p.up);
    gl.uniform3fv(u.uFwd, p.fwd);
    gl.uniform4fv(u.uGlow, p.glow);
    gl.uniform2fv(u.uShift, p.shift);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  }
}
