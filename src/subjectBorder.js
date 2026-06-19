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
    scale,
  };
}

function gradientColor(x, y, cx, cy) {
  const angle = Math.atan2(y - cy, x - cx);
  const hue = ((angle / Math.PI + 1) * 0.5 * 360) % 360;
  return `hsl(${hue}, 88%, 62%)`;
}

function buildEdgeMask(data, w, h, threshold = 28) {
  const alphaAt = (x, y) => data[(y * w + x) * 4 + 3];
  const edges = new Uint8Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alphaAt(x, y) < threshold) continue;
      let edge = false;
      for (let dy = -1; dy <= 1 && !edge; dy++) {
        for (let dx = -1; dx <= 1 && !edge; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || alphaAt(nx, ny) < threshold) {
            edge = true;
          }
        }
      }
      if (edge) edges[y * w + x] = 1;
    }
  }

  return edges;
}

export class SubjectBorder {
  constructor(canvas, stageEl) {
    this.canvas = canvas;
    this.stageEl = stageEl;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.img = null;
  }

  async refineFromCutout(url) {
    this.img = await loadImage(url);
    this._render();
    this.canvas.hidden = false;
    this.canvas.classList.add('active');
  }

  _render() {
    if (!this.img) return;

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
    const sampleW = Math.min(360, Math.max(120, Math.round(dw)));
    const sampleH = Math.max(1, Math.round(sampleW * dh / dw));

    const off = document.createElement('canvas');
    off.width = sampleW;
    off.height = sampleH;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(this.img, 0, 0, sampleW, sampleH);
    const data = octx.getImageData(0, 0, sampleW, sampleH).data;
    const edges = buildEdgeMask(data, sampleW, sampleH);

    const sx = dw / sampleW;
    const sy = dh / sampleH;
    const cx = sw / 2;
    const cy = sh / 2;

    for (let y = 0; y < sampleH; y++) {
      for (let x = 0; x < sampleW; x++) {
        if (!edges[y * sampleW + x]) continue;
        const px = ox + (x + 0.5) * sx;
        const py = oy + (y + 0.5) * sy;
        this.ctx.fillStyle = gradientColor(px, py, cx, cy);
        this.ctx.fillRect(px - 0.5, py - 0.5, 1, 1);
      }
    }
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
  }
}