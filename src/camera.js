let stream = null;

export async function startCamera(videoEl) {
  stopCamera();

  const constraints = {
    video: {
      facingMode: { ideal: 'environment' },
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

  videoEl.srcObject = stream;
  await videoEl.play();
  return stream;
}

export function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
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