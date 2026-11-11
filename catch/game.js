(() => {
  'use strict';

  const W = 480, H = 640;
  const WIN_SCORE = 50, MAX_MISSES = 3, MAX_CARROTS = 3;
  const BASKET_W = 90, BASKET_H = 40, BASKET_Y = H - 60, KEY_SPEED = 420;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), overlayTitle = $('overlay-title'), overlayText = $('overlay-text'), startBtn = $('start');
  const scoreEl = $('score'), missesEl = $('misses'), carrotsEl = $('carrots');

  // Brand colors come from style.css so the palette has one source of truth.
  const css = getComputedStyle(document.documentElement);
  const c = (name) => css.getPropertyValue(name).trim();
  const C = {
    yukon: c('--yukon'), yukonLight: c('--yukon-light'), yukonDark: c('--yukon-dark'),
    russet: c('--russet'), russetLight: c('--russet-light'), russetDark: c('--russet-dark'),
    cream: c('--cream'), carrot: c('--carrot'), carrotTop: c('--carrot-top'),
  };

  const rand = (a, b) => a + Math.random() * (b - a);

  // weight, half-width, half-height, speed range, points
  const TYPES = [
    { kind: 'russet', weight: 40, rx: 17, ry: 12, speed: [150, 260], points: 1 },
    { kind: 'yukon', weight: 35, rx: 17, ry: 12, speed: [150, 260], points: 1 },
    { kind: 'golden', weight: 10, rx: 10, ry: 7, speed: [280, 400], points: 3 },
    { kind: 'carrot', weight: 15, rx: 9, ry: 22, speed: [150, 280], points: 0 },
  ];
  const TOTAL_WEIGHT = TYPES.reduce((s, t) => s + t.weight, 0);

  function pickType() {
    let r = Math.random() * TOTAL_WEIGHT;
    for (const t of TYPES) { if ((r -= t.weight) < 0) return t; }
    return TYPES[0];
  }

  let state, running = false, last = 0;
  const keys = { left: false, right: false };

  function reset() {
    state = {
      basketX: W / 2, score: 0, misses: 0, carrots: 0,
      items: [], spawnIn: 0.5,
    };
    updateHud();
  }

  function spawn() {
    const t = pickType();
    state.items.push({
      t, x: rand(t.rx + 4, W - t.rx - 4), y: -t.ry,
      vy: rand(t.speed[0], t.speed[1]), rot: rand(-0.4, 0.4),
    });
  }

  let hudCache = '';
  function updateHud() {
    const key = `${state.score}|${state.misses}|${state.carrots}`;
    if (key === hudCache) return;
    hudCache = key;
    scoreEl.textContent = state.score;
    missesEl.textContent = state.misses;
    carrotsEl.textContent = state.carrots;
  }

  function end(title, text) {
    running = false;
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    startBtn.textContent = 'Play again';
    overlay.hidden = false;
    startBtn.focus();
  }

  function update(dt) {
    const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
    state.basketX += dir * KEY_SPEED * dt;
    state.basketX = Math.max(BASKET_W / 2, Math.min(W - BASKET_W / 2, state.basketX));

    state.spawnIn -= dt;
    if (state.spawnIn <= 0) { spawn(); state.spawnIn = rand(0.7, 1.1); }

    const left = state.basketX - BASKET_W / 2, right = state.basketX + BASKET_W / 2;
    const remaining = [];
    for (const it of state.items) {
      const prevBottom = it.y + it.t.ry;
      it.y += it.vy * dt;
      const bottom = it.y + it.t.ry;

      if (prevBottom < BASKET_Y && bottom >= BASKET_Y && it.x >= left && it.x <= right) {
        if (it.t.kind === 'carrot') state.carrots++;
        else state.score += it.t.points;
        continue;
      }
      if (it.y - it.t.ry > H) {
        if (it.t.kind !== 'carrot') state.misses++;
        continue;
      }
      remaining.push(it);
    }
    state.items = remaining;
    updateHud();

    if (state.score >= WIN_SCORE) end('You win!', `${state.score} points. Bill is proud of you.`);
    else if (state.carrots >= MAX_CARROTS) end('Game over', 'We do not sell carrots.');
    else if (state.misses >= MAX_MISSES) end('Game over', 'Too many potatoes hit the dirt.');
  }

  // ---- Drawing ----
  function drawPotato(it) {
    const { rx, ry, kind } = it.t;
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot);
    const fill = kind === 'russet' ? C.russet : kind === 'golden' ? C.yukonLight : C.yukon;
    const edge = kind === 'russet' ? C.russetDark : C.yukonDark;
    const g = ctx.createRadialGradient(-rx * 0.4, -ry * 0.4, 1, 0, 0, rx);
    g.addColorStop(0, kind === 'russet' ? C.russetLight : C.yukonLight);
    g.addColorStop(1, fill);
    ctx.fillStyle = g;
    ctx.strokeStyle = edge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = edge;
    for (const [ex, ey] of [[-0.45, -0.2], [0.3, 0.35], [0.5, -0.4]]) {
      ctx.beginPath();
      ctx.ellipse(ex * rx, ey * ry, Math.max(1, rx * 0.08), Math.max(0.8, ry * 0.08), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (kind === 'golden') {
      ctx.strokeStyle = 'rgba(255,255,255,.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-rx * 0.2, -ry * 0.1, rx * 0.55, Math.PI * 1.1, Math.PI * 1.5);
      ctx.stroke();
      // sparkle
      const s = 3 + Math.sin(performance.now() / 120) * 1.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(rx * 0.7 - s / 2, -ry - 2, s, 1.5);
      ctx.fillRect(rx * 0.7 - 0.75, -ry - 2 - s / 2 + 0.75, 1.5, s);
    }
    ctx.restore();
  }

  function drawCarrot(it) {
    const { rx, ry } = it.t;
    ctx.save();
    ctx.translate(it.x, it.y);
    ctx.rotate(it.rot);
    ctx.fillStyle = C.carrot;
    ctx.beginPath();
    ctx.moveTo(-rx, -ry + 8);
    ctx.lineTo(rx, -ry + 8);
    ctx.lineTo(0, ry);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.2)';
    ctx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const y = -ry + 8 + i * 8;
      ctx.beginPath();
      ctx.moveTo(-rx * 0.6 + i * 1.5, y);
      ctx.lineTo(-rx * 0.1, y);
      ctx.stroke();
    }
    ctx.fillStyle = C.carrotTop;
    for (const a of [-0.5, 0, 0.5]) {
      ctx.save();
      ctx.translate(0, -ry + 8);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(0, -6, 2.5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawBasket() {
    const x = state.basketX, top = BASKET_Y, half = BASKET_W / 2;
    ctx.fillStyle = C.russet;
    ctx.beginPath();
    ctx.moveTo(x - half, top);
    ctx.lineTo(x + half, top);
    ctx.lineTo(x + half - 12, top + BASKET_H);
    ctx.lineTo(x - half + 12, top + BASKET_H);
    ctx.closePath();
    ctx.fill();

    // weave
    ctx.strokeStyle = C.russetDark;
    ctx.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      const y = top + (BASKET_H / 4) * i, inset = (12 * i) / 4;
      ctx.beginPath();
      ctx.moveTo(x - half + inset, y);
      ctx.lineTo(x + half - inset, y);
      ctx.stroke();
    }
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 12, top);
      ctx.lineTo(x + i * 10, top + BASKET_H);
      ctx.stroke();
    }
    // rim
    ctx.fillStyle = C.russetDark;
    ctx.fillRect(x - half - 4, top - 5, BASKET_W + 8, 7);
  }

  function draw() {
    ctx.fillStyle = C.cream;
    ctx.fillRect(0, 0, W, H);
    // dirt
    ctx.fillStyle = C.russetLight;
    ctx.fillRect(0, H - 16, W, 16);
    ctx.fillStyle = C.russetDark;
    ctx.fillRect(0, H - 16, W, 3);

    for (const it of state.items) {
      if (it.t.kind === 'carrot') drawCarrot(it); else drawPotato(it);
    }
    drawBasket();
  }

  // ---- Loop ----
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    if (running) requestAnimationFrame(frame);
  }

  function start() {
    reset();
    overlay.hidden = true;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  // ---- Canvas sizing ----
  function setupCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  // ---- Input ----
  canvas.addEventListener('pointermove', (e) => {
    if (!running) return;
    const rect = canvas.getBoundingClientRect();
    state.basketX = ((e.clientX - rect.left) / rect.width) * W;
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (running) canvas.setPointerCapture(e.pointerId);
  });

  const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  window.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.key];
    if (k) { keys[k] = true; if (e.key.startsWith('Arrow')) e.preventDefault(); return; }
    if (!running && (e.key === ' ' || e.key === 'Enter') && document.activeElement !== startBtn) {
      e.preventDefault();
      start();
    }
  });
  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.key];
    if (k) keys[k] = false;
  });
  window.addEventListener('blur', () => { keys.left = keys.right = false; });

  startBtn.addEventListener('click', start);
  window.addEventListener('resize', setupCanvas);

  reset();
  setupCanvas();
})();
