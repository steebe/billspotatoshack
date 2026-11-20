(() => {
  'use strict';

  // Logical pixel-art resolution. CSS scales the canvas up with crisp pixels.
  const W = 300, H = 120, GROUND = 104, PX = 24, CROPS = 88;
  // Jump physics (px, seconds). Holding the jump lowers gravity on the way up.
  const G = 1600, JUMP_V = 260, HOLD_F = 0.4, MAX_HOLD = 0.22, MIN_HOLD = 0.08, CUT_V = 120, BUFFER = 0.1;
  // Physics runs in fixed steps, so Pete jumps the same on 60Hz and 144Hz screens.
  const STEP = 1 / 120;
  const BASE_SPEED = 160, MAX_SPEED = 400, RAMP = 0.12, SCORE_PER_PX = 0.1;
  const NIGHT_EVERY = 700, ARID_AT = 1500, HI_KEY = 'pete-hi';
  // Birds also get their own spawn track, so they can overlap ground hazards.
  const PARALLEL_AT = 300, PARALLEL_LOW_AT = 800;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay'), overlayTitle = $('overlay-title'), overlayText = $('overlay-text'), startBtn = $('start');
  const scoreEl = $('score'), hiEl = $('hi'), pauseBtn = $('pause'), jumpBtn = $('jump');
  const stage = document.querySelector('.stage');

  // Brand colors come from style.css so the palette has one source of truth.
  const css = getComputedStyle(document.documentElement);
  const c = (name) => css.getPropertyValue(name).trim();
  const C = {
    yukon: c('--yukon'), yukonLight: c('--yukon-light'), yukonDark: c('--yukon-dark'),
    russet: c('--russet'), russetLight: c('--russet-light'), russetDark: c('--russet-dark'),
    cream: c('--cream'), carrot: c('--carrot'),
    leaf: c('--leaf'), leafLight: c('--leaf-light'), leafDark: c('--leaf-dark'),
    skyDay: c('--sky-day'), skyNight: c('--sky-night'),
    arid: c('--arid'), aridDark: c('--arid-dark'), poison: c('--poison'),
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const hex = (s) => { const n = parseInt(s.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (A, B, t) => A.map((v, i) => v + (B[i] - v) * t);
  const rgb = (A) => `rgb(${A.map(Math.round).join()})`;
  const HX = {};
  for (const k in C) HX[k] = hex(C[k]);

  // ---- Sprites: one character per pixel, '.' is transparent ----
  const SPR = {
    peteJump: [
      '....oooooo....',
      'o..oyyyyyyo..o',
      '.ooylyyyyyyoo.',
      '..oyywkywkyo..',
      '.oyyykkykkyyo.',
      '.oyyyyyyyyyyo.',
      '.oyydyyooyyyo.',
      '.oyyyyyooyydo.',
      '..oyyyyyyydo..',
      '...oddddddo...',
      '...o......o...',
      '..............',
    ],
    weedS: [
      '...g....',
      '..gg..g.',
      'g.gd.gg.',
      'gg.d.g..',
      '.g.dgg..',
      '.gddg...',
      '..dd..g.',
      'g.d..gg.',
      'gg.dgd..',
      '.ggdd...',
      '..gd....',
      '...d....',
      '...d....',
      '..ddd...',
    ],
    weedL: [
      '.....g......',
      '....gg...g..',
      '.g..gd..gg..',
      '.gg.gd.gg...',
      '..g.ddgg..g.',
      '..ggdgd..gg.',
      'g..gdd..gg..',
      'gg..dd.gg...',
      '.gg.ddgd....',
      '..ggdgd...g.',
      '....dd...gg.',
      '.g..dd..gg..',
      '.gg.ddggd...',
      '..ggddd.....',
      '....dd...g..',
      '.g..dd..gg..',
      '.gggdddgg...',
      '...gddd.....',
      '....dd......',
      '...dddd.....',
    ],
    can: [
      '....ooooo....',
      '....ommmo....',
      '..ooooooooo..',
      '.orrrrrrrrro.',
      '.orwwkkkwwro.',
      '.orwkkkkkwro.',
      '.orwkwkwkwro.',
      '.orwkkkkkwro.',
      '.orwwkwkwwro.',
      '.orwkwwwkwro.',
      '.orwwkwkwwro.',
      '.orwkwwwkwro.',
      '.orrrrrrrrro.',
      '.ooooooooooo.',
    ],
    beetle1: [
      '....oooooo..',
      '...ockckco..',
      '..ockckckco.',
      'hhockckckcko',
      'hhokkkkkkkko',
      '...oooooooo.',
      '..o..o..o...',
      '.o..o..o....',
    ],
    beetle2: [
      '....oooooo..',
      '...ockckco..',
      '..ockckckco.',
      'hhockckckcko',
      'hhokkkkkkkko',
      '...oooooooo.',
      '...o..o..o..',
      '...o..o..o..',
    ],
    bird1: [
      '........kk......',
      '.......kkk......',
      '......kkkk......',
      '..kk.kkkk.......',
      '.kekkkkkkkkkk...',
      'ykkkkkkkkkkkkkk.',
      '..kkkkkkkkkkk.kk',
      '....kkkkkk......',
      '................',
      '................',
    ],
    bird2: [
      '................',
      '................',
      '................',
      '..kk............',
      '.kekkkkkkkkkk...',
      'ykkkkkkkkkkkkkk.',
      '..kkkkkkkkkkk.kk',
      '....kkkkkk......',
      '.....kkkk.......',
      '......kk........',
    ],
    cloud: [
      '.....wwww.......',
      '...wwwwwwww.....',
      '.wwwwwwwwwwwww..',
      'wwwwwwwwwwwwwwww',
    ],
    tumble: [
      '.aaaa.',
      'a.a..a',
      'aa.aa.',
      'a.aa.a',
      '.a..aa',
      '..aaa.',
    ],
  };

  // Pete's strut: one body, four leg poses. Frames are 13px tall; on the
  // "passing" steps the body rises 1px and a knee kicks up, for a bouncy swagger.
  const PETE_BODY = [
    '....oooooo....',
    '...oyyyyyyo...',
    '..oylyyyyyyo..',
    '..oyyykyykyo..',
    '.oyyyykyykyyo.',
    '.oyyyyyyyyyyo.',
    '.oyydyyyyyyyo.',
    '.oyyyyoooyydo.',
    '..oyyyyyyydo..',
    '...oddddddo...',
  ];
  const BLANK = '..............';
  const down = (legs) => [BLANK, ...PETE_BODY, ...legs];
  const up = (legs) => [...PETE_BODY, ...legs];
  SPR.peteWalk = [
    down(['...o......oo..', '...oo.....o...']), // stride, front heel strikes
    up(['.....o..oo....', '.....o...oo...', '.....oo.......']), // knee up
    down(['...o......o...', '..oo.......oo.']), // stride
    up(['....o...o.....', '...oo...o.....', '........oo....']), // back kick
  ];
  SPR.peteSquash = [
    BLANK, BLANK, BLANK,
    '...oooooooo...',
    '..oyyyyyyyyo..',
    '.oylyykyykyyo.',
    '.oyyyykyykyyo.',
    'oyyydyyyyyyyyo',
    'oyyyyyyoooyydo',
    '.oyyyyyyyyydo.',
    '..oddddddddo..',
    '...o......o...',
    '..oo......oo..',
  ];

  function sprite(rows, pal) {
    const cv = document.createElement('canvas');
    cv.width = rows[0].length;
    cv.height = rows.length;
    const g = cv.getContext('2d');
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = pal[row[x]];
        if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
      }
    });
    return cv;
  }

  const PAL = {
    pete: { o: C.russetDark, y: C.yukon, l: C.yukonLight, d: C.yukonDark, k: C.russetDark, w: C.cream },
    weed: { g: C.leafDark, d: C.russetDark },
    can: { o: C.russetDark, r: C.poison, w: C.cream, k: C.russetDark, m: C.russetLight },
    beetle: { o: C.russetDark, c: C.carrot, k: C.russetDark, h: C.russetDark },
    bird: { k: C.russet, e: C.cream, y: C.yukon },
  };
  const IMG = {
    peteWalk: SPR.peteWalk.map((f) => sprite(f, PAL.pete)),
    peteSquash: sprite(SPR.peteSquash, PAL.pete),
    peteJump: sprite(SPR.peteJump, PAL.pete),
    weedS: sprite(SPR.weedS, PAL.weed),
    weedL: sprite(SPR.weedL, PAL.weed),
    can: sprite(SPR.can, PAL.can),
    beetle1: sprite(SPR.beetle1, PAL.beetle),
    beetle2: sprite(SPR.beetle2, PAL.beetle),
    bird1: sprite(SPR.bird1, PAL.bird),
    bird2: sprite(SPR.bird2, PAL.bird),
    cloudDay: sprite(SPR.cloud, { w: C.cream }),
    cloudNight: sprite(SPR.cloud, { w: rgb(mix(HX.cream, HX.skyNight, 0.55)) }),
    tumble: sprite(SPR.tumble, { a: C.aridDark }),
  };

  // box: hitbox inset [left, top, right, bottom]. mult: speed relative to the ground
  // ("static" hazards sit on the ground at 1x; "moving" ones close in faster).
  const KINDS = {
    weedS: { img: [IMG.weedS], box: [1, 2, 1, 0], mult: 1, cause: 'Pete got weeded.' },
    weedL: { img: [IMG.weedL], box: [2, 2, 2, 0], mult: 1, cause: 'Pete got lost in the weeds.' },
    can: { img: [IMG.can], box: [1, 1, 1, 0], mult: 1, cause: 'Pete got sprayed.' },
    beetle: { img: [IMG.beetle1, IMG.beetle2], box: [1, 1, 1, 1], mult: 1.2, anim: 0.1, cause: 'A potato beetle got Pete.' },
    birdLow: { img: [IMG.bird1, IMG.bird2], box: [1, 3, 2, 2], mult: 1.25, anim: 0.18, top: GROUND - 14, cause: 'Pete got pecked.' },
    birdHigh: { img: [IMG.bird1, IMG.bird2], box: [1, 3, 2, 2], mult: 1.25, anim: 0.18, top: GROUND - 25, cause: 'Pete jumped into a bird.' },
  };
  for (const k in KINDS) {
    const K = KINDS[k];
    K.w = K.img[0].width;
    K.h = K.img[0].height;
    if (K.top === undefined) K.top = GROUND - K.h;
  }

  // Spawn weights, unlocked by score.
  const SPAWNS = [
    { k: 'weedS', w: 30, at: 0 },
    { k: 'can', w: 20, at: 0 },
    { k: 'weedL', w: 20, at: 80 },
    { k: 'beetle', w: 18, at: 120 },
    { k: 'birdLow', w: 16, at: 180 },
    { k: 'birdHigh', w: 14, at: 180 },
  ];

  function pickKind(score) {
    const pool = SPAWNS.filter((p) => score >= p.at);
    let r = Math.random() * pool.reduce((sum, p) => sum + p.w, 0);
    for (const p of pool) { if ((r -= p.w) < 0) return p.k; }
    return pool[0].k;
  }

  const STARS = Array.from({ length: 22 }, () => [Math.floor(rand(0, W)), Math.floor(rand(2, 56))]);
  const PEBBLES = [[3, 5], [17, 9], [29, 4], [41, 12], [58, 7], [66, 13], [80, 6], [95, 10], [108, 4], [121, 11], [133, 8], [147, 14]];

  let state, running = false, paused = false, held = false, last = 0, deadAt = -1e9;
  let hi = 0;
  try { hi = parseInt(localStorage.getItem(HI_KEY), 10) || 0; } catch { /* storage unavailable */ }

  function reset() {
    state = {
      dist: 0, score: 0, speed: BASE_SPEED, t: 0,
      h: 0, vy: 0, air: 0, grounded: true, walk: 0, landed: -1, released: true, buffer: 0,
      obs: [], next: 140, nextKind: 'weedS', birdNext: 200,
      nightT: 0, aridT: 0, dead: false,
      clouds: [0, 1, 2].map((i) => ({ x: 40 + i * 100 + rand(0, 40), y: rand(8, 40) })),
      tumbles: [], tumbleIn: 2,
    };
    updateHud();
  }

  const pad = (n) => String(n).padStart(5, '0');
  let hudCache = '';
  function updateHud() {
    const key = `${state.score}|${hi}`;
    if (key === hudCache) return;
    hudCache = key;
    scoreEl.textContent = pad(state.score);
    hiEl.textContent = pad(hi);
  }

  function spawn() {
    const s = state;
    const o = { k: s.nextKind, x: W + 4, ph: Math.random() };
    let extra = 0;
    if (s.nextKind === 'weedS' && s.score > 300 && Math.random() < 0.4 && isFair([o, { k: 'weedS', x: W + 11, ph: 0 }])) {
      s.obs.push(o, { k: 'weedS', x: W + 11, ph: 0 });
      extra = 7;
    } else if (isFair([o])) {
      s.obs.push(o);
    } else {
      s.next = 12; // No fair way through yet; try again a few px later.
      return;
    }
    s.nextKind = pickKind(s.score);
    // Moving hazards close the gap on whatever is ahead of them, so give them extra room.
    const closing = KINDS[s.nextKind].mult > 1 ? 60 : 0;
    s.next = rand(1, 1.8) * (s.speed * 0.55 + 70) + extra + closing;
  }

  // Birds on their own track, so they can overlap the ground hazards.
  function spawnBird() {
    const s = state;
    const k = s.score >= PARALLEL_LOW_AT && Math.random() < 0.3 ? 'birdLow' : 'birdHigh';
    const o = { k, x: W + 4, ph: Math.random() };
    if (isFair([o])) {
      s.obs.push(o);
      s.birdNext = rand(1.2, 2.5) * (s.speed * 0.6 + 80);
    } else {
      s.birdNext = 15;
    }
  }

  function hitbox(o) {
    const K = KINDS[o.k], b = K.box;
    return { x: o.x + b[0], y: K.top + b[1], w: K.w - b[0] - b[2], h: K.h - b[1] - b[3] };
  }

  // ---- Fairness ----
  // A hazard only spawns if, with it added, some sequence of jumps still gets Pete
  // past everything on screen. Hitboxes are padded in time and height, so the
  // path has slack for human timing. On the ground Pete's state is just "which
  // frame", so this is a small dynamic program over frames using the real jump
  // physics.
  const HORIZON = 320, SAFE_T = 0.035, SAFE_Y = 1;
  // How long the jump is held, quick tap to full hold, in physics steps.
  const HOLDS = [0.08, 0.13, 0.18, 0.23].map((t) => Math.round(t / STEP));

  // Pete's height per frame for one jump, following the same rules as update().
  function fly(h, vy, air, released, holdFrames) {
    const out = [];
    for (let f = 1; f < 240; f++) {
      if (f > holdFrames) released = true;
      air += STEP;
      if (released && air >= MIN_HOLD && vy > CUT_V) vy = CUT_V;
      const floating = !released && vy > 0 && air < MAX_HOLD;
      vy -= G * (floating ? HOLD_F : 1) * STEP;
      h += vy * STEP;
      if (h <= 0) { out.push(0); break; }
      out.push(h);
    }
    return out;
  }
  const TRAJ = HOLDS.map((d) => fly(0, JUMP_V, 0, false, d));

  function canSurvive(obs) {
    const s = state;
    // World scroll per frame, ramping speed the way update() does.
    const cum = new Float32Array(HORIZON + 1);
    let dist = s.dist;
    for (let k = 1; k <= HORIZON; k++) {
      const speed = Math.min(MAX_SPEED, BASE_SPEED + Math.floor(dist * SCORE_PER_PX) * RAMP);
      dist += speed * STEP;
      cum[k] = dist - s.dist;
    }
    const boxes = obs.map((o) => {
      const b = hitbox(o), m = KINDS[o.k].mult, pad = SAFE_T * s.speed * m;
      return { x: b.x - pad, w: b.w + pad * 2, y: b.y - SAFE_Y, h: b.h + SAFE_Y * 2, m };
    });
    // The search can stop once every hazard has passed Pete.
    let end = 0;
    for (const b of boxes) {
      let k = 0;
      while (k < HORIZON && b.x - b.m * cum[k] + b.w > PX + 3) k++;
      end = Math.max(end, k);
    }
    const hit = (k, h) => {
      const py = GROUND - 10 - h;
      for (const b of boxes) {
        const x = b.x - b.m * cum[k];
        if (PX + 3 < x + b.w && PX + 11 > x && py < b.y + b.h && py + 9 > b.y) return true;
      }
      return false;
    };

    // Is there a way through, starting on the ground or partway through a jump (`start`)?
    const solve = (start) => {
      const ok = new Uint8Array(HORIZON + 240);
      // Follows a flight path from frame k; returns true if it outlasts the search.
      const follow = (k, path) => {
        for (let j = 0; j < path.length; j++) {
          const f = k + 1 + j;
          if (f >= end) return true;
          if (hit(f, path[j])) return false;
        }
        ok[k + path.length] = 1;
        return false;
      };
      if (!start) {
        if (hit(0, 0)) return false;
        ok[0] = 1;
      } else if (follow(0, start)) {
        return true;
      }
      for (let k = 0; k < end; k++) {
        if (!ok[k]) continue;
        if (!hit(k + 1, 0)) ok[k + 1] = 1;
        for (const path of TRAJ) if (follow(k, path)) return true;
      }
      return ok[end] === 1;
    };

    if (s.grounded) return solve(null);
    // Mid-air, the player may already have committed to letting go or holding on
    // before this hazard appeared, so both have to leave a way through.
    if (!solve(fly(s.h, s.vy, s.air, true, 0))) return false;
    return s.released || solve(fly(s.h, s.vy, s.air, false, Math.max(0, HOLDS[3] - Math.round(s.air / STEP))));
  }

  const isFair = (extra) => canSurvive(state.obs.concat(extra));

  // Jump button copy tracks the run: Start (no run yet, or after a crash),
  // Jump (mid-run), Resume (paused).
  function syncJumpBtn() {
    const label = !running ? 'Start' : paused ? 'Resume' : 'Jump';
    jumpBtn.textContent = label;
    jumpBtn.setAttribute('aria-label', label);
  }

  function die(cause) {
    running = false;
    syncJumpBtn();
    state.dead = true;
    deadAt = performance.now();
    pauseBtn.hidden = true;
    if (state.score > hi) {
      hi = state.score;
      try { localStorage.setItem(HI_KEY, String(hi)); } catch { /* storage unavailable */ }
    }
    updateHud();
    overlayTitle.textContent = 'Mashed!';
    overlayText.textContent = `${cause} Score: ${state.score}.`;
    startBtn.textContent = 'Play again';
    overlay.hidden = false;
    startBtn.focus({ preventScroll: true });
  }

  function update(dt) {
    const s = state;
    s.t += dt;

    // Jump (buffered slightly so a press just before landing still counts).
    s.buffer -= dt;
    if (s.grounded && s.buffer > 0) {
      s.grounded = false;
      s.vy = JUMP_V;
      s.air = 0;
      s.released = !held;
      s.buffer = 0;
      ding();
    }
    if (!s.grounded) {
      s.air += dt;
      if (s.released && s.air >= MIN_HOLD && s.vy > CUT_V) s.vy = CUT_V;
      const floating = !s.released && s.vy > 0 && s.air < MAX_HOLD;
      s.vy -= G * (floating ? HOLD_F : 1) * dt;
      s.h += s.vy * dt;
      if (s.h <= 0) { s.h = 0; s.vy = 0; s.grounded = true; s.landed = s.t; }
    }

    // World speed ramps with score.
    s.speed = Math.min(MAX_SPEED, BASE_SPEED + s.score * RAMP);
    const dx = s.speed * dt;
    // Steps quicken with speed, but gently, so the strut stays readable.
    if (s.grounded) s.walk += dt * (8 + s.speed / 40);
    s.dist += dx;
    s.score = Math.floor(s.dist * SCORE_PER_PX);
    const nightTarget = Math.floor(s.score / NIGHT_EVERY) % 2;
    s.nightT += Math.max(-dt, Math.min(dt, nightTarget - s.nightT));
    if (s.score >= ARID_AT) s.aridT = Math.min(1, s.aridT + dt / 2);

    // Hazards.
    s.next -= dx;
    if (s.next <= 0) spawn();
    if (s.score >= PARALLEL_AT) {
      s.birdNext -= dx;
      if (s.birdNext <= 0) spawnBird();
    }
    for (const o of s.obs) o.x -= dx * KINDS[o.k].mult;
    s.obs = s.obs.filter((o) => o.x + KINDS[o.k].w > -2);

    // Scenery.
    for (const cl of s.clouds) {
      cl.x -= dx * 0.1;
      if (cl.x < -16) { cl.x = W + rand(0, 60); cl.y = rand(8, 40); }
    }
    if (s.aridT > 0.5) {
      s.tumbleIn -= dt;
      if (s.tumbleIn <= 0) { s.tumbles.push({ x: W + 6, v: rand(20, 50), ph: 0 }); s.tumbleIn = rand(3, 7); }
    }
    for (const tw of s.tumbles) { tw.x -= dx * 0.45 + tw.v * dt; tw.ph += dt * 8; }
    s.tumbles = s.tumbles.filter((tw) => tw.x > -8);

    updateHud();

    // Collision.
    const top = GROUND - 12 - s.h;
    const p = { x: PX + 3, y: top + 2, w: 8, h: 9 };
    for (const o of s.obs) {
      const b = hitbox(o);
      if (p.x < b.x + b.w && p.x + p.w > b.x && p.y < b.y + b.h && p.y + p.h > b.y) {
        die(KINDS[o.k].cause);
        return;
      }
    }
  }

  // ---- Drawing ----
  function disc(cx, cy, r, col) {
    ctx.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
      ctx.fillRect(cx - hw, cy + dy, hw * 2 + 1, 1);
    }
  }

  function draw() {
    const s = state, n = s.nightT, a = s.aridT, off = s.dist;

    // Sky, warming toward a dusty haze once the farm dries out.
    const sky = mix(mix(HX.skyDay, HX.yukonLight, a * 0.5), HX.skyNight, n);
    ctx.fillStyle = rgb(sky);
    ctx.fillRect(0, 0, W, H);
    if (n < 1) {
      ctx.globalAlpha = 1 - n;
      disc(250, 22, 9, C.yukonLight);
      disc(250, 22, 6, C.yukon);
      ctx.globalAlpha = 1;
    }

    // Far hills (slow parallax), hazed toward the sky.
    ctx.fillStyle = rgb(mix(mix(HX.leafDark, HX.aridDark, a), sky, 0.3));
    const ho = off * 0.15;
    for (let x = 0; x < W; x++) {
      const wx = x + ho;
      const top = Math.round(74 - 7 * Math.sin(wx * 0.021) - 4 * Math.sin(wx * 0.057 + 1.3));
      ctx.fillRect(x, top, 1, CROPS - top);
    }

    // Crop rows (mid parallax). They wither into stubble when arid.
    ctx.fillStyle = rgb(mix(HX.leafLight, HX.arid, a));
    ctx.fillRect(0, CROPS, W, GROUND - CROPS);
    ctx.fillStyle = rgb(mix(HX.leaf, HX.aridDark, a));
    const tuft = a > 0.5 ? 1 : 2;
    for (let r = 0; r < 3; r++) {
      const y = CROPS + 3 + r * 5, sp = 6, shift = (off * (0.35 + r * 0.1) + r * 3) % sp;
      for (let x = -shift; x < W + 1; x += sp) {
        const ix = Math.round(x);
        ctx.fillRect(ix, y - tuft, 1, tuft);
        ctx.fillRect(ix - 1, y, 3, 1);
      }
    }

    // Ground (full speed).
    ctx.fillStyle = C.russetLight;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = rgb(mix(HX.leaf, HX.aridDark, a));
    ctx.fillRect(0, GROUND, W, 2);
    ctx.fillStyle = C.russetDark;
    const go = off % 150;
    for (let k = 0; k < 3; k++) {
      for (const [px, py] of PEBBLES) {
        const x = Math.round(px + k * 150 - go);
        if (x > -2 && x < W) ctx.fillRect(x, GROUND + py, 2, 1);
      }
    }

    // Night falls over the scenery; the cast stays bright so it's readable.
    if (n > 0) {
      ctx.fillStyle = `rgba(16,20,48,${0.45 * n})`;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = n;
      ctx.fillStyle = C.cream;
      for (const [x, y] of STARS) ctx.fillRect(x, y, 1, 1);
      disc(250, 22, 7, C.cream);
      ctx.fillStyle = C.yukonLight;
      ctx.fillRect(247, 19, 2, 2);
      ctx.fillRect(252, 24, 2, 1);
      ctx.globalAlpha = 1;
    }

    const cloud = n > 0.5 ? IMG.cloudNight : IMG.cloudDay;
    for (const cl of s.clouds) ctx.drawImage(cloud, Math.round(cl.x), Math.round(cl.y));

    for (const tw of s.tumbles) {
      ctx.drawImage(IMG.tumble, Math.round(tw.x), Math.round(GROUND - 8 - Math.abs(Math.sin(tw.ph)) * 6));
    }

    for (const o of s.obs) {
      const K = KINDS[o.k];
      const img = K.anim ? K.img[Math.floor(s.t / K.anim + o.ph * 2) % K.img.length] : K.img[0];
      ctx.drawImage(img, Math.round(o.x), K.top);
    }

    let pete = IMG.peteJump;
    if (s.grounded && !s.dead) {
      pete = s.t - s.landed < 0.07 ? IMG.peteSquash : IMG.peteWalk[Math.floor(s.walk) % 4];
    }
    ctx.drawImage(pete, PX, Math.round(GROUND - pete.height - s.h));
  }

  // ---- Loop ----
  let acc = 0;
  function frame(now) {
    if (!running || paused) return;
    acc += Math.min(0.05, (now - last) / 1000);
    last = now;
    while (acc >= STEP && running) { update(STEP); acc -= STEP; }
    draw();
    if (running && !paused) requestAnimationFrame(frame);
  }

  function start() {
    if (running || performance.now() - deadAt < 400) return;
    unlockAudio();
    reset();
    overlay.hidden = true;
    pauseBtn.hidden = false;
    startBtn.blur();
    stage.scrollIntoView({ block: 'nearest' });
    // On touch screens, keep the Jump button below the field in view too.
    if (jumpBtn.offsetParent) jumpBtn.scrollIntoView({ block: 'nearest' });
    running = true;
    paused = false;
    syncJumpBtn();
    last = performance.now();
    acc = 0;
    requestAnimationFrame(frame);
  }

  function pause() {
    if (!running || paused) return;
    paused = true;
    syncJumpBtn();
    release();
    pauseBtn.hidden = true;
    overlayTitle.textContent = 'Paused';
    overlayText.textContent = 'Tap or press Esc to keep running.';
    startBtn.textContent = 'Resume';
    overlay.hidden = false;
    startBtn.focus({ preventScroll: true });
  }

  function resume() {
    if (!running || !paused) return;
    paused = false;
    syncJumpBtn();
    overlay.hidden = true;
    pauseBtn.hidden = false;
    startBtn.blur();
    last = performance.now();
    acc = 0;
    requestAnimationFrame(frame);
  }

  // ---- Sound ----
  // A soft "ding" synthesized with Web Audio, so there's no file to download.
  // Browsers only allow audio after a user gesture, so the context is created
  // (or resumed) on input and then reused for every jump.
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audio = null;
  // Mute preference persists across visits.
  const MUTE_KEY = 'pete-muted', muteBtn = $('mute');
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage unavailable */ }
  function syncMuteBtn() {
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
  }
  function toggleMute() {
    muted = !muted;
    try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage unavailable */ }
    syncMuteBtn();
  }
  syncMuteBtn();
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMute();
    // After a mouse/touch click, drop focus so Space goes back to jumping.
    if (e.detail) muteBtn.blur();
  });
  function unlockAudio() {
    if (!AudioCtx) return;
    try {
      if (!audio) audio = new AudioCtx();
      if (audio.state === 'suspended') audio.resume();
    } catch { audio = null; }
  }
  function ding() {
    if (muted || !audio || audio.state !== 'running') return;
    const t = audio.currentTime;
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    gain.connect(audio.destination);
    const osc = audio.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, t);
    osc.connect(gain);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  // ---- Input ----
  function press() {
    unlockAudio();
    if (held) return;
    held = true;
    if (running) state.buffer = BUFFER;
  }
  function release() {
    held = false;
    if (state) state.released = true;
  }

  const JUMP_KEYS = new Set([' ', 'ArrowUp', 'w', 'W']);
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (running && !e.repeat) { e.preventDefault(); if (paused) resume(); else pause(); }
      return;
    }
    if ((e.key === 'm' || e.key === 'M') && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) {
      toggleMute();
      return;
    }
    const jumpKey = JUMP_KEYS.has(e.key);
    if (!jumpKey && e.key !== 'Enter') return;
    if (document.activeElement === startBtn) return;
    e.preventDefault();
    if (e.repeat) return;
    if (!running) start();
    else if (paused) resume();
    else if (jumpKey) press();
  });
  window.addEventListener('keyup', (e) => { if (JUMP_KEYS.has(e.key)) release(); });
  // Leaving the tab/app pauses the run instead of letting Pete run blind.
  window.addEventListener('blur', () => { release(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  pauseBtn.addEventListener('click', pause);

  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', (e) => {
      if (!running) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      press();
    });
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);
  } else {
    // Fallback for browsers without Pointer Events (older iOS Safari).
    canvas.addEventListener('touchstart', (e) => {
      if (!running) return;
      e.preventDefault();
      press();
    }, { passive: false });
    canvas.addEventListener('touchend', release);
    canvas.addEventListener('touchcancel', release);
  }

  // Jump button (touch devices only): sits below the field so a thumb
  // doesn't cover Pete. Like Space, it also starts or resumes a run.
  function jumpDown() {
    if (!running) start();
    else if (paused) resume();
    else press();
  }
  if (window.PointerEvent) {
    jumpBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      jumpBtn.setPointerCapture(e.pointerId);
      jumpDown();
    });
    jumpBtn.addEventListener('pointerup', release);
    jumpBtn.addEventListener('pointercancel', release);
  } else {
    jumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      jumpDown();
    }, { passive: false });
    jumpBtn.addEventListener('touchend', release);
    jumpBtn.addEventListener('touchcancel', release);
  }
  jumpBtn.addEventListener('contextmenu', (e) => e.preventDefault());

  // Tap anywhere on the overlay (or its button) to start or resume.
  overlay.addEventListener('click', () => { if (paused) resume(); else start(); });

  reset();
  draw();
})();
