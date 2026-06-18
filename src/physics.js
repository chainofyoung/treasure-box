import Matter from 'matter-js';
import { drawCapBowl } from './capRenderer.js';
import { trimTransparent } from './trimImage.js';

const { Engine, Render, Runner, Bodies, Body, Composite, Events, Vector } = Matter;

export class TreasureBox {
  constructor(canvas, frameEl) {
    this.canvas = canvas;
    this.frameEl = frameEl;
    this.ctx = canvas.getContext('2d');
    this.items = [];
    this.sprites = new Map();
    this.gravity = { x: 0, y: 1 };
    this.tiltEnabled = false;
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

    this.engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.001 } });
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
    this.sprites.forEach((s) => {
      if (s.type === 'image') URL.revokeObjectURL(s.src);
    });
    this.sprites.clear();
    this.initialized = false;
  }

  _resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.bounds = { x: 0, y: 0, w: rect.width, h: rect.height };

    if (this.walls.length) {
      Composite.remove(this.engine.world, this.walls);
      this.walls = [];
      this._createWalls();
    }
  }

  _getBounds() {
    const { w, h } = this.bounds;
    return { cx: w / 2, cy: h / 2, w, h };
  }

  _createWalls() {
    const { w, h } = this.bounds;
    const thick = 80;
    const opts = {
      isStatic: true,
      friction: 0.4,
      restitution: 0.45,
      render: { visible: false },
    };

    this.walls = [
      Bodies.rectangle(w / 2, h + thick / 2 - 2, w + thick, thick, opts),
      Bodies.rectangle(-thick / 2 + 2, h / 2, thick, h + thick, opts),
      Bodies.rectangle(w + thick / 2 - 2, h / 2, thick, h + thick, opts),
      Bodies.rectangle(w / 2, -thick * 2, w + thick, thick, opts),
    ];

    Composite.add(this.engine.world, this.walls);
  }

  async addTreasure(imageUrl, { restore = false } = {}) {
    const { w, h } = this._getBounds();
    const treasureCount = this.items.filter((b) => b.isTreasure).length;

    if (restore) {
      const x = w * (0.12 + Math.random() * 0.76);
      const y = h * (0.35 + Math.random() * 0.5);
      await this._addBody(
        { type: 'image', src: imageUrl, scale: 0.16 },
        x,
        y,
        { isTreasure: true, dropDelay: 0 },
      );
    } else {
      const x = w * (0.25 + Math.random() * 0.5);
      await this._addBody(
        { type: 'image', src: imageUrl, scale: 0.16 },
        x,
        -100 - treasureCount * 20,
        {
          isTreasure: true,
          dropDelay: performance.now() + 300 + treasureCount * 200,
        },
      );
    }

    return this.items.filter((b) => b.isTreasure).length;
  }

  async _addBody(def, x, y, meta = {}) {
    let size;
    let sprite;

    if (def.type === 'image') {
      const trimmed = await trimTransparent(def.src);
      const img = await this._loadImage(trimmed.dataUrl);
      const aspect = trimmed.aspect;
      const baseH = this.bounds.h * (def.scale || 0.3);
      size = { w: baseH * aspect, h: baseH };
      sprite = { type: 'image', img, ...size };
    }

    const bw = sprite.w * 0.78;
    const bh = sprite.h * 0.78;
    const body = Bodies.rectangle(x, y, bw, bh, {
      restitution: 0.72,
      friction: 0.3,
      frictionAir: 0.015,
      density: 0.002,
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
      this.gravity = { x: 0, y: 1 };
      this.engine.gravity.x = 0;
      this.engine.gravity.y = 1;
    }
  }

  handleOrientation(beta, gamma) {
    if (!this.tiltEnabled) return;
    const gx = Math.max(-1, Math.min(1, (gamma || 0) / 45));
    const gy = Math.max(-1, Math.min(1, ((beta || 0) - 45) / 45));
    this.gravity = { x: gx, y: gy };
    this.engine.gravity.x = gx;
    this.engine.gravity.y = gy;
  }

  _bindEvents() {
    Events.on(this.engine, 'beforeUpdate', () => {
      const now = performance.now();
      this.items.forEach((body) => {
        if (body.dropDelay > 0 && now >= body.dropDelay) {
          Body.setStatic(body, false);
          Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.5, y: 1.5 });
          body.dropDelay = 0;
        }
      });
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

    const kick = 0.07;
    Body.applyForce(body, body.position, Vector.mult(dir, kick));
    Body.setVelocity(body, {
      x: body.velocity.x + dir.x * 10,
      y: body.velocity.y + dir.y * 10 - 6,
    });
    Body.setAngularVelocity(body, body.angularVelocity + (Math.random() - 0.5) * 0.3);
  }

  _applySwipe(px, py, dx, dy) {
    const impulse = Vector.mult(Vector.normalise({ x: dx, y: dy }), 0.04);
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
      ctx.drawImage(sprite.img, -sw / 2, -sh / 2, sw, sh);

      ctx.restore();
    });
  }

  getTreasureCount() {
    return this.items.filter((b) => b.isTreasure).length;
  }
}