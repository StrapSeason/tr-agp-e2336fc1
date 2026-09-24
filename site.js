// Agusha OTG'27 treatment site — page motion (classic script; stage.js reads window.SCENE).
(() => {
  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  root.classList.add('js');

  // Shared state for the 3D stage (stage.js): pinned-scene progress 0..1
  const SCENE = (window.SCENE = { iris: 0, rhyme: 0, reduced: REDUCED });

  /* ---------- 1. fit the 1920×1080 slides into their plates ---------- */
  const plates = [...document.querySelectorAll('.plate')];
  function fit() {
    for (const p of plates) {
      const s = p.querySelector('.slide');
      if (s) s.style.transform = `scale(${p.clientWidth / 1920})`;
    }
  }
  fit();
  // phones change the height while scrolling (address bar): only a new width re-fits and re-measures
  let lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth;
    fit(); window.ScrollTrigger && ScrollTrigger.refresh(); });

  /* ---------- 1b. mark text so it always sits above the background props (also with reduced motion) ---------- */
  document.querySelectorAll('.plate .slide .abs').forEach((el) => {
    if (/^(IMG|VIDEO|CANVAS)$/.test(el.tagName) || el.classList.contains('ring') || el.closest('.card')) return;
    if (el.textContent.trim()) el.classList.add('txt');
  });

  /* ---------- 1b'. the mini cover on the «turn your phone» screen: scale it, size the upright pose to fit ---------- */
  function fitMini() {
    const rot = document.querySelector('.rotate'), mini = rot && rot.querySelector('.mini'); if (!mini) return;
    const stage = rot.querySelector('.rotate__stage');
    const w = Math.min(innerWidth - 48, 420);                          // landscape pose: full width of the screen
    const h = w * 9 / 16, sh = stage.clientHeight || innerHeight * 0.55;
    const s1 = Math.min((sh * 0.9) / w, (innerWidth - 48) / h);        // upright pose: as tall as the stage allows
    mini.style.setProperty('--mw', w + 'px'); mini.style.setProperty('--s1', s1.toFixed(3));
    mini.style.setProperty('--k', (w / 1920).toFixed(5));
  }
  fitMini(); addEventListener('resize', fitMini);

  /* ---------- 1c. phones held upright: the «turn your phone» screen shows once, at the start ---------- */
  const land = matchMedia('(orientation: landscape)');
  const done = () => { if (root.classList.contains('rotate-done')) return; root.classList.add('rotate-done');
    window.LENIS && LENIS.start(); window.ScrollTrigger && ScrollTrigger.refresh(); };
  if (land.matches) done();                                    // already landscape (or desktop): never shown
  land.addEventListener('change', (e) => { if (e.matches) done(); });
  document.querySelector('.rotate__skip')?.addEventListener('click', done);

  /* ---------- 2. videos play only while visible ---------- */
  const vio = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target;
    if (e.isIntersecting) { v.muted = true; v.play().catch(() => {}); } else v.pause();
  }), { threshold: 0.15 });
  document.querySelectorAll('video').forEach((v) => { v.removeAttribute('autoplay'); v.muted = true; vio.observe(v); });

  if (REDUCED || !window.gsap) return;          // everything is already visible; no pins, no smooth scroll
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- 3. smooth scroll ---------- */
  if (window.Lenis) {
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    window.LENIS = lenis;
    if (!root.classList.contains('rotate-done') && getComputedStyle(document.querySelector('.rotate')).display !== 'none') lenis.stop();
  }

  /* ---------- 4. picture first, then type ---------- */
  const isFull = (el) => el.getBoundingClientRect().width / el.closest('.plate').getBoundingClientRect().width > 0.9;
  function prepare(plate) {
    const slide = plate.querySelector('.slide');
    const pics = [...slide.querySelectorAll(':scope > img.abs, :scope > video.abs, :scope > .ring, :scope > div.abs:has(> img), :scope > .card')]
      .filter((el) => !el.classList.contains('grain'))
      .sort((a, b) => a.offsetTop - b.offsetTop);
    const txt = [...slide.querySelectorAll('.abs')].filter((el) =>
      !pics.includes(el) && !el.closest('.card, .ring') && !/^(IMG|VIDEO)$/.test(el.tagName) &&
      el.textContent.trim() && !el.classList.contains('grain'));
    pics.forEach((el) => el.classList.add('reveal-img'));
    txt.forEach((el) => el.classList.add('reveal-txt'));
    return { pics, txt };
  }
  function play(plate, { pics, txt }, delay = 0) {
    const tl = gsap.timeline({ delay });
    pics.forEach((el, i) => {
      const full = isFull(el);
      tl.fromTo(el, full ? { opacity: 0, scale: 1.04 } : { opacity: 0, y: 44 },
        full ? { opacity: 1, scale: 1, duration: 1.4, ease: 'power2.out' }
             : { opacity: 1, y: 0, duration: 0.95, ease: 'back.out(1.35)' }, i * 0.1);
    });
    // the clip opens with room around the glyphs (cap-trimmed boxes are shorter than the letters)
    // and is removed at the end, so brackets, descenders and diacritics are never cut
    if (txt.length) tl.fromTo(txt, { opacity: 0, clipPath: 'inset(-60% -8% 160% -8%)' },
      { opacity: 1, clipPath: 'inset(-60% -8% -60% -8%)', duration: 1.15, ease: 'expo.out', stagger: 0.08,
        onComplete: () => gsap.set(txt, { clearProps: 'clipPath' }) },
      pics.length ? `>-0.55` : 0);
    return tl;
  }
  plates.forEach((plate) => {
    const parts = prepare(plate);
    if (plate.classList.contains('plate--cover')) { play(plate, parts, 0.25); return; }
    if (plate.closest('.pin')) { plate._parts = parts; return; }    // pinned plates reveal with their scene
    ScrollTrigger.create({ trigger: plate, start: 'top 78%', once: true, onEnter: () => play(plate, parts) });
  });

  /* ---------- 5. kid-wipe: the child runs past the lens and the next frame opens behind him ---------- */
  document.querySelectorAll('.plate--wipe').forEach((plate) => {
    const band = document.createElement('div');
    band.className = 'wipe-band';
    plate.appendChild(band);
    gsap.timeline({ scrollTrigger: { trigger: plate, start: 'top 96%', end: 'top 30%', scrub: 0.5 } })
      .fromTo(plate, { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', ease: 'power1.inOut', duration: 1 }, 0)
      .fromTo(band, { left: '-22%', opacity: 0 }, { left: '100%', opacity: 1, ease: 'power1.inOut', duration: 1 }, 0)
      .to(band, { opacity: 0, duration: 0.15 }, 0.85);
  });

  /* ---------- 6. pinned scenes: progress → CSS circle + stage ---------- */
  const ease = gsap.parseEase('power2.in');
  function pinScene(sel, name, handover, cyShare, startR, full = 1, cxShare = 0.5) {
    const pin = document.querySelector(sel); if (!pin) return;
    const mask = pin.querySelector('.iris-mask, .rhyme-mask');
    const plate = mask.querySelector('.plate');
    let revealed = false;
    mask.style.setProperty('--cy', cyShare * 100 + '%'); mask.style.setProperty('--cx', cxShare * 100 + '%');
    ScrollTrigger.create({
      trigger: pin, start: 'top top', end: 'bottom bottom', scrub: true,
      onUpdate(self) {
        const p = self.progress; SCENE[name] = p;
        const w = mask.clientWidth, h = mask.clientHeight;
        const cx = w * cxShare, cy = h * cyShare;   // open until the farthest corner is inside the circle
        const r0 = startR(w, h), r1 = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)) + 2;
        const q = p < handover ? 0 : ease(Math.min(1, (p - handover) / (full - handover)));
        mask.style.setProperty('--r', (p < handover ? 0 : r0 + (r1 - r0) * q).toFixed(1) + 'px');
        if (!revealed && p > handover) { revealed = true; play(plate, plate._parts); }
      },
      onLeave() { SCENE[name] = 1; mask.style.setProperty('--r', '200vmax'); },
      onLeaveBack() { SCENE[name] = 0; },
    });
  }
  // iris: the tube's bore (≈30 % of the viewport height across) opens into the park — slide 07
  pinScene('.pin--iris', 'iris', 0.45, 0.5, (w, h) => innerHeight * 0.13, 0.9);   // fully open by .9, before the tube leaves
  // rhyme: tube → bucket → cap; the cap's circle opens onto slide 11's GIF (the tall picture on the right: centre 1535×540, half-width 385)
  pinScene('.pin--rhyme', 'rhyme', 0.74, 540 / 1080, (w) => (385 / 1920) * w, 0.95, 1535 / 1920);
  window.SCENE.rhymeRing = () => {
    const m = document.querySelector('.rhyme-mask'); if (!m) return null;
    const r = m.getBoundingClientRect();
    return { x: r.left + r.width * (1535 / 1920), y: r.top + r.height / 2, r: (385 / 1920) * r.width };
  };
  window.SCENE.rhymeMid = () => {
    const m = document.querySelector('.rhyme-mask'); if (!m) return null;
    const r = m.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };
  window.SCENE.irisCenter = () => {
    const m = document.querySelector('.iris-mask'); if (!m) return null;
    const r = m.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
})();
