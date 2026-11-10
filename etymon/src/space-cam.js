// The eye of the 3D view: an orbit camera that eases toward wherever it is told to go.

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const PITCH_MAX = 1.45;

export class Camera {
  constructor() {
    this.fov = (38 * Math.PI) / 180;
    this.tanHalf = Math.tan(this.fov / 2);
    this.w = 1; this.h = 1; this.aspect = 1;
    // where it is, and where it is heading
    this.target = [0, 0, 0]; this.yaw = 0.5; this.pitch = 0.22; this.dist = 3; this.shift = [0, 0];
    this.goal = { target: [0, 0, 0], yaw: 0.5, pitch: 0.22, dist: 3, shift: [0, 0] };
    this.rate = 5;
    this.vp = new Float32Array(16);
    this.eye = [0, 0, 3]; this.right = [1, 0, 0]; this.up = [0, 1, 0]; this.fwd = [0, 0, -1];
    this.update();
  }

  setSize(w, h) {
    this.w = w; this.h = h; this.aspect = w / h;
  }

  // distance at which a ball of this radius fills the view
  fitDist(radius) {
    return radius / Math.sin(Math.atan(this.tanHalf * Math.min(1, this.aspect)));
  }

  snap() {
    const g = this.goal;
    this.target = g.target.slice(); this.yaw = g.yaw; this.pitch = g.pitch; this.dist = g.dist; this.shift = g.shift.slice();
    this.update();
  }

  step(dt) {
    const g = this.goal;
    g.pitch = Math.min(PITCH_MAX, Math.max(-PITCH_MAX, g.pitch));
    const k = 1 - Math.exp(-dt * this.rate);
    for (let i = 0; i < 3; i++) this.target[i] += (g.target[i] - this.target[i]) * k;
    this.yaw += (g.yaw - this.yaw) * k;
    this.pitch += (g.pitch - this.pitch) * k;
    this.dist *= Math.exp(Math.log(g.dist / this.dist) * k);
    this.shift[0] += (g.shift[0] - this.shift[0]) * k;
    this.shift[1] += (g.shift[1] - this.shift[1]) * k;
    this.update();
  }

  // is it still travelling?
  moving() {
    const g = this.goal;
    return Math.abs(g.yaw - this.yaw) + Math.abs(g.pitch - this.pitch) + Math.abs(Math.log(g.dist / this.dist))
      + Math.hypot(g.target[0] - this.target[0], g.target[1] - this.target[1], g.target[2] - this.target[2]) > 0.002;
  }

  static offset(yaw, pitch) {
    const cp = Math.cos(pitch);
    return [cp * Math.sin(yaw), Math.sin(pitch), cp * Math.cos(yaw)];
  }

  update() {
    const o = Camera.offset(this.yaw, this.pitch);
    const eye = this.eye;
    for (let i = 0; i < 3; i++) eye[i] = this.target[i] + o[i] * this.dist;
    const fwd = [-o[0], -o[1], -o[2]];
    const right = norm(cross(fwd, [0, 1, 0]));
    const up = cross(right, fwd);
    this.fwd = fwd; this.right = right; this.up = up;
    const sx = 1 / (this.tanHalf * this.aspect), sy = 1 / this.tanHalf;
    const rx = [right[0] * sx + fwd[0] * this.shift[0], right[1] * sx + fwd[1] * this.shift[0], right[2] * sx + fwd[2] * this.shift[0]];
    const ry = [up[0] * sy + fwd[0] * this.shift[1], up[1] * sy + fwd[1] * this.shift[1], up[2] * sy + fwd[2] * this.shift[1]];
    const m = this.vp;
    m[0] = rx[0]; m[4] = rx[1]; m[8] = rx[2]; m[12] = -dot(rx, eye);
    m[1] = ry[0]; m[5] = ry[1]; m[9] = ry[2]; m[13] = -dot(ry, eye);
    m[2] = 0; m[6] = 0; m[10] = 0; m[14] = 0;
    m[3] = fwd[0]; m[7] = fwd[1]; m[11] = fwd[2]; m[15] = -dot(fwd, eye);
  }

  // world -> CSS pixels; out = [x, y, depth]. False when behind the eye.
  project(x, y, z, out) {
    const m = this.vp;
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (w < 0.02) return false;
    out[0] = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / w * 0.5 + 0.5) * this.w;
    out[1] = (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / w * 0.5) * this.h;
    out[2] = w;
    return true;
  }

  // the world point under a CSS pixel, at a given depth in front of the eye
  unproject(px, py, depth) {
    const nx = (px / this.w) * 2 - 1 - this.shift[0];
    const ny = 1 - (py / this.h) * 2 - this.shift[1];
    const kx = nx * this.tanHalf * this.aspect * depth, ky = ny * this.tanHalf * depth;
    return [
      this.eye[0] + this.fwd[0] * depth + this.right[0] * kx + this.up[0] * ky,
      this.eye[1] + this.fwd[1] * depth + this.right[1] * kx + this.up[1] * ky,
      this.eye[2] + this.fwd[2] * depth + this.right[2] * kx + this.up[2] * ky,
    ];
  }

  // CSS pixels per world unit at depth 1
  get pxScale() {
    return this.h / (2 * this.tanHalf);
  }

  orbit(dx, dy) {
    this.goal.yaw -= dx;
    this.goal.pitch += dy;
  }

  pan(dxPx, dyPx) {
    const k = this.dist / this.pxScale;
    for (let i = 0; i < 3; i++) this.goal.target[i] += (-this.right[i] * dxPx + this.up[i] * dyPx) * k;
  }

  // zoom by a factor, keeping the world point under the cursor where it is
  dolly(factor, px, py, min, max) {
    const g = this.goal;
    const next = Math.min(max, Math.max(min, g.dist * factor));
    const f = next / g.dist;
    if (f === 1) return;
    const p = this.unproject(px, py, this.dist);
    for (let i = 0; i < 3; i++) g.target[i] = p[i] + (g.target[i] - p[i]) * f;
    g.dist = next;
  }
}
