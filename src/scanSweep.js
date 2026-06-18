export class ScanSweep {
  constructor(canvas, stageEl) {
    this.canvas = canvas;
    this.stageEl = stageEl;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.raf = null;
    this.running = false;
    this.t = 0;
    this.dir = 1;
  }

  resize() {
    const rect = this.stageEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.ceil(rect.width * dpr);
    this.canvas.height = Math.ceil(rect.height * dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
  }

  start() {
    this.stop();
    this.running = true;
    this.t = 0;
    this.dir = 1;
    this.resize();
    const tick = (now) => {
      if (!this.running) return;
      this.t += 0.014;
      this.draw(this.t);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.ctx?.clearRect(0, 0, this.w, this.h);
  }

  draw(t) {
    const { w, h, ctx } = this;
    ctx.clearRect(0, 0, w, h);

    const phase = (Math.sin(t * 1.35) + 1) / 2;
    const y = phase * h;
    const band = 28 + Math.sin(t * 3.2) * 8;

    for (let row = y - band; row < y + band; row += 1.2) {
      if (row < 0 || row > h) continue;
      if (Math.random() > 0.55) continue;

      const alpha = 0.06 + Math.random() * 0.22;
      const thick = Math.random() < 0.08 ? 2 + Math.random() * 2 : 1;
      const shift = (Math.random() - 0.5) * w * 0.06;

      if (Math.random() < 0.4) {
        const segW = w * (0.15 + Math.random() * 0.7);
        const segX = Math.random() * (w - segW) + shift;
        const tone = 170 + Math.random() * 70;
        ctx.fillStyle = `rgba(${tone * 0.65}, ${tone * 0.88}, 255, ${alpha})`;
        ctx.fillRect(segX, row, segW, thick);
      } else {
        ctx.fillStyle = `rgba(210, 238, 255, ${alpha * 0.75})`;
        ctx.fillRect(shift, row, w, thick);
      }
    }

    const beamGrad = ctx.createLinearGradient(0, y - 2, 0, y + 2);
    beamGrad.addColorStop(0, 'rgba(126, 200, 227, 0)');
    beamGrad.addColorStop(0.5, 'rgba(200, 245, 255, 0.55)');
    beamGrad.addColorStop(1, 'rgba(126, 200, 227, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(0, y - 3, w, 6);

    if (Math.random() < 0.2) {
      const tearY = y + (Math.random() - 0.5) * band;
      ctx.fillStyle = `rgba(255, 120, 180, ${0.12 + Math.random() * 0.15})`;
      ctx.fillRect((Math.random() - 0.5) * w * 0.1, tearY, w * 0.92, 1);
    }
  }
}