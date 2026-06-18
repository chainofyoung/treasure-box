import { startCamera, stopCamera, capturePhoto } from './camera.js';
import { removeBg, preloadModels } from './bgRemove.js';
import { flattenOnBackground } from './flatten.js';
import { ScanReveal } from './scanReveal.js';
import { TreasureBox } from './physics.js';
import { bindButtonFx } from './uiFx.js';
import { initPortalButton } from './portalButton.js';
import { initStaticCrackles } from './staticCrackle.js';
import {
  shareSnapshot,
  shareTreasureItems,
  openSharePreview,
  closeSharePreview,
  sharePreviewKakao,
  sharePreviewSave,
} from './share.js';
import { ProcessHud } from './processHud.js';
import { persistTreasure, loadTreasures, clearTreasures } from './storage.js';

const screens = {
  welcome: document.getElementById('screen-welcome'),
  camera: document.getElementById('screen-camera'),
  preview: document.getElementById('screen-preview'),
  box: document.getElementById('screen-box'),
};

const els = {
  btnStart: document.getElementById('btn-start'),
  btnCameraBack: document.getElementById('btn-camera-back'),
  btnCapture: document.getElementById('btn-capture'),
  btnRetake: document.getElementById('btn-retake'),
  btnAddToBox: document.getElementById('btn-add-to-box'),
  btnBoxBack: document.getElementById('btn-box-back'),
  btnAddMore: document.getElementById('btn-add-more'),
  btnEnableTilt: document.getElementById('btn-enable-tilt'),
  btnShare: document.getElementById('btn-share'),
  shareSheet: document.getElementById('share-sheet'),
  btnShareSnapshot: document.getElementById('btn-share-snapshot'),
  btnShareItems: document.getElementById('btn-share-items'),
  toast: document.getElementById('toast'),
  video: document.getElementById('camera-video'),
  canvas: document.getElementById('camera-canvas'),
  previewOriginal: document.getElementById('preview-original'),
  previewCutout: document.getElementById('preview-cutout'),
  scanStage: document.querySelector('.scan-stage'),
  scanCutoutWrap: document.getElementById('scan-cutout-wrap'),
  scanBeam: document.getElementById('scan-beam'),
  scanHud: document.getElementById('scan-hud'),
  scanStatus: document.getElementById('scan-status'),
  scanProgressBar: document.getElementById('scan-progress-bar'),
  scanHudRing: document.getElementById('scan-hud-ring'),
  sharePreview: document.getElementById('share-preview'),
  sharePreviewImg: document.getElementById('share-preview-img'),
  btnShareClose: document.getElementById('btn-share-close'),
  btnShareKakao: document.getElementById('btn-share-kakao'),
  btnShareSave: document.getElementById('btn-share-save'),
  physicsCanvas: document.getElementById('physics-canvas'),
  boxFrame: document.querySelector('.vessel-full'),
  itemCount: document.querySelector('.meter-fill'),
  tiltHint: document.getElementById('tilt-hint'),
};

const scanReveal = new ScanReveal({
  beam: els.scanBeam,
  cutoutWrap: els.scanCutoutWrap,
  cutoutImg: els.previewCutout,
});

const processHud = new ProcessHud({
  stage: els.scanStage,
  statusEl: els.scanStatus,
  barEl: els.scanProgressBar,
  ringEl: els.scanHudRing,
});

let currentScreen = 'welcome';
let capturedDataUrl = null;
let transparentCutoutUrl = null;
let previewDisplayUrl = null;
let treasureBox = null;
let isFirstVisit = true;
let resetTap = 0;
let processing = false;

preloadModels().catch(() => {});
bindButtonFx();

const crackles = initStaticCrackles(document.querySelector('.ambient'));

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
  crackles.setActive(name !== 'box');
  if (name !== 'box') closeShareSheet();
  currentScreen = name;
}

async function ensureBox() {
  if (!treasureBox) {
    treasureBox = new TreasureBox(els.physicsCanvas, els.boxFrame);
    treasureBox.init();
    isFirstVisit = false;
  }
}

async function restoreCollection() {
  const saved = loadTreasures();
  if (!saved.length) return;

  showScreen('box');
  await ensureBox();

  for (const url of saved) {
    await treasureBox.addTreasure(url, { restore: true });
  }
  updateMeter(saved.length);
  updateShareState(saved.length);
}

restoreCollection().catch(console.error);

function showToast(message) {
  if (!els.toast) return;
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => els.toast.classList.remove('show'), 2200);
}

function updateShareState(count) {
  if (els.btnShare) {
    els.btnShare.disabled = count < 1;
  }
}

function openShareSheet() {
  if (!loadTreasures().length) return;
  els.shareSheet.hidden = false;
}

function closeShareSheet() {
  els.shareSheet.hidden = true;
}

function updateMeter(count) {
  const pct = Math.min(100, count * 14);
  els.itemCount.style.width = `${pct}%`;
}

function revokeTransparent() {
  if (transparentCutoutUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(transparentCutoutUrl);
  }
  transparentCutoutUrl = null;
  previewDisplayUrl = null;
}

async function openCamera() {
  showScreen('camera');
  preloadModels().catch(() => {});
  try {
    await startCamera(els.video);
  } catch (err) {
    showScreen(isFirstVisit ? 'welcome' : 'box');
    console.error(err);
  }
}

function handleCapture() {
  const dataUrl = capturePhoto(els.video, els.canvas);
  if (!dataUrl) return;

  revokeTransparent();
  capturedDataUrl = dataUrl;
  stopCamera();

  els.previewOriginal.src = dataUrl;
  els.previewOriginal.hidden = false;
  els.btnAddToBox.disabled = true;
  els.scanStage.classList.remove('scan-done', 'scanning', 'processing');
  els.scanCutoutWrap.classList.remove('revealed');
  scanReveal.reset();
  processHud.reset();
  els.scanHud.hidden = false;

  showScreen('preview');
  processCutout(dataUrl);
}

const SHARP_HOLD_MS = 850;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processCutout(dataUrl) {
  if (processing) return;
  processing = true;

  processHud.start();
  scanReveal.startLoop();

  const cutoutPromise = removeBg(dataUrl, (ratio, key) => {
    processHud.setProgress(ratio, key);
    scanReveal.setProgress(ratio);
  });

  await delay(SHARP_HOLD_MS);

  try {
    const rawCutout = await cutoutPromise;
    processHud.setProgress(0.94, 'compose');
    transparentCutoutUrl = rawCutout;
    previewDisplayUrl = await flattenOnBackground(rawCutout);
    processHud.setProgress(0.98, 'reveal');
    await scanReveal.reveal(previewDisplayUrl);
    processHud.finish();
    els.scanStage.classList.add('scan-done');
    els.scanCutoutWrap.classList.add('revealed');
    els.scanHud.hidden = true;
    els.btnAddToBox.disabled = false;
  } catch (err) {
    console.warn('Imgly cutout failed:', err);
    transparentCutoutUrl = dataUrl;
    previewDisplayUrl = dataUrl;
    await scanReveal.reveal(dataUrl);
    processHud.finish();
    els.scanStage.classList.add('scan-done');
    els.scanCutoutWrap.classList.add('revealed');
    els.scanHud.hidden = true;
    els.btnAddToBox.disabled = false;
  } finally {
    processing = false;
  }
}

async function addToBox() {
  const imageUrl = transparentCutoutUrl || capturedDataUrl;
  if (!imageUrl) return;

  showScreen('box');
  await ensureBox();

  const { count, dataUrl } = await persistTreasure(imageUrl);
  await treasureBox.addTreasure(dataUrl);
  updateMeter(count);
  updateShareState(count);

  capturedDataUrl = null;
  revokeTransparent();
  scanReveal.reset();
  processHud.reset();
  els.scanHud.hidden = true;
  els.scanStage.classList.remove('scan-done', 'scanning', 'processing');
  els.scanCutoutWrap.classList.remove('revealed');
}

function enableTilt() {
  const requestPerm =
    typeof DeviceOrientationEvent !== 'undefined' &&
    typeof DeviceOrientationEvent.requestPermission === 'function';

  const onOrient = (e) => {
    treasureBox?.handleOrientation(e.beta, e.gamma);
    els.tiltHint.classList.add('hidden');
  };

  const activate = () => {
    window.addEventListener('deviceorientation', onOrient);
    treasureBox?.setTiltEnabled(true);
    els.btnEnableTilt.classList.add('on');
  };

  if (requestPerm) {
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === 'granted') activate();
      })
      .catch(console.error);
  } else {
    activate();
  }
}

function tryReset() {
  resetTap += 1;
  if (resetTap < 2) {
    setTimeout(() => { resetTap = 0; }, 600);
    return;
  }
  resetTap = 0;
  clearTreasures();
  treasureBox?.destroy();
  treasureBox = null;
  isFirstVisit = true;
  updateMeter(0);
  updateShareState(0);
  showScreen('welcome');
}

async function openSharePreviewFrom(mode) {
  closeShareSheet();
  showToast('이미지 만드는 중…');

  try {
    const payload = mode === 'items'
      ? await shareTreasureItems(loadTreasures())
      : await shareSnapshot(els.boxFrame, els.physicsCanvas);

    openSharePreview({
      blob: payload.blob,
      filename: payload.filename,
      imgEl: els.sharePreviewImg,
      panelEl: els.sharePreview,
    });
  } catch (err) {
    showToast('이미지를 만들 수 없어요');
    console.error(err);
  }
}

async function runShareAction(action) {
  try {
    const result = await action();
    if (result?.toast) showToast(result.toast);
  } catch (err) {
    if (err?.name !== 'AbortError') {
      showToast('공유할 수 없어요');
      console.error(err);
    }
  }
}

initPortalButton(els.btnStart, () => {
  preloadModels().catch(() => {});
  openCamera();
});
els.btnCameraBack.addEventListener('click', () => {
  stopCamera();
  showScreen(isFirstVisit ? 'welcome' : 'box');
});
els.btnCapture.addEventListener('click', handleCapture);
els.btnRetake.addEventListener('click', () => {
  scanReveal.stop();
  revokeTransparent();
  processHud.reset();
  els.scanHud.hidden = true;
  els.scanStage.classList.remove('scan-done', 'scanning', 'processing');
  els.scanCutoutWrap.classList.remove('revealed');
  openCamera();
});
els.btnAddToBox.addEventListener('click', addToBox);
els.btnBoxBack.addEventListener('click', tryReset);
els.btnAddMore.addEventListener('click', openCamera);
els.btnEnableTilt.addEventListener('click', enableTilt);
els.btnShare.addEventListener('click', openShareSheet);
els.btnShareSnapshot.addEventListener('click', () => openSharePreviewFrom('snapshot'));
els.btnShareItems.addEventListener('click', () => openSharePreviewFrom('items'));
els.btnShareKakao.addEventListener('click', () => runShareAction(sharePreviewKakao));
els.btnShareSave.addEventListener('click', () => runShareAction(sharePreviewSave));
els.btnShareClose.addEventListener('click', () => {
  closeSharePreview(els.sharePreview, els.sharePreviewImg);
});
els.shareSheet.addEventListener('click', (e) => {
  if (e.target === els.shareSheet) closeShareSheet();
});
els.sharePreview.addEventListener('click', (e) => {
  if (e.target === els.sharePreview) {
    closeSharePreview(els.sharePreview, els.sharePreviewImg);
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && currentScreen === 'camera') {
    stopCamera();
  }
});