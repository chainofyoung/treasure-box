import Matter from 'matter-js';
import { drawCapBowl } from './capRenderer.js';
import { trimTransparent } from './trimImage.js';
import { buildBorderLayer, drawBorderOnContext } from './borderRing.js';

const { Engine, Runner, Bodies, Body, Composite, Events, Vector } = Matter;

const GRAVITY_STRENGTH = 1.05;
const GRAVITY_SCALE = 0.0017;
const MAX_SPEED = 16;
const CEILING_Y = 52;

export class TreasureBox {
  constructor(canvas, frameEl) {
    this.canvas = canvas;
    this.frameEl = frameEl;
    this.ctx = canvas.getContext('2d');
    this.items = [];
    this.sprites = new Map();
    this.gravity = { x: 0, y: GRAVITY_STRENGTH };
    this.tiltEnabled = true;
    this.bounds = { x: 0, y: 0, w: 0, h: 0 };
    this.walls = [];
    this.initialized = false;
    this._resizeObserver = null;
    this._touchStart = null;
  }

  init() {
    if (this.initialized) {
      this._resize();
      return;
    }

    this.engine = Engine.create({
      gravity: { x: 0, y: GRAVITY_STRENGTH, scale: GRAVITY_SCALE },
    });
    this.runner = Runner.create();
    this._resize();
    this._createWalls();
    this._bindEvents();
    this._startLoop();

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(this.frameEl);

    this.initialized = true;
  }

  destroy() {
    if (!this.initialized) return;
    Runner.stop(this.runner);
    Events.off(this.engine);
    this._resizeObserver?.disconnect();
    this.sprites.clear();
    this.initialized = false;
  }

  resize() {
    if (!this.initialized) return;
    this._resize();
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, rect.width * dpr);
    this.canvas.height = Math.max(1, rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.bounds = { x: 0, y: 0, w: rect.width, h: rect.height };

    if (this.walls.length) {
      Composite.remove(this.engine.world, this.walls);
      this.walls = [];
      this._createWalls();
    }
  }

  async _ensureBounds() {
    if (this.bounds.h > 1) return;
    this._resize();
    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        this._resize();
        resolve();
      });
    });
  }

  _getBounds() {
    const { w, h } = this.bounds;
    return { cx: w / 2, cy: h / 2, w, h };
  }

  _createWalls() {
    const { w, h } = this.bounds;
    const thick = 120;
    const opts = {
      isStatic: true,
      friction: 0.4,
      restitution: 0.35,
      render: { visible: false },
    };

    this.walls = [
      Bodies.rectangle(w / 2, h + thick / 2 - 2, w + thick * 2, thick, opts),
      Bodies.rectangle(-thick / 2 + 2, h / 2, thick, h + thick * 2, opts),
      Bodies.rectangle(w + thick / 2 - 2, h / 2, thick, h + thick * 2, opts),
      Bodies.rectangle(w / 2, -thick / 2 + CEILING_Y * 0.35, w + thick * 2, thick, opts),
    ];

    Composite.add(this.engine.world, this.walls);
  }

  _ceilingY() {
    return CEILING_Y;
  }

  async addTreasure(imageUrl, { restore = false } = {}) {
    await this._ensureBounds();
    const { w, h } = this._getBounds();
    const treasureCount = this.items.filter((b) => b.isTreasure).length;
    const ceiling = this._ceilingY();

    if (restore) {
      const x = w * (0.12 + (treasureCount % 6) * 0.14);
      const y = ceiling + (treasureCount % 4) * 16;
      await this._addBody(
        { type: 'image', src: imageUrl, scale: 0.16 },
        x,
        y,
        { isTreasure: true, dropDelay: 0 },
      );
    } else {
      const x = w * (0.14 + Math.random() * 0.72);
      const y = ceiling + (treasureCount % 5) * 14;
      const body = await this._addBody(
        { type: 'image', src: imageUrl, scale: 0.16 },
        x,
        y,
        { isTreasure: true, dropDelay: 0 },
      );
      Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 0.5,
        y: 0.15 + Math.random() * 0.35,
      });
    }

    return this.items.filter((b) => b.isTreasure).length;
  }

  async _addBody(def, x, y, meta = {}) {
    let sprite;

    if (def.type === 'image') {
      const trimmed = await trimTransparent(def.src);
      const img = await this._loadImage(trimmed.dataUrl);
      const aspect = trimmed.aspect;
      const baseH = this.bounds.h * (def.scale || 0.3);
      const borderLayer = buildBorderLayer(img);
      sprite = {
        type: 'image',
        img,
        borderLayer,
        w: baseH * aspect,
        h: baseH,
      };
    }

    const bw = sprite.w * 0.78;
    const bh = sprite.h * 0.78;
    const body = Bodies.rectangle(x, y, bw, bh, {
      restitution: 0.5,
      friction: 0.4,
      frictionAir: 0.012,
      density: 0.0024,
      label: 'treasure',
      chamfer: { radius: Math.min(bw, bh) * 0.18 },
    });

    body.sprite = sprite;
    body.isTreasure = true;
    body.dropDelay = meta.dropDelay ?? 0;
    body._spawnY = y;

    if (body.dropDelay > 0) {
      Body.setStatic(body, true);
    }

    this.sprites.set(body.id, sprite);
    Composite.add(this.engine.world, body);
    this.items.push(body);

    return body;
  }

  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  setTiltEnabled(enabled) {
    this.tiltEnabled = enabled;
    if (!enabled) {
      this.gravity = { x: 0, y: GRAVITY_STRENGTH };
      this.engine.gravity.x = 0;
      this.engine.gravity.y = GRAVITY_STRENGTH;
    }
  }

  handleOrientation(beta, gamma) {
    if (!this.tiltEnabled) return;
    const gx = Math.max(-1.3, Math.min(1.3, (gamma || 0) / 36));
    const gy = Math.max(-1.3, Math.min(1.3, ((beta || 0) - 45) / 36));
    this.gravity = { x: gx * GRAVITY_STRENGTH, y: gy * GRAVITY_STRENGTH };
    this.engine.gravity.x = gx * GRAVITY_STRENGTH;
    this.engine.gravity.y = gy * GRAVITY_STRENGTH;
  }

  /**
   * 객체가 "사라지는" 것처럼 보이는 이유:
   * 삭제되지 않고 화면 밖(특히 천장 위·좌우 벽 밖)으로 튕겨 나가면
   * 캔버스 밖에서만 그려지기 때문이다. 아래에서 위치·속도를 제한한다.
   */
  _keepBodiesInView() {
    const { w, h } = this.bounds;
    if (w < 1 || h < 1) return;

    const ceiling = this._ceilingY();

    this.items.forEach((body) => {
      const sprite = body.sprite;
      if (!sprite) return;

      const halfW = sprite.w * 0.4;
      const halfH = sprite.h * 0.4;
      const minX = halfW + 6;
      const maxX = w - halfW - 6;
      const minY = ceiling;
      const maxY = h - halfH - 8;

      let { x, y } = body.position;
      let vx = body.velocity.x;
      let vy = body.velocity.y;
      let clamped = false;

      if (x < minX) {
        x = minX;
        vx = Math.abs(vx) * 0.3;
        clamped = true;
      } else if (x > maxX) {
        x = maxX;
        vx = -Math.abs(vx) * 0.3;
        clamped = true;
      }

      if (y < minY) {
        y = minY;
        vy = Math.abs(vy) * 0.25;
        clamped = true;
      } else if (y > maxY) {
        y = maxY;
        vy = -Math.abs(vy) * 0.3;
        clamped = true;
      }

      if (clamped) {
        Body.setPosition(body, { x, y });
        Body.setVelocity(body, { x: vx, y: vy });
      }

      const speed = Vector.magnitude(body.velocity);
      if (speed > MAX_SPEED) {
        Body.setVelocity(body, Vector.mult(Vector.normalise(body.velocity), MAX_SPEED));
      }
    });
  }

  _bindEvents() {
    Events.on(this.engine, 'beforeUpdate', () => {
      const now = performance.now();
      this.items.forEach((body) => {
        if (body.dropDelay > 0 && now >= body.dropDelay) {
          Body.setStatic(body, false);
          Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.5, y: 0.4 });
          body.dropDelay = 0;
        }
      });
      this._keepBodiesInView();
    });

    this.canvas.addEventListener('pointerdown', (e) => {
      this._touchStart = { x: e.clientX, y: e.clientY, t: Date.now() };
      const rect = this.canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;

      const hit = this._findBodyAt(px, py);
      if (hit) {
        this._bounceBody(hit, px, py);
      }
    });

    this.canvas.addEventListener('pointerup', (e) => {
      if (!this._touchStart) return;
      const rect = this.canvas.getBoundingClientRect();
      const dx = e.clientX - this._touchStart.x;
      const dy = e.clientY - this._touchStart.y;
      const dt = Date.now() - this._touchStart.t;
      if (dt < 400 && (Math.abs(dx) > 20 || Math.abs(dy) > 20)) {
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        this._applySwipe(px, py, dx, dy);
      }
      this._touchStart = null;
    });
  }

  _findBodyAt(px, py) {
    let hit = null;
    let minDist = Infinity;

    for (const body of this.items) {
      const sprite = body.sprite;
      if (!sprite) continue;
      const dist = Vector.magnitude(Vector.sub(body.position, { x: px, y: py }));
      const radius = Math.max(sprite.w, sprite.h) * 0.42 + 12;
      if (dist < radius && dist < minDist) {
        minDist = dist;
        hit = body;
      }
    }
    return hit;
  }

  _bounceBody(body, px, py) {
    const diff = Vector.sub(body.position, { x: px, y: py });
    const dir = Vector.magnitude(diff) > 0.1
      ? Vector.normalise(diff)
      : { x: (Math.random() - 0.5), y: -1 };

    const kick = 0.05;
    Body.applyForce(body, body.position, Vector.mult(dir, kick));
    Body.setVelocity(body, {
      x: body.velocity.x + dir.x * 6,
      y: body.velocity.y + dir.y * 6 - 3,
    });
    Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.2);
  }

  _applySwipe(px, py, dx, dy) {
    const impulse = Vector.mult(Vector.normalise({ x: dx, y: dy }), 0.028);
    this.items.forEach((body) => {
      const dist = Vector.magnitude(Vector.sub(body.position, { x: px, y: py }));
      if (dist < 150) {
        Body.applyForce(body, body.position, impulse);
      }
    });
  }

  _startLoop() {
    const render = () => {
      this._draw();
      requestAnimationFrame(render);
    };
    Runner.run(this.runner, this.engine);
    render();
  }

  _draw() {
    const { w, h } = this.bounds;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, w, h);
    drawCapBowl(ctx, w, h);

    this.items.forEach((body) => {
      const sprite = body.sprite;
      if (!sprite) return;

      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);

      const sw = sprite.w;
      const sh = sprite.h;

      if (sprite.borderLayer) {
        drawBorderOnContext(ctx, sprite.borderLayer, 0, 0, sw, sh);
      }
      ctx.drawImage(sprite.img, -sw / 2, -sh / 2, sw, sh);

      ctx.restore();
    });
  }

  getTreasureCount() {
    return this.items.filter((b) => b.isTreasure).length;
  }
}