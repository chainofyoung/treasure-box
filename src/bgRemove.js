import { removeBackground, preload } from '@imgly/background-removal';

const MAX_DIM = 768;

const config = {
  model: 'isnet_quint8',
  output: { format: 'image/png', quality: 0.88 },
};

let ready = false;
let loading = null;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function resizeBlob(dataUrl) {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
  });
}

export function preloadModels(onProgress) {
  if (ready) return Promise.resolve();
  if (loading) return loading;

  loading = preload({
    ...config,
    progress: (key, current, total) => {
      if (total > 0 && onProgress) {
        onProgress(current / total, key);
      }
    },
  })
    .then(() => {
      ready = true;
    })
    .finally(() => {
      loading = null;
    });

  return loading;
}

export function isModelReady() {
  return ready;
}

export async function removeBg(dataUrl, onProgress) {
  await preloadModels(onProgress);

  const input = await resizeBlob(dataUrl);
  let computeBase = 0;

  const blob = await removeBackground(input, {
    ...config,
    progress: (key, current, total) => {
      if (!onProgress || total <= 0) return;
      if (key.includes('fetch') || key.includes('download')) {
        computeBase = 0.35;
        onProgress((current / total) * 0.35, key);
      } else {
        onProgress(computeBase + (current / total) * (1 - computeBase), key);
      }
    },
  });

  return URL.createObjectURL(blob);
}