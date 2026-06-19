export class ScanAnimator {
  constructor({ stage, beam }) {
    this.stage = stage;
    this.beam = beam;
    this.active = false;
  }

  async ensureLayout() {
    for (let i = 0; i < 48; i++) {
      const rect = this.stage.getBoundingClientRect();
      if (rect.width > 64 && rect.height > 64) return;
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.stage.dataset.scanActive = '1';
    this.stage.classList.add('scan-animating');
    this.beam?.classList.remove('done');
    if (this.beam) {
      this.beam.style.removeProperty('animation');
      this.beam.style.removeProperty('top');
      this.beam.style.removeProperty('transform');
      this.beam.style.removeProperty('opacity');
      this.beam.style.removeProperty('visibility');
    }
    void this.stage.offsetHeight;
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.stage.classList.remove('scan-animating');
    delete this.stage.dataset.scanActive;
    if (this.beam) {
      this.beam.style.removeProperty('animation');
      this.beam.style.removeProperty('top');
      this.beam.style.removeProperty('transform');
      this.beam.style.removeProperty('opacity');
      this.beam.style.removeProperty('visibility');
    }
  }
}

export async function runScanWithTask(animator, task) {
  await animator.ensureLayout();
  animator.start();
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  return task();
}