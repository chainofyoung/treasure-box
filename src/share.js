const BG = '#06080f';

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
}

function blobToFile(blob, filename, type = 'image/jpeg') {
  const ext = type.includes('png') ? 'png' : 'jpg';
  const name = filename.includes('.') ? filename : `${filename}.${ext}`;
  return new File([blob], name, { type, lastModified: Date.now() });
}

function canShareFile(file) {
  return typeof navigator.share === 'function'
    && (!navigator.canShare || navigator.canShare({ files: [file] }));
}

function downloadBlob(blob, filename) {
  const file = blobToFile(blob, filename, blob.type || 'image/jpeg');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function waitFrame() {
  return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

function buildShareFiles(blob, filename) {
  const files = [
    blobToFile(blob, filename, 'image/jpeg'),
    blobToFile(blob, filename, 'image/png'),
  ];
  return files.filter((file, idx, arr) => arr.findIndex((f) => f.type === file.type) === idx);
}

export async function captureVesselSnapshot(vesselEl, canvas) {
  await waitFrame();
  const rect = vesselEl.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const out = document.createElement('canvas');
  out.width = Math.ceil(rect.width * dpr);
  out.height = Math.ceil(rect.height * dpr);
  const ctx = out.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0, out.width, out.height);

  return canvasToJpegBlob(out, 0.92);
}

function canvasToJpegBlob(canvas, quality = 0.9) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('capture failed'));
    }, 'image/jpeg', quality);
  });
}

async function dataUrlToJpegBlob(url) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = url;
  });
  const max = 1400;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvasToJpegBlob(canvas, 0.9);
}

export async function prepareItemShareBlob(urls) {
  if (urls.length === 1) return dataUrlToJpegBlob(urls[0]);

  const cols = urls.length <= 4 ? 2 : 3;
  const rows = Math.ceil(urls.length / cols);
  const cell = 320;
  const pad = 24;
  const out = document.createElement('canvas');
  out.width = cols * cell + pad * 2;
  out.height = rows * cell + pad * 2;
  const ctx = out.getContext('2d');
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, out.width, out.height);

  for (let i = 0; i < urls.length; i++) {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = urls[i];
    });
    const col = i % cols;
    const row = Math.floor(i / cols);
    const box = cell - 16;
    const scale = Math.min(box / img.width, box / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = pad + col * cell + (cell - w) / 2;
    const y = pad + row * cell + (cell - h) / 2;
    ctx.drawImage(img, x, y, w, h);
  }

  return canvasToJpegBlob(out, 0.9);
}

const SHARE_TITLE = '줍줍일지';

export function shareFileNow(file) {
  if (!canShareFile(file)) return Promise.reject(new Error('cannot share'));
  return navigator.share({ files: [file], title: SHARE_TITLE });
}

export async function shareImageBlob(blob, filename) {
  const files = buildShareFiles(blob, filename);

  for (const file of files) {
    if (!canShareFile(file)) continue;
    try {
      await navigator.share({ files: [file], title: SHARE_TITLE });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  if (typeof navigator.share === 'function') {
    for (const file of files) {
      try {
        await navigator.share({ files: [file], title: SHARE_TITLE });
        return 'shared';
      } catch (err) {
        if (err?.name === 'AbortError') throw err;
      }
    }
  }

  if (isAndroid() || isMobile()) {
    downloadBlob(blob, filename);
    return 'downloaded';
  }

  downloadBlob(blob, filename);
  return 'downloaded';
}

export async function shareSnapshot(vesselEl, canvas) {
  const blob = await captureVesselSnapshot(vesselEl, canvas);
  return {
    blob,
    filename: `줍줍일지-상자-${stamp()}`,
  };
}

export async function shareTreasureItems(urls) {
  if (!urls.length) throw new Error('empty');
  const blob = await prepareItemShareBlob(urls);
  return {
    blob,
    filename: urls.length === 1 ? `줍줍일지-${stamp()}` : `줍줍일지-모음-${stamp()}`,
  };
}

let previewState = null;
let shareCache = null;

export function setShareCache(payload) {
  if (!payload?.blob) return;
  const files = buildShareFiles(payload.blob, payload.filename);
  shareCache = {
    blob: payload.blob,
    filename: payload.filename,
    file: files.find(canShareFile) || files[0],
    files,
  };
}

export function getShareCache() {
  return shareCache;
}

export function clearShareCache() {
  shareCache = null;
}

export function openSharePreview({ blob, filename, imgEl, panelEl }) {
  const url = URL.createObjectURL(blob);
  previewState?.revoke?.();
  const files = buildShareFiles(blob, filename);
  previewState = {
    blob,
    filename,
    file: files.find(canShareFile) || files[0],
    files,
    url,
    revoke: () => URL.revokeObjectURL(url),
  };
  setShareCache({ blob, filename });

  imgEl.src = url;
  panelEl.hidden = false;
  panelEl.dataset.mode = isMobile() ? 'mobile' : 'desktop';
}

export function sharePreviewKakaoSync() {
  if (!previewState?.file) return { ok: false, reason: 'empty' };
  if (!canShareFile(previewState.file)) return { ok: false, reason: 'unsupported' };
  return { ok: true, file: previewState.file };
}

export function shareCachedKakaoSync() {
  if (!shareCache?.file) return { ok: false, reason: 'empty' };
  if (!canShareFile(shareCache.file)) return { ok: false, reason: 'unsupported' };
  return { ok: true, file: shareCache.file };
}

export function sharePreviewKakaoMessage(result) {
  if (result === 'shared') return { toast: '카카오톡을 선택하세요' };
  if (result === 'downloaded') {
    return { toast: isAndroid() ? '갤러리에 저장됐어요. 카카오톡에서 사진을 보내세요' : '이미지를 저장했어요' };
  }
  return { toast: '길게 눌러 이미지를 저장한 뒤 카카오톡으로 보내세요' };
}

export async function sharePreviewSave() {
  if (!previewState) return null;
  const result = await shareImageBlob(previewState.blob, previewState.filename);
  return sharePreviewKakaoMessage(result);
}

export function getPreviewState() {
  return previewState;
}

export function closeSharePreview(panelEl, imgEl) {
  panelEl.hidden = true;
  imgEl.removeAttribute('src');
  previewState?.revoke?.();
  previewState = null;
}