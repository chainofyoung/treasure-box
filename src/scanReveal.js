export class ScanReveal {
  constructor({ beam, cutoutWrap, cutoutImg }) {
    this.beam = beam;
    this.wrap = cutoutWrap;
    this.img = cutoutImg;
    this.raf = null;
    this.mode = 'idle';
    this.loopT = 0;
  }

  reset() {
    this.stop();
    this.wrap.style.clipPath = 'inset(0 0 100% 0)';
    this.beam.style.top = '0%';
    this.beam.classList.remove('done');
  }

  startLoop() {
    this.stop();
    this.mode = 'loop';
    this.loopT = 0;
    this.beam?.classList.remove('done');
    const tick = () => {
      if (this.mode !== 'loop') return;
      this.loopT += 0.022;
      const phase = (Math.sin(this.loopT * 1.55) + 1) / 2;
      const p = 3 + phase * 94;
      this.setBeam(p);
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  setProgress(ratio) {
    const p = Math.max(0, Math.min(92, ratio * 92));
    this.setBeam(p);
  }

  stop() {
    this.mode = 'idle';
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
  }

  setBeam(p) {
    this.beam.style.top = `${p}%`;
  }

  reveal(url) {
    this.stop();
    this.mode = 'reveal';

    return new Promise((resolve) => {
      const animate = () => {
        let p = parseFloat(this.beam.style.top) || 0;
        const step = () => {
          p = Math.min(100, p + 2.8);
          this.wrap.style.clipPath = `inset(0 0 ${100 - p}% 0)`;
          this.setBeam(p);
          if (p < 100) {
            this.raf = requestAnimationFrame(step);
          } else {
            this.beam.classList.add('done');
            this.mode = 'idle';
            resolve();
          }
        };
        step();
      };

      this.img.onload = animate;
      this.img.src = url;
      if (this.img.complete && this.img.naturalWidth > 0) animate();
    });
  }
}