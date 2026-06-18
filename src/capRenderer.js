export function drawCapBowl(ctx, w, h) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(12, 18, 32, 0.15)');
  grad.addColorStop(0.5, 'rgba(20, 35, 55, 0.08)');
  grad.addColorStop(1, 'rgba(8, 12, 24, 0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 24; i++) {
    const x = (w * (i * 17 + 11)) % w;
    const y = (h * (i * 23 + 7)) % h;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 2);
    glow.addColorStop(0, 'rgba(160, 200, 230, 0.2)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 3, y - 3, 6, 6);
  }
}