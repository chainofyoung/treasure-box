const BG = '#06080f';

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
}

function blobToFile(blob, filename) {
  const type = blob.type || 'image/jpeg';
  const ext = type.includes('png') ? 'png' : 'jpg';
  const name = filename.includes('.') ? filename : `${filename}.${ext}`;
  return new File([blob], name, { type, lastModified: Date.now() });
}

function downloadBlob(blob, filename) {
  const file = blobToFile(blob, filename);
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

export async function shareImageBlob(blob, filename) {
  const file = blobToFile(blob, filename);

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ files: [file], title: '채집' });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
    }
  }

  if (isMobile()) {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (opened) {
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return 'opened';
    }
    URL.revokeObjectURL(url);
  }

  downloadBlob(blob, file.name);
  return 'downloaded';
}

export async function saveImageBlob(blob, filename) {
  return shareImageBlob(blob, filename);
}

export async function shareSnapshot(vesselEl, canvas) {
  const blob = await captureVesselSnapshot(vesselEl, canvas);
  return {
    blob,
    filename: `채집-상자-${stamp()}`,
  };
}

export async function shareTreasureItems(urls) {
  if (!urls.length) throw new Error('empty');
  const blob = await prepareItemShareBlob(urls);
  return {
    blob,
    filename: urls.length === 1 ? `채집-${stamp()}` : `채집-모음-${stamp()}`,
  };
}

let previewState = null;

export function openSharePreview({ blob, filename, imgEl, panelEl }) {
  const url = URL.createObjectURL(blob);
  previewState?.revoke?.();
  previewState = { blob, filename, url, revoke: () => URL.revokeObjectURL(url) };

  imgEl.src = url;
  panelEl.hidden = false;
  panelEl.dataset.mode = isMobile() ? 'mobile' : 'desktop';
}

export async function sharePreviewKakao() {
  if (!previewState) return null;
  const result = await shareImageBlob(previewState.blob, previewState.filename);
  if (result === 'shared') return { toast: '카카오톡을 선택하세요' };
  if (result === 'opened') return { toast: '길게 눌러 저장 후 카카오톡으로 보내세요' };
  return { toast: '이미지를 저장했어요' };
}

export async function sharePreviewSave() {
  if (!previewState) return null;
  const result = await shareImageBlob(previewState.blob, previewState.filename);
  if (result === 'shared') return { toast: '저장 메뉴를 선택하세요' };
  if (result === 'opened') return { toast: '길게 눌러 사진 앨범에 저장하세요' };
  return { toast: '이미지를 저장했어요' };
}

export function closeSharePreview(panelEl, imgEl) {
  panelEl.hidden = true;
  imgEl.removeAttribute('src');
  previewState?.revoke?.();
  previewState = null;
}