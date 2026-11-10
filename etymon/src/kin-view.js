// Etymon, languages: one frame of the globe, and what lies under the pointer.

import { dot, smooth } from './space-layout.js';
import { formatYear } from './langs.js';
import { rDate } from './kin-tree.js';

export const GROW_FROM = 0.03;
const INTRO_SECONDS = 12, TURN = 0.11;
export const INTRO_TURN = INTRO_SECONDS * TURN;   // how far the globe turns while it grows

// How fast the far side fades. With something chosen, all else is dark already, so the far side
// may show through: kin on the other side of the world stay in sight.
export const FOG = { none: 1.4, lang: 1.0, pair: 0.55, word: 0.4, set: 0.4 };

// Half a million lines, most of them too faint to see one by one: below this much light a line is
// one of a haze, and one in so many is drawn for all of them (space-gl.js). Low enough that a line
// drawn this way is still not seen by itself: over the night sky this is about one step of grey.
const THIN = 0.0007;

// How sharply the light is drawn. Its cost is the number of pixels, so when frames come slowly it
// is drawn smaller and stretched, at once and by as much as it takes; and when they have come easily
// for a while it is tried larger again, up to where it began. The words keep the screen's sharpness.
function pace(k, raw, now) {
  const p = (k.paced ||= { n: 0, list: [], easy: 0, fails: 0, hold: 0, from: 0 });
  if (!(raw > 0 && raw < 250)) { p.n = 0; p.list.length = 0; return; }   // a pause measures nothing
  if (++p.n <= 6) return;                                                 // nor do the frames after one
  p.list.push(raw);
  if (p.list.length < 24) return;
  const mid = p.list.sort((a, b) => a - b)[12];
  p.list.length = 0;
  let to = k.rs;
  if (mid > 21) {
    // too slow. If this is what came of trying larger, go back, and leave it be for a while
    to = p.from || Math.max(0.5, k.rs * Math.min(0.92, Math.max(0.6, Math.sqrt(16.7 / mid) * 0.97)));
    if (p.from) { p.fails++; p.hold = now + 20000; }
    p.from = 0;
    p.easy = 0;
  } else {
    p.from = 0;
    if (mid < 17.6 && k.rs < k.rsMax - 0.01 && p.fails < 3 && now > p.hold && ++p.easy >= 6) {
      p.from = k.rs;
      p.easy = 0;
      to = Math.min(k.rsMax, k.rs * 1.15);
    }
  }
  if (Math.abs(to - k.rs) > 0.01) { k.rs = to; k.rescale(); p.n = 0; }
}

export function drawFrame(k, dt, now) {
  const { cam, M } = k, g = cam.goal;
  const kind = k.what ? k.what.kind : 'none';

  if (k.growing) {
    k.introT = Math.min(1, k.introT + dt / INTRO_SECONDS);
    const e = k.introT;
    k.grow = GROW_FROM + (M.maxRad + 0.04 - GROW_FROM) * (e * e * (3 - 2 * e) * 0.6 + e * 0.4);
    k.ui.year(formatYear(Math.round(rDate(Math.min(1, k.grow)) / 10) * 10, { approx: k.grow < 0.5 }));
    if (k.introCam) {
      g.dist = k.fit * (0.42 + 0.58 * smooth(0, 1, e));
      g.yaw += dt * TURN;
      g.pitch = k.homeAt.pitch + (0.3 - k.homeAt.pitch) * (1 - smooth(0.25, 1, e));
    }
    if (e >= 1) { k.growing = false; k.introCam = false; k.grow = 9; k.ui.year(null); k.ui.hint(true); }
  } else if (!k.reduced && !k.dragging && k.sel < 0 && now - k.lastInput > 3500) g.yaw += dt * 0.035;
  if (k.sel < 0 && g.dist > k.fit * 0.8) {
    const q = Math.exp(-dt * 1.6);
    g.target[0] *= q; g.target[1] *= q; g.target[2] *= q;
  }
  cam.step(dt);
  k.selMix = Math.min(1, k.selMix + dt / 0.55);

  pace(k, k.calm ? 0 : now - (k.prev ?? now), now);
  k.prev = now;

  // every form, on screen
  const m = cam.vp, w = cam.w, h = cam.h, P = M.pos, scr = k.scr, N = M.N;
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const x = P[o], y = P[o + 1], z = P[o + 2];
    const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw < 0.02) { scr[o + 2] = 0; continue; }
    scr[o] = ((m[0] * x + m[4] * y + m[8] * z + m[12]) / cw * 0.5 + 0.5) * w;
    scr[o + 1] = (0.5 - (m[1] * x + m[5] * y + m[9] * z + m[13]) / cw * 0.5) * h;
    scr[o + 2] = cw;
  }

  // where the eye rests: on what is chosen, else on the near face of the globe
  const eye = cam.eye;
  let goal = cam.dist;
  if (k.at && k.at.length) {
    goal = 0;
    for (const p of k.at) goal += Math.hypot(p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]);
    goal /= k.at.length;
  } else {
    const r = Math.min(1, Math.max(0.1, k.grow)), b = dot(eye, cam.fwd), disc = b * b - dot(eye, eye) + r * r;
    if (disc > 0 && -b - Math.sqrt(disc) > 0.05) goal = -b - Math.sqrt(disc);
  }
  const ease = 1 - Math.exp(-dt * 6);
  k.focus += (goal - k.focus) * ease;
  k.fog = (k.fog ?? FOG.none) + (FOG[kind] - (k.fog ?? FOG.none)) * ease;

  const hover = k.pointer && !k.dragging ? pickAt(k, k.pointer[0], k.pointer[1]) : -1;
  if (hover !== k.hover) { k.hover = hover; k.el.classList.toggle('is-hot', hover >= 0); }

  const H = h * k.rs, c = [0, 0, 0], seen = cam.project(0, 0, 0, c);
  const near = smooth(1.2, 3, k.fit / cam.dist);   // close in, less blur: the words are to be read
  const look = {
    vp: m, pxScale: cam.pxScale * k.rs, focus: k.focus,
    aperture: H * (0.006 - 0.003 * near), maxCoc: H * 0.02,
    grow: k.grow, time: k.time, tint: 1, selMix: k.selMix, dpr: k.rs,
    fog: k.fog, ice: k.ice, hot: k.hot, line: 0.0011, pulse: k.reduced ? 0 : 0.6, dustGain: 1, thin: THIN,
    bloom: 0.55, exposure: 0.75, tanHalf: cam.tanHalf, right: cam.right, up: cam.up, fwd: cam.fwd,
    glow: seen
      ? [c[0] / w, 1 - c[1] / h, cam.pxScale / c[2] / h, 0.8 * (k.growing ? smooth(0, 0.5, k.introT) : 1)]
      : [0.5, 0.5, 1, 0],
    shift: [-cam.shift[0], -cam.shift[1]],
  };
  if (k.gl) k.gl.render(look);
  k.labels.draw(dt);
}

// What is under the pointer: a form (its index), a language (N + its index), or -1.
// From far off a dot is too small to mean one word, so the answer is its language.
export function pickAt(k, x, y) {
  const { K, T, M, cam } = k;
  if (!M || !k.labels) return -1;
  const lab = k.labels.hit(x, y);
  if (lab >= 0) return lab;
  const scr = k.scr, tg = M.tg, rel = k.rel, st = K.st, N = K.N, grow = k.grow, focus = k.focus;
  const kind = k.what ? k.what.kind : '', lit = kind === 'word' || kind === 'set';
  const fog = k.fog ?? FOG.none;
  const vote = (k.vote ||= new Float32Array(T.S));
  vote.fill(0);
  let best = -1, bs = Infinity, bd = 1, hot = -1, hs = Infinity;
  for (let i = 0, o = 0; i < N; i++, o += 3) {
    const d = scr[o + 2];
    if (d <= 0) continue;
    const dx = scr[o] - x, dy = scr[o + 1] - y, q = dx * dx + dy * dy;
    if (q > 196 || tg[i] >= grow) continue;
    // what is lit shows through the globe; what is dark does not
    const r = kind ? rel[i] : 1;
    const vis = Math.exp(-Math.max(d - focus, 0) * (r ? fog : FOG.none));
    if (vis < 0.3) continue;
    const v2 = vis * vis, s = (q + 4) / v2;
    if (lit && r) { if (s < hs) { hs = s; hot = i; } continue; }
    vote[st[i]] += v2 / (q + 16);
    if (s < bs) { bs = s; best = i; bd = d; }
  }
  if (hot >= 0) return hot;        // the lit forms of a chosen word stand apart: each can be taken
  if (best < 0) return -1;
  if ((1.33 * T.c * cam.pxScale) / bd >= 6) return best;
  let s = 0;
  for (let j = 1; j < T.S; j++) if (vote[j] > vote[s]) s = j;
  return N + s;
}
