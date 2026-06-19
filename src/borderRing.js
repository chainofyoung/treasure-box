export const BORDER_THICKNESS = 4;

export function borderMarginForSize(displayW, borderLayer) {
  if (!borderLayer?.sampleW) return BORDER_THICKNESS * 1.15;
  return BORDER_THICKNESS * (displayW / borderLayer.sampleW) * 1.15;
}

export function gradientColor(x, y, cx, cy) {
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

export function buildBorderLayer(img) {
  const sampleW = Math.min(280, Math.max(64, img.width));
  const sampleH = Math.max(1, Math.round(sampleW * img.height / img.width));

  const off = document.createElement('canvas');
  off.width = sampleW;
  off.height = sampleH;
  const octx = off.getContext('2d', { willReadFrequently: true });
  octx.drawImage(img, 0, 0, sampleW, sampleH);
  const data = octx.getImageData(0, 0, sampleW, sampleH).data;

  const opaque = buildOpaqueMask(data, sampleW, sampleH);
  const ring = buildOuterRing(opaque, sampleW, sampleH, BORDER_THICKNESS);

  const border = document.createElement('canvas');
  border.width = sampleW;
  border.height = sampleH;
  const bctx = border.getContext('2d');
  const cx = sampleW / 2;
  const cy = sampleH / 2;

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      if (!ring[y * sampleW + x]) continue;
      bctx.fillStyle = gradientColor(x, y, cx, cy);
      bctx.beginPath();
      bctx.arc(x + 0.5, y + 0.5, BORDER_THICKNESS * 0.55, 0, Math.PI * 2);
      bctx.fill();
    }
  }

  bctx.filter = 'blur(1px)';
  const smooth = document.createElement('canvas');
  smooth.width = sampleW;
  smooth.height = sampleH;
  const sctx = smooth.getContext('2d');
  sctx.drawImage(border, 0, 0);
  sctx.filter = 'none';
  sctx.globalAlpha = 0.9;
  sctx.drawImage(border, 0, 0);

  return { canvas: smooth, sampleW, sampleH };
}

export function drawBorderOnContext(ctx, borderLayer, x, y, w, h) {
  if (!borderLayer?.canvas) return;
  const margin = BORDER_THICKNESS * (w / borderLayer.sampleW) * 1.15;
  ctx.drawImage(
    borderLayer.canvas,
    0,
    0,
    borderLayer.sampleW,
    borderLayer.sampleH,
    x - w / 2 - margin,
    y - h / 2 - margin,
    w + margin * 2,
    h + margin * 2,
  );
}