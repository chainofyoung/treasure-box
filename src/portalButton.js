export function initPortalButton(btn, onActivate) {
  const core = btn.querySelector('.portal-core');
  const trail = btn.querySelector('.portal-trail');
  const ctx = trail?.getContext('2d');
  const particles = [];

  let pressed = false;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let dragX = 0;
  let dragY = 0;
  let activated = false;
  let pressTime = 0;

  const TAP_MAX_DIST = 14;
  const DRAG_THRESHOLD = 10;
  const ACTIVATE_DRAG = 52;

  function setDrag(dx, dy) {
    dragX = dx;
    dragY = dy;
    const dist = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    btn.style.setProperty('--dx', `${dx}px`);
    btn.style.setProperty('--dy', `${dy}px`);
    btn.style.setProperty('--dist', `${Math.min(dist, 80)}`);
    btn.style.setProperty('--angle', `${angle}rad`);
    document.documentElement.style.setProperty('--portal-drag', `${Math.min(dist / 80, 1)}`);
  }

  function resetDrag() {
    dragX = 0;
    dragY = 0;
    btn.style.setProperty('--dx', '0px');
    btn.style.setProperty('--dy', '0px');
    btn.style.setProperty('--dist', '0');
    document.documentElement.style.setProperty('--portal-drag', '0');
  }

  function spawnParticle(x, y, vx, vy) {
    particles.push({
      x, y, vx, vy, life: 1, size: 1.5 + Math.random() * 2,
    });
  }

  function drawTrail() {
    if (!ctx || !trail) return;
    const dpr = window.devicePixelRatio || 1;
    const w = trail.width / dpr;
    const h = trail.height / dpr;
    ctx.clearRect(0, 0, w, h);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(160, 220, 255, ${p.life * 0.7})`;
      ctx.fill();
    }

    if (pressed || particles.length) {
      requestAnimationFrame(drawTrail);
    }
  }

  function emitTrail(clientX, clientY) {
    const rect = btn.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = (clientX - rect.left) * (trail.width / rect.width / (window.devicePixelRatio || 1));
    const y = (clientY - rect.top) * (trail.height / rect.height / (window.devicePixelRatio || 1));
    const vx = (clientX - cx) * 0.04 + (Math.random() - 0.5) * 0.8;
    const vy = (clientY - cy) * 0.04 + (Math.random() - 0.5) * 0.8;
    spawnParticle(x, y, vx, vy);
  }

  function resizeTrail() {
    if (!trail) return;
    const dpr = window.devicePixelRatio || 1;
    const size = btn.offsetWidth * 2.2;
    trail.width = size * dpr;
    trail.height = size * dpr;
    trail.style.width = `${size}px`;
    trail.style.height = `${size}px`;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function activate(mode) {
    if (activated) return;
    activated = true;
    btn.classList.add('portal-activating', mode === 'drag' ? 'portal-warp' : 'portal-pulse');
    setTimeout(() => {
      onActivate();
      activated = false;
      btn.classList.remove('portal-activating', 'portal-warp', 'portal-pulse');
    }, mode === 'drag' ? 420 : 280);
  }

  btn.addEventListener('pointerdown', (e) => {
    btn.setPointerCapture(e.pointerId);
    pressed = true;
    dragging = false;
    pressTime = Date.now();
    startX = e.clientX;
    startY = e.clientY;
    btn.classList.add('is-pressed');
    resetDrag();
    resizeTrail();
    requestAnimationFrame(drawTrail);
  });

  btn.addEventListener('pointermove', (e) => {
    if (!pressed) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dist = Math.hypot(dx, dy);

    if (dist > DRAG_THRESHOLD) {
      if (!dragging) {
        dragging = true;
        btn.classList.add('is-dragging');
      }
      setDrag(dx * 0.45, dy * 0.45);
      emitTrail(e.clientX, e.clientY);
    }
  });

  btn.addEventListener('pointerup', (e) => {
    if (!pressed) return;
    btn.releasePointerCapture(e.pointerId);

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const dist = Math.hypot(dx, dy);

    pressed = false;
    btn.classList.remove('is-pressed', 'is-dragging');
    resetDrag();

    if (dragging && dist >= ACTIVATE_DRAG) {
      activate('drag');
    } else if (!dragging && dist < TAP_MAX_DIST) {
      activate('tap');
    }

    dragging = false;
  });

  btn.addEventListener('pointercancel', () => {
    pressed = false;
    dragging = false;
    btn.classList.remove('is-pressed', 'is-dragging');
    resetDrag();
  });

  resizeTrail();
  window.addEventListener('resize', resizeTrail);
}