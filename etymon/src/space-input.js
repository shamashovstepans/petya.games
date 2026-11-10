// Hands on the 3D view: drag to turn it, wheel or pinch to fly in, shift-drag or two fingers to slide,
// click a node, a word or empty space.

export function bindInput(sp, el = document.getElementById('sp-gl')) {
  const cam = sp.cam;
  const ptrs = new Map();
  let moved = 0, downAt = 0, pinch = null;

  const at = (e) => {
    const r = el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const touch = () => {
    sp.lastInput = performance.now();
    sp.introCam = false;
  };
  const limits = () => [0.16, sp.fit * 1.6];

  el.addEventListener('pointerdown', (e) => {
    el.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { p: at(e), type: e.pointerType });
    if (ptrs.size === 1) { moved = 0; downAt = performance.now(); }
    pinch = null;
    sp.dragging = true;
    sp.ui.blur();
    touch();
  });

  el.addEventListener('pointermove', (e) => {
    const p = at(e);
    const rec = ptrs.get(e.pointerId);
    if (!rec) {
      if (e.pointerType === 'mouse') sp.pointer = p;
      return;
    }
    const dx = p[0] - rec.p[0], dy = p[1] - rec.p[1];
    rec.p = p;
    touch();
    if (ptrs.size === 1) {
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved < 4) return;
      if (e.shiftKey || e.buttons === 2 || e.buttons === 4) cam.pan(dx, dy);
      else cam.orbit(dx * 0.0052, dy * 0.0052);
    } else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()].map((v) => v.p);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const gap = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      if (pinch) {
        cam.dolly(pinch.gap / gap, mid[0], mid[1], ...limits());
        cam.pan(mid[0] - pinch.mid[0], mid[1] - pinch.mid[1]);
      }
      pinch = { mid, gap };
      moved += 10;
    }
  });

  const up = (e) => {
    const rec = ptrs.get(e.pointerId);
    if (!rec) return;
    ptrs.delete(e.pointerId);
    pinch = null;
    if (ptrs.size) return;
    sp.dragging = false;
    touch();
    if (e.type === 'pointerup' && moved < 6 && performance.now() - downAt < 600) {
      const i = sp.pick(rec.p[0], rec.p[1]);
      if (i >= 0) sp.select(i);
      else if (sp.sel >= 0) sp.clear();
    }
    if (rec.type !== 'mouse') sp.pointer = null;
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', () => { if (!ptrs.size) sp.pointer = null; });
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = at(e);
    const unit = e.deltaMode === 1 ? 16 : 1;
    cam.dolly(Math.exp(e.deltaY * unit * (e.ctrlKey ? 0.01 : 0.0016)), p[0], p[1], ...limits());
    touch();
  }, { passive: false });

  el.addEventListener('dblclick', (e) => {
    const p = at(e);
    if (sp.pick(p[0], p[1]) < 0) sp.home();
  });

  window.addEventListener('keydown', (e) => {
    if (!sp.active || e.target.matches('input, textarea')) return;
    if (e.key === 'Escape') { if (sp.sel >= 0) sp.clear(); else sp.home(); }
    else if (e.key === 'ArrowLeft' && !e.altKey) cam.goal.yaw -= 0.25;
    else if (e.key === 'ArrowRight' && !e.altKey) cam.goal.yaw += 0.25;
    else if (e.key === 'ArrowUp') cam.goal.pitch += 0.15;
    else if (e.key === 'ArrowDown') cam.goal.pitch -= 0.15;
    else if (e.key === '+' || e.key === '=') cam.dolly(0.8, cam.w / 2, cam.h / 2, ...limits());
    else if (e.key === '-') cam.dolly(1.25, cam.w / 2, cam.h / 2, ...limits());
    else return;
    touch();
  });
}
