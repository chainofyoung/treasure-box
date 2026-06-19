const KEY = 'treasure-collection';
const MAX_STORE_DIM = 480;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function loadTreasures() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveTreasures(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch (err) {
    console.warn('Storage save failed:', err);
    return false;
  }
}

export async function toPersistableUrl(url) {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function compressForStorage(dataUrl) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_STORE_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/png');
}

export async function persistTreasure(url) {
  const dataUrl = await toPersistableUrl(url);
  const compressed = await compressForStorage(dataUrl);
  const list = loadTreasures();
  list.push(compressed);

  if (!saveTreasures(list)) {
    list.pop();
    const err = new Error('storage-full');
    err.code = 'storage-full';
    throw err;
  }

  return { count: list.length, dataUrl: compressed };
}

export function clearTreasures() {
  localStorage.removeItem(KEY);
}