const ALPHA_THRESH = 24;

export function getTrimBounds(imageData) {
  const { width, height, data } = imageData;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = data[(y * width + x) * 4 + 3];
      if (a > ALPHA_THRESH) {
        found = true;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!found) {
    return { x: 0, y: 0, w: width, h: height };
  }

  const pad = 2;
  return {
    x: Math.max(0, minX - pad),
    y: Math.max(0, minY - pad),
    w: Math.min(width, maxX - minX + 1 + pad * 2),
    h: Math.min(height, maxY - minY + 1 + pad * 2),
  };
}

export async function trimTransparent(src) {
  const img = await loadImage(src);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);

  const full = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const bounds = getTrimBounds(full);

  const out = document.createElement('canvas');
  out.width = bounds.w;
  out.height = bounds.h;
  out.getContext('2d').drawImage(
    canvas,
    bounds.x, bounds.y, bounds.w, bounds.h,
    0, 0, bounds.w, bounds.h,
  );

  return {
    canvas: out,
    bounds,
    dataUrl: out.toDataURL('image/png'),
    aspect: bounds.w / bounds.h,
  };
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}