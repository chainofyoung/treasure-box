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

function gradientColor(x, y, cx, cy) {
  const angle = Math.atan2(y - cy, x - cx);
  const hue = ((angle / Math.PI + 1) * 0.5 * 360) % 360;
  return `hsl(${hue}, 86%, 64%)`;
}

function buildOpaqueMask(data, w, h, threshold = 28) {
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] >= threshold) mask[y * w + x] = 1;
    }
  }
  return mask;
}

function dilate(mask, w, h, radius) {
  const out = new Uint8Array(w * h);
  const r2 = radius * radius;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy > r2) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
        }
      }
    }
  }
  return out;
}

function buildOuterRing(opaque, w, h, thickness) {
  const dilated = dilate(opaque, w, h, thickness);
  const ring = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (dilated[i] && !opaque[i]) ring[i] = 1;
  }
  return ring;
}

const BORDER_THICKNESS = 4;

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
    const sampleW = Math.min(560, Math.max(200, Math.round(dw * 1.2)));
    const sampleH = Math.max(1, Math.round(sampleW * dh / dw));

    const off = document.createElement('canvas');
    off.width = sampleW;
    off.height = sampleH;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(this.img, 0, 0, sampleW, sampleH);
    const data = octx.getImageData(0, 0, sampleW, sampleH).data;

    const opaque = buildOpaqueMask(data, sampleW, sampleH);
    const ring = buildOuterRing(opaque, sampleW, sampleH, BORDER_THICKNESS);

    const border = document.createElement('canvas');
    border.width = sampleW;
    border.height = sampleH;
    const bctx = border.getContext('2d');
    const cx = sw / 2;
    const cy = sh / 2;
    const sx = dw / sampleW;
    const sy = dh / sampleH;

    for (let y = 0; y < sampleH; y++) {
      for (let x = 0; x < sampleW; x++) {
        if (!ring[y * sampleW + x]) continue;
        const px = ox + (x + 0.5) * sx;
        const py = oy + (y + 0.5) * sy;
        bctx.fillStyle = gradientColor(px, py, cx, cy);
        bctx.beginPath();
        bctx.arc(x + 0.5, y + 0.5, BORDER_THICKNESS * 0.55, 0, Math.PI * 2);
        bctx.fill();
      }
    }

    this.ctx.save();
    this.ctx.filter = 'blur(1.1px)';
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(border, 0, 0, sampleW, sampleH, ox, oy, dw, dh);
    this.ctx.filter = 'none';
    this.ctx.globalAlpha = 0.92;
    this.ctx.drawImage(border, 0, 0, sampleW, sampleH, ox, oy, dw, dh);
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
  }
}