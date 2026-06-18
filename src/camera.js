let stream = null;
let paused = false;

function hasLiveStream() {
  return stream?.active && stream.getTracks().some((t) => t.readyState === 'live');
}

export async function startCamera(videoEl) {
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
}

export function capturePhoto(videoEl, canvasEl) {
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  if (!vw || !vh) return null;

  canvasEl.width = vw;
  canvasEl.height = vh;

  const ctx = canvasEl.getContext('2d');
  ctx.drawImage(videoEl, 0, 0, vw, vh);

  return canvasEl.toDataURL('image/jpeg', 0.96);
}