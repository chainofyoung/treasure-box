let stream = null;
let paused = false;
let videoElRef = null;
let zoomLevel = 1;
let minZoom = 1;
let maxZoom = 4;
let useCssZoom = true;


function hasLiveStream() {
  return stream?.active && stream.getTracks().some((t) => t.readyState === 'live');
}

function getVideoTrack() {
  return stream?.getVideoTracks()?.[0] || null;
}

function readOpticalZoomRange(track) {
  const caps = track.getCapabilities?.();
  if (!caps?.zoom) return null;
  return {
    min: caps.zoom.min ?? 1,
    max: caps.zoom.max ?? 4,
    step: caps.zoom.step ?? 0.1,
  };
}

async function applyOpticalZoom(track, level) {
  const range = readOpticalZoomRange(track);
  if (!range) return false;
  const z = Math.max(range.min, Math.min(range.max, level));
  await track.applyConstraints({ advanced: [{ zoom: z }] });
  zoomLevel = z;
  minZoom = range.min;
  maxZoom = range.max;
  useCssZoom = false;
  applyCssZoom(1);
  return true;
}

function applyCssZoom(level) {
  if (!videoElRef) return;
  if (level <= 1.001) {
    videoElRef.style.transform = '';
    videoElRef.style.transformOrigin = '';
  } else {
    videoElRef.style.transform = `scale(${level})`;
    videoElRef.style.transformOrigin = 'center center';
  }
}

export function getZoomLevel() {
  return zoomLevel;
}

export function getZoomLabel() {
  return `${zoomLevel.toFixed(1).replace(/\.0$/, '')}×`;
}

export async function setZoom(level) {
  const track = getVideoTrack();
  const next = Math.max(minZoom, Math.min(maxZoom, level));

  if (track && (await applyOpticalZoom(track, next))) {
    return zoomLevel;
  }

  useCssZoom = true;
  zoomLevel = Math.max(1, Math.min(4, next));
  applyCssZoom(zoomLevel);
  return zoomLevel;
}

export function getZoomRatio() {
  if (maxZoom <= minZoom) return 0;
  return (zoomLevel - minZoom) / (maxZoom - minZoom);
}

export function bindZoomPan(stageEl, videoEl, { hintEl } = {}) {
  videoElRef = videoEl;
  let tracking = false;
  let zooming = false;
  let startX = 0;
  let startY = 0;
  let startZoom = 1;
  let pointerId = null;
  let hintTimer = null;

  const showHint = () => {
    if (!hintEl) return;
    hintEl.textContent = getZoomLabel();
    hintEl.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintEl.classList.remove('show'), 750);
  };

  const endGesture = () => {
    tracking = false;
    zooming = false;
    pointerId = null;
  };

  const applyZoom = (clientX) => {
    const dx = clientX - startX;
    setZoom(startZoom + dx * 0.007).then(showHint);
  };

  stageEl.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button, .cam-bottom, .bar-float')) return;
    tracking = true;
    zooming = false;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    startZoom = zoomLevel;
  });

  stageEl.addEventListener('pointermove', (e) => {
    if (!tracking || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!zooming) {
      if (Math.hypot(dx, dy) < 10) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.1) {
        endGesture();
        return;
      }
      zooming = true;
      stageEl.setPointerCapture(pointerId);
    }

    applyZoom(e.clientX);
    e.preventDefault();
  }, { passive: false });

  stageEl.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointerId) return;
    endGesture();
  });

  stageEl.addEventListener('pointercancel', (e) => {
    if (e.pointerId !== pointerId) return;
    endGesture();
  });
}

export async function startCamera(videoEl) {
  videoElRef = videoEl;

  if (hasLiveStream()) {
    if (paused) resumeCamera();
    videoEl.srcObject = stream;
    try {
      await videoEl.play();
    } catch {
      /* ignore */
    }
    return stream;
  }

  stopCamera();

  const constraints = {
    video: {
      facingMode: 'environment',
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
  }

  paused = false;
  const track = getVideoTrack();
  const range = track ? readOpticalZoomRange(track) : null;
  if (range) {
    minZoom = range.min;
    maxZoom = range.max;
    zoomLevel = Math.max(range.min, 1);
    useCssZoom = false;
    try {
      await applyOpticalZoom(track, zoomLevel);
    } catch {
      useCssZoom = true;
      zoomLevel = 1;
    }
  } else {
    useCssZoom = true;
    zoomLevel = 1;
    minZoom = 1;
    maxZoom = 4;
  }
  applyCssZoom(useCssZoom ? zoomLevel : 1);

  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function pauseCamera() {
  if (!stream) return;
  stream.getTracks().forEach((t) => {
    t.enabled = false;
  });
  paused = true;
}

export function resumeCamera() {
  if (!stream) return;
  stream.getTracks().forEach((t) => {
    t.enabled = true;
  });
  paused = false;
}

export function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  paused = false;
  zoomLevel = 1;
  useCssZoom = true;
  applyCssZoom(1);
}

export function capturePhoto(videoEl, canvasEl) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return null;

  const zoom = useCssZoom ? zoomLevel : 1;
  const cropW = vw / zoom;
  const cropH = vh / zoom;
  const sx = (vw - cropW) / 2;
  const sy = (vh - cropH) / 2;

  canvasEl.width = vw;
  canvasEl.height = vh;
  const ctx = canvasEl.getContext('2d');
  ctx.drawImage(videoEl, sx, sy, cropW, cropH, 0, 0, vw, vh);

  return canvasEl.toDataURL('image/jpeg', 0.96);
}