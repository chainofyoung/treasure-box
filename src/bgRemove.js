import { removeBackground, preload } from '@imgly/background-removal';

const MAX_DIM_MOBILE = 512;
const MAX_DIM_DESKTOP = 640;

let ready = false;
let loading = null;
let resolvedConfig = null;
let deviceMode = 'cpu';

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
}

function maxDim() {
  return isMobile() ? MAX_DIM_MOBILE : MAX_DIM_DESKTOP;
}

async function detectDevice() {
  if (!navigator.gpu) return 'cpu';
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    return adapter ? 'gpu' : 'cpu';
  } catch {
    return 'cpu';
  }
}

function buildConfig(device) {
  const useGpu = device === 'gpu';
  return {
    device,
    model: useGpu ? 'isnet_fp16' : 'isnet_quint8',
    output: { format: 'image/png', quality: 0.82 },
  };
}

const configPromise = detectDevice().then((device) => {
  deviceMode = device;
  resolvedConfig = buildConfig(device);
  return resolvedConfig;
});

async function getConfig() {
  if (resolvedConfig) return resolvedConfig;
  return configPromise;
}

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
  const cap = maxDim();
  const scale = Math.min(1, cap / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.82);
  });
}

export function preloadModels(onProgress) {
  if (ready) return Promise.resolve();
  if (loading) return loading;

  loading = configPromise
    .then((config) => preload({
      ...config,
      progress: (key, current, total) => {
        if (total > 0 && onProgress) {
          onProgress(current / total, key);
        }
      },
    }))
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

export function getDeviceMode() {
  return deviceMode;
}

export async function removeBg(dataUrl, onProgress) {
  const config = await getConfig();
  const [, input] = await Promise.all([
    preloadModels(onProgress),
    resizeBlob(dataUrl),
  ]);
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