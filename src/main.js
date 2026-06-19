import { startCamera, stopCamera, pauseCamera, capturePhoto } from './camera.js';
import { removeBg, preloadModels } from './bgRemove.js';
import { ScanReveal } from './scanReveal.js';
import { ScanSweep } from './scanSweep.js';
import { SubjectBorder } from './subjectBorder.js';
import { TreasureBox } from './physics.js';
import { bindButtonFx } from './uiFx.js';
import { initPortalButton } from './portalButton.js';
import { initStaticCrackles } from './staticCrackle.js';
import {
  shareSnapshot,
  shareTreasureItems,
  openSharePreview,
  closeSharePreview,
  sharePreviewKakaoSync,
  shareCachedKakaoSync,
  shareFileNow,
  sharePreviewKakaoMessage,
  sharePreviewSave,
  setShareCache,
  getShareCache,
  getPreviewState,
  shareImageBlob,
} from './share.js';
import { ProcessHud } from './processHud.js';
import { persistTreasure, loadTreasures } from './storage.js';

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
  btnPreviewCamera: document.getElementById('btn-preview-camera'),
  btnPreviewBox: document.getElementById('btn-preview-box'),
  btnPreviewShare: document.getElementById('btn-preview-share'),
  scanSweepCanvas: document.getElementById('scan-sweep'),
  subjectBorder: document.getElementById('subject-border'),
  btnBoxBack: document.getElementById('btn-box-back'),
  btnAddMore: document.getElementById('btn-add-more'),
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
  scanStatus: document.getElementById('scan-status'),
  sharePreview: document.getElementById('share-preview'),
  sharePreviewImg: document.getElementById('share-preview-img'),
  btnShareClose: document.getElementById('btn-share-close'),
  btnShareKakao: document.getElementById('btn-share-kakao'),
  btnShareSave: document.getElementById('btn-share-save'),
  btnShareKakaoDirect: document.getElementById('btn-share-kakao-direct'),
  cameraIntro: document.getElementById('camera-intro'),
  btnCameraAllow: document.getElementById('btn-camera-allow'),
  btnCameraIntroCancel: document.getElementById('btn-camera-intro-cancel'),
  physicsCanvas: document.getElementById('physics-canvas'),
  boxFrame: document.querySelector('.vessel-full'),
  boxCount: document.getElementById('box-count'),
};

const scanReveal = new ScanReveal({
  beam: els.scanBeam,
  cutoutWrap: els.scanCutoutWrap,
  cutoutImg: els.previewCutout,
});

const scanSweep = new ScanSweep(els.scanSweepCanvas, els.scanStage);
const subjectBorder = new SubjectBorder(els.subjectBorder, els.scanStage);
const processHud = new ProcessHud({
  stage: els.scanStage,
  statusEl: els.scanStatus,
});

let previewReady = false;

let currentScreen = 'welcome';
let capturedDataUrl = null;
let transparentCutoutUrl = null;
let previewDisplayUrl = null;
let treasureBox = null;
let isFirstVisit = true;

let processing = false;
let sharePrepareMode = 'snapshot';
const CAMERA_INTRO_KEY = 'camera-intro-ok';
let tiltActivated = false;
let cameraGranted = false;

function waitFrames(count = 2) {
  return new Promise((resolve) => {
    let left = count;
    const step = () => {
      left -= 1;
      if (left <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

if (localStorage.getItem(CAMERA_INTRO_KEY)) cameraGranted = true;

preloadModels().catch(() => {});
bindButtonFx();

const crackles = initStaticCrackles(document.querySelector('.ambient'));

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });
  crackles.setActive(name !== 'box');
  if (name !== 'box') closeShareSheet();
  if (name === 'box' && treasureBox) {
    waitFrames(1).then(() => treasureBox.resize());
  }
  currentScreen = name;
}

function activateTilt() {
  if (!treasureBox || tiltActivated) return;
  tiltActivated = true;

  const onOrient = (e) => {
    treasureBox.handleOrientation(e.beta, e.gamma);
  };

  window.addEventListener('deviceorientation', onOrient);
  treasureBox.setTiltEnabled(true);
}

function requestTiltPermission() {
  const needsPerm =
    typeof DeviceOrientationEvent !== 'undefined'
    && typeof DeviceOrientationEvent.requestPermission === 'function';

  if (!needsPerm) {
    activateTilt();
    return;
  }

  DeviceOrientationEvent.requestPermission()
    .then((state) => {
      if (state === 'granted') activateTilt();
    })
    .catch(() => {});
}

async function ensureBox() {
  if (!treasureBox) {
    treasureBox = new TreasureBox(els.physicsCanvas, els.boxFrame);
    treasureBox.init();
    isFirstVisit = false;
  }
  requestTiltPermission();
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
  sharePrepareMode = 'snapshot';
  prefetchShareImage('snapshot');
}

function prefetchShareImage(mode) {
  sharePrepareMode = mode;
  const run = mode === 'items'
    ? shareTreasureItems(loadTreasures())
    : shareSnapshot(els.boxFrame, els.physicsCanvas);
  run.then((payload) => setShareCache(payload)).catch(() => {});
}

function closeShareSheet() {
  els.shareSheet.hidden = true;
}

function updateMeter(count) {
  if (els.boxCount) els.boxCount.textContent = String(count);
}

function goWelcome() {
  showScreen('welcome');
}

function revokeTransparent() {
  if (transparentCutoutUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(transparentCutoutUrl);
  }
  transparentCutoutUrl = null;
  previewDisplayUrl = null;
}

function needsCameraIntro() {
  return !localStorage.getItem(CAMERA_INTRO_KEY);
}

function openCameraIntro() {
  els.cameraIntro.hidden = false;
}

function closeCameraIntro() {
  els.cameraIntro.hidden = true;
}

async function openCamera(skipIntro = false) {
  if (!skipIntro && !cameraGranted && needsCameraIntro()) {
    openCameraIntro();
    return;
  }

  showScreen('camera');
  preloadModels().catch(() => {});
  try {
    await startCamera(els.video);
    cameraGranted = true;
    localStorage.setItem(CAMERA_INTRO_KEY, '1');
  } catch (err) {
    showScreen(isFirstVisit ? 'welcome' : 'box');
    console.error(err);
  }
}

async function allowCameraAndStart() {
  localStorage.setItem(CAMERA_INTRO_KEY, '1');
  closeCameraIntro();
  await openCamera(true);
}

function handleCapture() {
  const dataUrl = capturePhoto(els.video, els.canvas);
  if (!dataUrl) return;

  revokeTransparent();
  capturedDataUrl = dataUrl;
  pauseCamera();

  els.previewOriginal.src = dataUrl;
  els.previewOriginal.hidden = false;
  previewReady = false;
  screens.preview.classList.remove('scan-complete');
  els.scanStage.classList.remove('scan-done', 'scanning', 'processing');
  els.scanCutoutWrap.classList.remove('revealed');
  els.scanCutoutWrap.style.clipPath = 'inset(0 0 100% 0)';
  scanReveal.reset();
  scanSweep.stop();
  els.scanBeam.hidden = true;
  subjectBorder.hide();
  processHud.reset();

  screens.preview.classList.remove('scan-complete');
  showScreen('preview');
  processCutout(dataUrl);
}

function loadImageSrc(img, src) {
  return new Promise((resolve) => {
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
    if (img.complete && img.naturalWidth > 0) resolve();
  });
}

async function showCutoutResult(cutoutUrl) {
  await loadImageSrc(els.previewCutout, cutoutUrl);
  els.scanCutoutWrap.style.clipPath = 'inset(0)';
  els.scanCutoutWrap.classList.add('revealed');
  els.scanStage.classList.add('scan-done');
  els.scanStage.classList.remove('scanning', 'processing');
  screens.preview.classList.add('scan-complete');
  await subjectBorder.refineFromCutout(cutoutUrl);
}

async function processCutout(dataUrl) {
  if (processing) return;
  processing = true;

  processHud.start();
  scanSweep.start();
  els.scanBeam.hidden = false;
  scanReveal.startLoop();
  els.scanStage.classList.add('scanning', 'processing');

  try {
    const rawCutout = await removeBg(dataUrl, (ratio, key) => {
      processHud.setProgress(ratio, key);
    });
    processHud.setProgress(0.96, 'reveal');
    transparentCutoutUrl = rawCutout;
    previewDisplayUrl = rawCutout;
    scanSweep.stop();
    scanReveal.stop();
    els.scanBeam.hidden = true;
    await showCutoutResult(rawCutout);
    processHud.finish();
    previewReady = true;
  } catch (err) {
    console.warn('Imgly cutout failed:', err);
    transparentCutoutUrl = dataUrl;
    previewDisplayUrl = dataUrl;
    scanSweep.stop();
    scanReveal.stop();
    els.scanBeam.hidden = true;
    await showCutoutResult(dataUrl);
    processHud.finish();
    previewReady = true;
  } finally {
    processing = false;
  }
}

async function addToBox() {
  const imageUrl = transparentCutoutUrl || capturedDataUrl;
  if (!imageUrl) return;

  showScreen('box');
  await ensureBox();
  await waitFrames(2);
  treasureBox.resize();

  let count;
  let dataUrl;
  try {
    ({ count, dataUrl } = await persistTreasure(imageUrl));
  } catch (err) {
    if (err?.code === 'storage-full') {
      showToast('저장 공간이 부족해요. 일부 항목을 지우거나 브라우저 캐시를 비워주세요');
    } else {
      showToast('저장하지 못했어요');
    }
    return;
  }
  await treasureBox.addTreasure(dataUrl);
  updateMeter(count);
  updateShareState(count);

  capturedDataUrl = null;
  revokeTransparent();
  scanReveal.reset();
  scanSweep.stop();
  els.scanBeam.hidden = true;
  subjectBorder.hide();
  processHud.reset();
  previewReady = false;
  screens.preview.classList.remove('scan-complete');
  els.scanStage.classList.remove('scan-done', 'scanning', 'processing');
  els.scanCutoutWrap.classList.remove('revealed');
  els.scanCutoutWrap.style.clipPath = 'inset(0 0 100% 0)';
}

async function openSharePreviewFrom(mode) {
  closeShareSheet();
  prefetchShareImage(mode);
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

function triggerNativeShare(syncResult, fallbackBlob, fallbackName) {
  if (syncResult.ok) {
    shareFileNow(syncResult.file)
      .then(() => showToast(sharePreviewKakaoMessage('shared').toast))
      .catch(async (err) => {
        if (err?.name === 'AbortError') return;
        if (fallbackBlob) {
          const result = await shareImageBlob(fallbackBlob, fallbackName);
          showToast(sharePreviewKakaoMessage(result).toast);
        } else {
          showToast('공유할 수 없어요');
        }
      });
    return;
  }

  if (fallbackBlob) {
    shareImageBlob(fallbackBlob, fallbackName)
      .then((result) => showToast(sharePreviewKakaoMessage(result).toast))
      .catch((err) => {
        if (err?.name !== 'AbortError') showToast('공유할 수 없어요');
      });
  } else {
    showToast('이미지 준비 중이에요. 잠시 후 다시 눌러주세요');
  }
}

function handleKakaoShareClick() {
  const cached = shareCachedKakaoSync();
  if (cached.ok) {
    closeShareSheet();
    triggerNativeShare(cached, getShareCache()?.blob, getShareCache()?.filename);
    return;
  }

  const preview = sharePreviewKakaoSync();
  if (preview.ok) {
    const state = getPreviewState();
    triggerNativeShare(preview, state?.blob, state?.filename);
    return;
  }

  showToast('이미지 준비 중이에요…');
  const run = sharePrepareMode === 'items'
    ? shareTreasureItems(loadTreasures())
    : shareSnapshot(els.boxFrame, els.physicsCanvas);
  run
    .then((payload) => {
      setShareCache(payload);
      const next = shareCachedKakaoSync();
      triggerNativeShare(next, payload.blob, payload.filename);
    })
    .catch(() => showToast('이미지를 만들 수 없어요'));
}

async function runShareSave() {
  try {
    const result = await sharePreviewSave();
    if (result?.toast) showToast(result.toast);
  } catch (err) {
    if (err?.name !== 'AbortError') showToast('저장할 수 없어요');
  }
}

initPortalButton(els.btnStart, () => {
  preloadModels().catch(() => {});
  openCamera();
});
els.btnCameraBack.addEventListener('click', () => {
  pauseCamera();
  showScreen(isFirstVisit ? 'welcome' : 'box');
});
els.btnCapture.addEventListener('click', handleCapture);
function retakePhoto() {
  scanReveal.stop();
  scanSweep.stop();
  els.scanBeam.hidden = true;
  subjectBorder.hide();
  revokeTransparent();
  processHud.reset();
  previewReady = false;
  screens.preview.classList.remove('scan-complete');
  els.scanStage.classList.remove('scan-done', 'scanning', 'processing');
  els.scanCutoutWrap.classList.remove('revealed');
  els.scanCutoutWrap.style.clipPath = 'inset(0 0 100% 0)';
  openCamera(true);
}

async function goToBoxFromPreview() {
  if (previewReady && (transparentCutoutUrl || capturedDataUrl)) {
    await addToBox();
    return;
  }
  if (processing) {
    showToast('스캔 중이에요…');
    return;
  }
  await ensureBox();
  showScreen('box');
}

async function shareFromPreview() {
  if (processing && !previewReady) {
    showToast('스캔 중이에요…');
    return;
  }
  const url = transparentCutoutUrl || capturedDataUrl;
  if (!url) return;

  showToast('이미지 만드는 중…');
  try {
    const payload = await shareTreasureItems([url]);
    openSharePreview({
      blob: payload.blob,
      filename: payload.filename,
      imgEl: els.sharePreviewImg,
      panelEl: els.sharePreview,
    });
  } catch (err) {
    showToast('공유할 수 없어요');
    console.error(err);
  }
}

els.btnPreviewCamera.addEventListener('click', retakePhoto);
els.btnPreviewBox.addEventListener('click', goToBoxFromPreview);
els.btnPreviewShare.addEventListener('click', shareFromPreview);
window.addEventListener('resize', () => {
  scanSweep.resize();
  subjectBorder.resize();
});
els.btnBoxBack.addEventListener('click', goWelcome);
els.btnAddMore.addEventListener('click', () => openCamera(true));
els.btnShare.addEventListener('click', openShareSheet);
els.physicsCanvas.addEventListener('pointerdown', () => {
  if (!tiltActivated) requestTiltPermission();
}, { passive: true });
els.btnShareSnapshot.addEventListener('click', () => openSharePreviewFrom('snapshot'));
els.btnShareItems.addEventListener('click', () => {
  sharePrepareMode = 'items';
  openSharePreviewFrom('items');
});
els.btnShareKakaoDirect.addEventListener('click', () => {
  sharePrepareMode = 'snapshot';
  handleKakaoShareClick();
});
els.btnShareKakao.addEventListener('click', handleKakaoShareClick);
els.btnShareSave.addEventListener('click', runShareSave);
els.btnCameraAllow.addEventListener('click', allowCameraAndStart);
els.btnCameraIntroCancel.addEventListener('click', () => {
  closeCameraIntro();
  showScreen(isFirstVisit ? 'welcome' : 'box');
});
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
    pauseCamera();
  } else if (!document.hidden && currentScreen === 'camera') {
    startCamera(els.video).catch(() => {});
  }
});