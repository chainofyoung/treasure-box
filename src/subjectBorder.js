function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function sampleBg(data, w, h) {
  const pts = [
    [2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3],
    [w >> 1, 2], [w >> 1, h - 3],
  ];
  let r = 0; let g = 0; let b = 0;
  pts.forEach(([x, y]) => {
    const i = (y * w + x) * 4;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
  });
  const n = pts.length;
  return { r: r / n, g: g / n, b: b / n };
}

function estimateBounds(data, w, h) {
  const bg = sampleBg(data, w, h);
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const diff = Math.abs(data[i] - bg.r)
        + Math.abs(data[i + 1] - bg.g)
        + Math.abs(data[i + 2] - bg.b);
      if (diff > 42) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) {
    return { x: 0.22, y: 0.28, w: 0.56, h: 0.44 };
  }

  const padX = w * 0.03;
  const padY = h * 0.03;
  return {
    x: Math.max(0, (minX - padX) / w),
    y: Math.max(0, (minY - padY) / h),
    w: Math.min(1, (maxX - minX + 1 + padX * 2) / w),
    h: Math.min(1, (maxY - minY + 1 + padY * 2) / h),
  };
}

function coverMap(norm, imgW, imgH, stageW, stageH) {
  const scale = Math.max(stageW / imgW, stageH / imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  const ox = (stageW - dw) / 2;
  const oy = (stageH - dh) / 2;

  const ix = norm.x * imgW;
  const iy = norm.y * imgH;
  const iw = norm.w * imgW;
  const ih = norm.h * imgH;

  return {
    left: ((ox + ix * scale) / stageW) * 100,
    top: ((oy + iy * scale) / stageH) * 100,
    width: ((iw * scale) / stageW) * 100,
    height: ((ih * scale) / stageH) * 100,
  };
}

export class SubjectBorder {
  constructor(el, stageEl) {
    this.el = el;
    this.stageEl = stageEl;
    this.imgW = 0;
    this.imgH = 0;
  }

  async showFromPhoto(dataUrl) {
    const img = await loadImage(dataUrl);
    this.imgW = img.width;
    this.imgH = img.height;

    const sampleW = 140;
    const sampleH = Math.max(1, Math.round(sampleW * img.height / img.width));
    const canvas = document.createElement('canvas');
    canvas.width = sampleW;
    canvas.height = sampleH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, sampleW, sampleH);
    const norm = estimateBounds(ctx.getImageData(0, 0, sampleW, sampleH).data, sampleW, sampleH);

    this._applyNorm(norm);
    this.el.hidden = false;
    this.el.classList.add('active');
  }

  async refineFromCutout(url) {
    const img = await loadImage(url);
    const w = img.width;
    const h = img.height;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;

    let minX = w; let minY = h; let maxX = 0; let maxY = 0; let found = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > 24) {
          found = true;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (!found) return;

    const pad = 4;
    const norm = {
      x: Math.max(0, (minX - pad) / w),
      y: Math.max(0, (minY - pad) / h),
      w: Math.min(1, (maxX - minX + 1 + pad * 2) / w),
      h: Math.min(1, (maxY - minY + 1 + pad * 2) / h),
    };
    this.imgW = w;
    this.imgH = h;
    this._applyNorm(norm);
  }

  _applyNorm(norm) {
    this.el.dataset.nx = String(norm.x);
    this.el.dataset.ny = String(norm.y);
    this.el.dataset.nw = String(norm.w);
    this.el.dataset.nh = String(norm.h);
    const rect = this.stageEl.getBoundingClientRect();
    const mapped = coverMap(norm, this.imgW, this.imgH, rect.width, rect.height);
    this.el.style.left = `${mapped.left}%`;
    this.el.style.top = `${mapped.top}%`;
    this.el.style.width = `${mapped.width}%`;
    this.el.style.height = `${mapped.height}%`;
  }

  resize() {
    if (this.el.hidden) return;
    const norm = {
      x: parseFloat(this.el.dataset.nx || '0.22'),
      y: parseFloat(this.el.dataset.ny || '0.28'),
      w: parseFloat(this.el.dataset.nw || '0.56'),
      h: parseFloat(this.el.dataset.nh || '0.44'),
    };
    if (this.imgW && this.imgH) this._applyNorm(norm);
  }

  hide() {
    this.el.classList.remove('active');
    this.el.hidden = true;
  }
}