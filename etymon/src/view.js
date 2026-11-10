// Camera: unit-space disc (radius 1 = now) ↔ screen pixels.

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class View {
  constructor() {
    this.s = 300; // pixels per unit
    this.cx = 0;
    this.cy = 0;
    this.base = 300;
    this.anim = null;
    this.minK = 0.6;
    this.maxK = 18;
  }

  get k() {
    return this.s / this.base;
  }

  // Fit the whole disc (with room for labels) into the free area.
  home(w, h, inset = { l: 0, r: 0, t: 0, b: 0 }) {
    const aw = w - inset.l - inset.r;
    const ah = h - inset.t - inset.b;
    this.base = Math.max(120, Math.min(aw, ah) / 2 / 1.2);
    return { s: this.base, cx: inset.l + aw / 2, cy: inset.t + ah / 2 };
  }

  set({ s, cx, cy }) {
    this.s = s;
    this.cx = cx;
    this.cy = cy;
    this.anim = null;
  }

  toScreen(x, y) {
    return [this.cx + x * this.s, this.cy + y * this.s];
  }

  toUnit(px, py) {
    return [(px - this.cx) / this.s, (py - this.cy) / this.s];
  }

  zoomAt(px, py, f) {
    const k = this.k * f;
    const clamped = Math.min(this.maxK, Math.max(this.minK, k));
    f = clamped / this.k;
    this.cx = px - (px - this.cx) * f;
    this.cy = py - (py - this.cy) * f;
    this.s *= f;
    this.anim = null;
  }

  pan(dx, dy) {
    this.cx += dx;
    this.cy += dy;
    this.anim = null;
  }

  flyTo(target, ms = 1100) {
    this.anim = { from: { s: this.s, cx: this.cx, cy: this.cy }, to: target, t0: performance.now(), ms };
  }

  // Frame a unit-space box [x0,y0,x1,y1] inside the free area.
  fitBox(box, w, h, inset, maxK = 9) {
    const [x0, y0, x1, y1] = box;
    const aw = w - inset.l - inset.r;
    const ah = h - inset.t - inset.b;
    const bw = Math.max(x1 - x0, 0.05);
    const bh = Math.max(y1 - y0, 0.05);
    let s = Math.min(aw / bw, ah / bh) * 0.82;
    s = Math.min(s, this.base * maxK);
    s = Math.max(s, this.base * 0.9);
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    return { s, cx: inset.l + aw / 2 - mx * s, cy: inset.t + ah / 2 - my * s };
  }

  update(now) {
    if (!this.anim) return false;
    const { from, to, t0, ms } = this.anim;
    const t = Math.min(1, (now - t0) / ms);
    const e = ease(t);
    // interpolate zoom geometrically so the motion feels even
    const s = from.s * Math.pow(to.s / from.s, e);
    // keep the unit point that ends at the screen centre moving smoothly
    this.s = s;
    this.cx = from.cx + (to.cx - from.cx) * e;
    this.cy = from.cy + (to.cy - from.cy) * e;
    if (t >= 1) this.anim = null;
    return true;
  }
}
