import { ScanSweep } from './scanSweep.js';

const MIN_PHASE_MS = 2200;

export class ScanAnimator {
  constructor({ stage, beam, canvas }) {
    this.stage = stage;
    this.beam = beam;
    this.sweep = new ScanSweep(canvas, stage);
    this.raf = null;
    this.t = 0;
    this.active = false;
  }

  async ensureLayout() {
    for (let i = 0; i < 40; i++) {
      const rect = this.stage.getBoundingClientRect();
      if (rect.width > 64 && rect.height > 64) {
        this.sweep.resize();
        return;
      }
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    this.sweep.resize();
  }

  start() {
    this.stop();
    this.active = true;
    this.t = 0;
    this.stage.dataset.scanActive = '1';
    this.beam?.classList.remove('done');
    this.beam.style.visibility = 'visible';
    this.beam.style.opacity = '1';
    this.sweep.start();

    const tick = () => {
      if (!this.active) return;
      this.t += 0.024;
      const phase = (Math.sin(this.t * 1.5) + 1) / 2;
      const top = 2 + phase * 96;
      if (this.beam) this.beam.style.top = `${top}%`;
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.active = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.sweep.stop();
    delete this.stage.dataset.scanActive;
    if (this.beam) {
      this.beam.style.visibility = '';
      this.beam.style.opacity = '';
      this.beam.style.top = '0%';
    }
  }

  async runFor(ms = MIN_PHASE_MS) {
    const start = performance.now();
    await new Promise((resolve) => {
      const wait = () => {
        if (performance.now() - start >= ms) resolve();
        else requestAnimationFrame(wait);
      };
      requestAnimationFrame(wait);
    });
  }
}

export async function runScanWithTask(animator, task) {
  await animator.ensureLayout();
  animator.start();
  const [, result] = await Promise.all([
    animator.runFor(MIN_PHASE_MS),
    task(),
  ]);
  animator.stop();
  return result;
}