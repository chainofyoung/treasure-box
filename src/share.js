const BG = '#06080f';

function canShareFiles(files) {
  return typeof navigator.share === 'function'
    && typeof navigator.canShare === 'function'
    && navigator.canShare({ files });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export async function captureVesselSnapshot(vesselEl, canvas) {
  const rect = vesselEl.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const out = document.createElement('canvas');
  out.width = Math.ceil(rect.width * dpr);
  out.height = Math.ceil(rect.height * dpr);
  const ctx = out.getContext('2d');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, 0, 0, out.width, out.height);

  return new Promise((resolve, reject) => {
    out.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('capture failed'));
    }, 'image/png');
  });
}

async function dataUrlsToFiles(urls) {
  const files = [];
  for (let i = 0; i < urls.length; i++) {
    const res = await fetch(urls[i]);
    const blob = await res.blob();
    files.push(new File([blob], `채집-${i + 1}.png`, { type: 'image/png' }));
  }
  return files;
}

async function tryShareFiles(files, title) {
  if (!canShareFiles(files)) return null;
  await navigator.share({ title, files });
  return 'shared';
}

export async function shareSnapshot(vesselEl, canvas) {
  const blob = await captureVesselSnapshot(vesselEl, canvas);
  const file = new File([blob], `채집-상자-${stamp()}.png`, { type: 'image/png' });

  const shared = await tryShareFiles([file], '채집');
  if (shared) return shared;

  downloadBlob(blob, file.name);
  return 'downloaded';
}

export async function shareTreasureItems(urls) {
  if (!urls.length) throw new Error('empty');

  const files = await dataUrlsToFiles(urls);
  const shared = await tryShareFiles(files, '채집');
  if (shared) return shared;

  if (files.length === 1) {
    downloadBlob(files[0], files[0].name);
    return 'downloaded';
  }

  for (const file of files) {
    downloadBlob(file, file.name);
    await new Promise((r) => setTimeout(r, 180));
  }
  return 'downloaded-many';
}