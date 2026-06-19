import { buildBorderLayer, BORDER_THICKNESS } from './borderRing.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function coverLayout(imgW, imgH, stageW, stageH) {
  const scale = Math.max(stageW / imgW, stageH / imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  return {
    ox: (stageW - dw) / 2,
    oy: (stageH - dh) / 2,
    dw,
    dh,
  };
}

export class SubjectBorder {
  constructor(canvas, stageEl) {
    this.canvas = canvas;
    this.stageEl = stageEl;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.img = null;
    this.borderLayer = null;
  }

  async refineFromCutout(url) {
    this.img = await loadImage(url);
    this.borderLayer = buildBorderLayer(this.img);
    this._render();
    this.canvas.hidden = false;
    this.canvas.classList.add('active');
  }

  _render() {
    if (!this.img || !this.borderLayer) return;

    const rect = this.stageEl.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sw = rect.width;
    const sh = rect.height;

    this.canvas.width = Math.ceil(sw * dpr);
    this.canvas.height = Math.ceil(sh * dpr);
    this.canvas.style.width = `${sw}px`;
    this.canvas.style.height = `${sh}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, sw, sh);

    const { ox, oy, dw, dh } = coverLayout(this.img.width, this.img.height, sw, sh);
    const margin = BORDER_THICKNESS * (dw / this.borderLayer.sampleW) * 1.15;

    this.ctx.save();
    this.ctx.filter = 'blur(1.1px)';
    this.ctx.drawImage(
      this.borderLayer.canvas,
      0,
      0,
      this.borderLayer.sampleW,
      this.borderLayer.sampleH,
      ox - margin,
      oy - margin,
      dw + margin * 2,
      dh + margin * 2,
    );
    this.ctx.filter = 'none';
    this.ctx.globalAlpha = 0.92;
    this.ctx.drawImage(
      this.borderLayer.canvas,
      0,
      0,
      this.borderLayer.sampleW,
      this.borderLayer.sampleH,
      ox - margin,
      oy - margin,
      dw + margin * 2,
      dh + margin * 2,
    );
    this.ctx.restore();
  }

  resize() {
    if (this.canvas.hidden || !this.img) return;
    this._render();
  }

  hide() {
    this.canvas.classList.remove('active');
    this.canvas.hidden = true;
    this.ctx?.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.img = null;
    this.borderLayer = null;
  }
}