const SPOTS = [
  { left: '6%', top: '16%', width: 168, height: 104, cycle: 2.6, delay: 0 },
  { left: '70%', top: '44%', width: 142, height: 118, cycle: 3.2, delay: 0.8 },
  { left: '28%', top: '74%', width: 190, height: 88, cycle: 2.9, delay: 1.5 },
];

const SWEEP_LINES = [
  { cycle: 12, delay: 3.2, active: 0.42 },
  { cycle: 15, delay: 8.7, active: 0.38 },
];

function noiseFrame(ctx, w, h, intensity) {
  const imageData = ctx.createImageData(w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const roll = Math.random();
    if (roll > intensity) {
      data[i + 3] = 0;
      continue;
    }
    const v = 140 + Math.random() * 115;
    data[i] = v * 0.55;
    data[i + 1] = v * 0.82;
    data[i + 2] = v;
    data[i + 3] = (40 + Math.random() * 200) * intensity;
  }
  ctx.putImageData(imageData, 0, 0);
}

function glitchBars(ctx, w, h, intensity) {
  const bars = 2 + Math.floor(Math.random() * 4 * intensity);
  for (let i = 0; i < bars; i++) {
    const y = Math.random() * h;
    const barH = 1 + Math.random() * 3;
    const shift = (Math.random() - 0.5) * w * 0.15 * intensity;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = `rgba(180, 230, 255, ${0.15 + Math.random() * 0.35 * intensity})`;
    ctx.fillRect(shift, y, w, barH);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function thinSweepLine(ctx, w, spark, sweepT) {
  ctx.clearRect(0, 0, w, 1);

  const shift = (Math.random() - 0.5) * w * 0.03 * spark;
  const alpha = 0.1 + spark * 0.22;
  const segments = 3 + Math.floor(Math.random() * 4);

  for (let i = 0; i < segments; i++) {
    const segW = w * (0.06 + Math.random() * 0.28);
    const segX = Math.random() * (w - segW) + shift;
    const tone = 190 + Math.random() * 45;
    ctx.fillStyle = `rgba(${tone * 0.72}, ${tone * 0.92}, 255, ${alpha * (0.55 + Math.random() * 0.45)})`;
    ctx.fillRect(segX, 0, segW, 1);
  }

  const glowX = sweepT * w * 0.85 + (Math.random() - 0.5) * w * 0.08;
  ctx.fillStyle = `rgba(210, 238, 255, ${alpha * 0.35})`;
  ctx.fillRect(glowX, 0, w * 0.12, 1);

  if (Math.random() < 0.35) {
    const dotX = Math.random() * w;
    ctx.fillStyle = `rgba(235, 248, 255, ${alpha * 0.9})`;
    ctx.fillRect(dotX, 0, 2 + Math.random() * 3, 1);
  }
}

function sweepLineIntensity(sweepT) {
  const edge = Math.min(sweepT, 1 - sweepT) * 4;
  const pulse = 0.55 + Math.abs(Math.sin(sweepT * Math.PI * 5)) * 0.3;
  return Math.min(1, edge) * pulse;
}

function burstIntensity(phase) {
  const burst = phase < 0.62;
  const flicker = burst
    ? 0.35 + Math.abs(Math.sin(phase * Math.PI * 14)) * 0.55 + Math.random() * 0.25
    : 0;
  return { burst, flicker };
}

function initRoundCrackles(container, instances) {
  SPOTS.forEach((spot, index) => {
    const wrap = document.createElement('div');
    wrap.className = `static-crackle static-crackle-${index + 1}`;
    wrap.style.left = spot.left;
    wrap.style.top = spot.top;
    wrap.style.width = `${spot.width}px`;
    wrap.style.height = `${spot.height}px`;
    wrap.style.animationDelay = `${spot.delay}s`;

    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    const ctx = canvas.getContext('2d', { alpha: true });
    let raf = 0;
    let running = true;
    const scale = 0.45;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(spot.width * scale * dpr);
      canvas.height = Math.ceil(spot.height * scale * dpr);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
    }

    function loop(now) {
      if (!running) return;
      const t = (now / 1000 + spot.delay) % spot.cycle;
      const { burst, flicker } = burstIntensity(t / spot.cycle);

      wrap.style.opacity = burst ? String(0.25 + flicker * 0.75) : '0';

      if (flicker > 0.12) {
        ctx.clearRect(0, 0, spot.width, spot.height);
        noiseFrame(ctx, spot.width, spot.height, flicker);
        if (Math.random() < flicker * 0.65) {
          glitchBars(ctx, spot.width, spot.height, flicker);
        }
      } else {
        ctx.clearRect(0, 0, spot.width, spot.height);
      }

      raf = requestAnimationFrame(loop);
    }

    resize();
    raf = requestAnimationFrame(loop);
    instances.push({
      stop() {
        running = false;
        cancelAnimationFrame(raf);
      },
      setActive(active) {
        running = active;
        if (active) {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
          wrap.style.opacity = '0';
          ctx.clearRect(0, 0, spot.width, spot.height);
        }
      },
      resize,
    });
  });
}

function initSweepLines(container, instances) {
  SWEEP_LINES.forEach((line, index) => {
    const wrap = document.createElement('div');
    wrap.className = `tv-sweep-line tv-sweep-line-${index + 1}`;

    const canvas = document.createElement('canvas');
    wrap.appendChild(canvas);
    container.appendChild(wrap);

    const ctx = canvas.getContext('2d', { alpha: true });
    let raf = 0;
    let running = true;
    let width = 0;
    let frameTick = 0;

    function resize() {
      width = window.innerWidth;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(1 * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function loop(now) {
      if (!running) return;
      frameTick += 1;

      const elapsed = (now / 1000 + line.delay) % line.cycle;
      const phase = elapsed / line.cycle;
      const onSweep = phase < line.active;

      if (!onSweep) {
        wrap.style.opacity = '0';
        ctx.clearRect(0, 0, width, 1);
        raf = requestAnimationFrame(loop);
        return;
      }

      const sweepT = phase / line.active;
      const y = -4 + sweepT * 108;
      wrap.style.top = `${y}%`;

      const spark = sweepLineIntensity(sweepT);
      wrap.style.opacity = String(0.42 + spark * 0.48);

      if (frameTick % 2 === 0) {
        thinSweepLine(ctx, width, spark, sweepT);
      }

      raf = requestAnimationFrame(loop);
    }

    resize();
    raf = requestAnimationFrame(loop);
    instances.push({
      stop() {
        running = false;
        cancelAnimationFrame(raf);
      },
      setActive(active) {
        running = active;
        if (active) {
          cancelAnimationFrame(raf);
          raf = requestAnimationFrame(loop);
        } else {
          cancelAnimationFrame(raf);
          wrap.style.opacity = '0';
          ctx.clearRect(0, 0, width, 1);
        }
      },
      resize,
    });
  });
}

export function initStaticCrackles(container) {
  const instances = [];

  initRoundCrackles(container, instances);
  initSweepLines(container, instances);

  const onResize = () => instances.forEach((i) => i.resize());
  window.addEventListener('resize', onResize);

  return {
    dispose() {
      window.removeEventListener('resize', onResize);
      instances.forEach((i) => i.stop());
    },
    setActive(active) {
      instances.forEach((i) => i.setActive?.(active));
    },
  };
}