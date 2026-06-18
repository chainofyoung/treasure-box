const TICK_MS = 90;

export class ProcessHud {
  constructor({ stage, statusEl, barEl, ringEl }) {
    this.stage = stage;
    this.statusEl = statusEl;
    this.barEl = barEl;
    this.ringEl = ringEl;
    this.display = 0;
    this.target = 0;
    this.tick = null;
    this.phraseIdx = 0;
    this.phrases = ['촬영 확인 중…', '불러오는 중…', '윤곽 따는 중…', '정리하는 중…'];
  }

  start() {
    this.stop();
    this.display = 0.03;
    this.target = 0.06;
    this.phraseIdx = 0;
    this.stage.classList.add('processing');
    this.stage.classList.add('scanning');
    this._render();
    this.tick = setInterval(() => this._drift(), TICK_MS);
  }

  setProgress(ratio, key) {
    const real = Math.max(0.04, Math.min(0.98, ratio || 0));
    this.target = Math.max(this.target, real);

    if (key?.includes('fetch') || key?.includes('download')) {
      this._setStatus('도구 받는 중…');
      this.phraseIdx = 1;
    } else if (real < 0.15) {
      this._setStatus('촬영 확인 중…');
    } else if (real < 0.42) {
      this._setStatus('준비하는 중…');
      this.phraseIdx = 1;
    } else if (real < 0.9) {
      this._setStatus('윤곽 따는 중…');
      this.phraseIdx = 2;
    } else {
      this._setStatus('거의 다 됐어요…');
      this.phraseIdx = 3;
    }
  }

  finish() {
    this.target = 1;
    this.display = 1;
    this._render();
    this._setStatus('완료');
    this.stop();
    this.stage.classList.remove('processing');
  }

  stop() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
  }

  reset() {
    this.stop();
    this.display = 0;
    this.target = 0;
    this.stage.classList.remove('processing');
    this._render();
    this._setStatus('');
  }

  _drift() {
    if (this.display < this.target) {
      this.display += (this.target - this.display) * 0.22;
    } else if (this.display < 0.92) {
      this.display += 0.004 + Math.random() * 0.006;
    }
    this.display = Math.min(this.display, 0.96);
    this._render();

    if (!this.statusEl.textContent) {
      this._setStatus(this.phrases[this.phraseIdx % this.phrases.length]);
    }
  }

  _setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  _render() {
    const pct = Math.round(this.display * 100);
    if (this.barEl) this.barEl.style.width = `${pct}%`;
    if (this.ringEl) this.ringEl.style.setProperty('--p', `${pct}`);
  }
}