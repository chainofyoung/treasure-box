const MIN_PHASE_MS = 2200;
const TASK_DEFER_MS = 80;

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
    this.stop();
    this.active = true;
    this.stage.dataset.scanActive = '1';
    this.stage.classList.add('scan-animating');
    this.beam?.classList.remove('done');
    if (this.beam) {
      this.beam.style.animation = '';
      this.beam.style.top = '';
      this.beam.style.transform = '';
      this.beam.style.visibility = 'visible';
      this.beam.style.opacity = '';
    }
    void this.stage.offsetHeight;
  }

  stop() {
    this.active = false;
    this.stage.classList.remove('scan-animating');
    delete this.stage.dataset.scanActive;
    if (this.beam) {
      this.beam.style.animation = 'none';
      this.beam.style.visibility = '';
      this.beam.style.opacity = '';
      this.beam.style.top = '';
      this.beam.style.transform = '';
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
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const deferredTask = new Promise((resolve) => {
    setTimeout(() => task().then(resolve), TASK_DEFER_MS);
  });

  const [, result] = await Promise.all([
    animator.runFor(MIN_PHASE_MS),
    deferredTask,
  ]);
  animator.stop();
  return result;
}