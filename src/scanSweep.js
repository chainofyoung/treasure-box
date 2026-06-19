export class ScanSweep {
  constructor(canvas, stageEl) {
    this.canvas = canvas;
    this.stageEl = stageEl;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.raf = null;
    this.running = false;
    this.t = 0;
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
    this.resize();
    const tick = () => {
      if (!this.running) return;
      this.t += 0.016;
      this.draw(this.t);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    if (this.w && this.h) this.ctx?.clearRect(0, 0, this.w, this.h);
  }

  draw(t) {
    const { w, h, ctx } = this;
    ctx.clearRect(0, 0, w, h);

    const phase = (Math.sin(t * 1.45) + 1) / 2;
    const y = phase * h;
    const band = 42 + Math.sin(t * 2.8) * 10;

    const trail = ctx.createLinearGradient(0, y - band, 0, y + band);
    trail.addColorStop(0, 'rgba(126, 200, 227, 0)');
    trail.addColorStop(0.42, 'rgba(126, 200, 227, 0.08)');
    trail.addColorStop(0.5, 'rgba(200, 245, 255, 0.22)');
    trail.addColorStop(0.58, 'rgba(126, 200, 227, 0.08)');
    trail.addColorStop(1, 'rgba(126, 200, 227, 0)');
    ctx.fillStyle = trail;
    ctx.fillRect(0, y - band, w, band * 2);

    for (let row = y - band; row < y + band; row += 1) {
      if (row < 0 || row > h) continue;
      if (Math.random() > 0.42) continue;

      const alpha = 0.1 + Math.random() * 0.28;
      const thick = Math.random() < 0.12 ? 2 + Math.random() * 2 : 1;
      const shift = (Math.random() - 0.5) * w * 0.08;

      if (Math.random() < 0.35) {
        const segW = w * (0.2 + Math.random() * 0.65);
        const segX = Math.random() * (w - segW) + shift;
        ctx.fillStyle = `rgba(180, 230, 255, ${alpha})`;
        ctx.fillRect(segX, row, segW, thick);
      } else {
        ctx.fillStyle = `rgba(220, 245, 255, ${alpha * 0.85})`;
        ctx.fillRect(shift, row, w, thick);
      }
    }

    const beamGrad = ctx.createLinearGradient(0, y - 4, 0, y + 4);
    beamGrad.addColorStop(0, 'rgba(126, 200, 227, 0)');
    beamGrad.addColorStop(0.45, 'rgba(200, 245, 255, 0.75)');
    beamGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    beamGrad.addColorStop(0.55, 'rgba(200, 245, 255, 0.75)');
    beamGrad.addColorStop(1, 'rgba(126, 200, 227, 0)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(0, y - 4, w, 8);

    ctx.shadowColor = 'rgba(180, 240, 255, 0.9)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(240, 252, 255, 0.85)';
    ctx.fillRect(0, y - 0.5, w, 1.5);
    ctx.shadowBlur = 0;
  }
}