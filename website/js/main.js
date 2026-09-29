/* =========================================================
   Pay&Serve — shared script
   Theme (day/night), UI sounds, animations, small helpers.
   No dependencies.
   ========================================================= */
(function () {
  "use strict";

  const root = document.documentElement;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  };
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------
     1. SOUNDS — synthesised with the Web Audio API,
        so there are no audio files to host.
     --------------------------------------------------------- */
  const Sound = {
    ctx: null,
    muted: store.get("ps-muted") === "1",

    init() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },

    // one short sine/triangle "blip"
    tone(freq, dur, { type = "sine", vol = 0.08, delay = 0, slide = 0 } = {}) {
      if (this.muted || !this.init()) return;
      const t = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    },

    click()  { this.tone(880, 0.08, { type: "triangle", vol: 0.06, slide: 0.6 }); },
    hover()  { this.tone(1400, 0.04, { vol: 0.018 }); },
    day()    { [523, 659, 784].forEach((f, i) => this.tone(f, 0.28, { vol: 0.05, delay: i * 0.07 })); },
    night()  { [784, 622, 466].forEach((f, i) => this.tone(f, 0.32, { vol: 0.05, delay: i * 0.08 })); },
    success(){ [659, 880, 1175].forEach((f, i) => this.tone(f, 0.22, { type: "triangle", vol: 0.05, delay: i * 0.09 })); },
    open()   { this.tone(440, 0.14, { vol: 0.05, slide: 1.6 }); },
    close()  { this.tone(700, 0.14, { vol: 0.05, slide: 0.6 }); },

    toggleMute() {
      this.muted = !this.muted;
      store.set("ps-muted", this.muted ? "1" : "0");
      if (!this.muted) this.success();
      return this.muted;
    },
  };
  window.PSound = Sound;

  /* ---------------------------------------------------------
     2. THEME — day / night, remembers choice,
        falls back to the OS preference.
     --------------------------------------------------------- */
  const savedTheme = store.get("ps-theme");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  root.setAttribute("data-theme", savedTheme || (systemDark ? "dark" : "light"));

  function setTheme(next, origin) {
    // circular colour wipe that grows from the toggle button
    if (!reduceMotion && origin) {
      const r = origin.getBoundingClientRect();
      const wipe = document.createElement("div");
      wipe.className = "theme-wipe";
      wipe.style.left = r.left + r.width / 2 + "px";
      wipe.style.top = r.top + r.height / 2 + "px";
      wipe.style.background = next === "dark" ? "#070a16" : "#f6f8fc";
      const maxDist = Math.hypot(window.innerWidth, window.innerHeight);
      wipe.style.setProperty("--s", Math.ceil((maxDist * 2) / 20));
      document.body.appendChild(wipe);
      wipe.addEventListener("animationend", () => wipe.remove());
    }
    root.setAttribute("data-theme", next);
    store.set("ps-theme", next);
    next === "dark" ? Sound.night() : Sound.day();
  }

  /* ---------------------------------------------------------
     3. DOM READY
     --------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", () => {
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

    /* Intro splash — only once per browser session */
    const splash = $(".splash");
    if (splash) {
      let seen = false;
      try { seen = sessionStorage.getItem("ps-splash") === "1"; } catch (e) { /* ignore */ }
      if (seen || reduceMotion) {
        splash.remove();
      } else {
        try { sessionStorage.setItem("ps-splash", "1"); } catch (e) { /* ignore */ }
        setTimeout(() => {
          splash.classList.add("is-done");
          setTimeout(() => splash.remove(), 800);
        }, 1500);
      }
    }

    /* Theme toggle */
    $$(".theme-toggle").forEach((btn) =>
      btn.addEventListener("click", () => {
        setTheme(root.getAttribute("data-theme") === "dark" ? "light" : "dark", btn);
      })
    );

    /* Sound toggle */
    $$(".sound-toggle").forEach((btn) => {
      const sync = () => {
        btn.classList.toggle("is-muted", Sound.muted);
        btn.setAttribute("aria-pressed", String(!Sound.muted));
        btn.setAttribute("aria-label", Sound.muted ? "Turn sounds on" : "Turn sounds off");
      };
      sync();
      btn.addEventListener("click", () => { Sound.toggleMute(); sync(); });
    });

    /* Click + hover sounds on interactive elements */
    const clickable = "a, button, summary, .filter";
    document.addEventListener("click", (e) => {
      const el = e.target.closest(clickable);
      if (el && !el.matches(".theme-toggle, .sound-toggle")) Sound.click();
    });
    if (window.matchMedia("(hover: hover)").matches) {
      $$(".nav__links a, .btn, .card, .filter").forEach((el) =>
        el.addEventListener("mouseenter", () => Sound.hover())
      );
    }

    /* Mobile menu */
    const header = $(".header");
    const menuBtn = $(".menu-btn");
    if (menuBtn && header) {
      menuBtn.addEventListener("click", () => {
        const open = header.classList.toggle("menu-open");
        menuBtn.setAttribute("aria-expanded", String(open));
        open ? Sound.open() : Sound.close();
      });
      $$(".nav__links a").forEach((a) => a.addEventListener("click", () => header.classList.remove("menu-open")));
    }

    /* Active nav link */
    const page = location.pathname.split("/").pop() || "index.html";
    $$(".nav__links a").forEach((a) => {
      if (a.getAttribute("href") === page) a.classList.add("is-active");
    });

    /* Header glass on scroll, hide on scroll down, progress bar, back-to-top */
    const progress = $(".progress");
    const toTop = $(".to-top");
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (header) {
        header.classList.toggle("is-scrolled", y > 10);
        const hide = y > lastY && y > 400 && !header.classList.contains("menu-open");
        header.classList.toggle("is-hidden", hide);
      }
      if (progress) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
      }
      if (toTop) toTop.classList.toggle("is-visible", y > 600);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

    /* Scroll reveal (staggered with data-stagger on a parent) */
    $$("[data-stagger]").forEach((group) => {
      Array.from(group.children).forEach((child, i) => {
        child.classList.add("reveal");
        child.style.setProperty("--d", i * 0.08 + "s");
      });
    });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    $$(".reveal").forEach((el) => io.observe(el));

    /* Animated counters */
    const countIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        const el = en.target;
        const end = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        const dur = 1600;
        const start = performance.now();
        const step = (now) => {
          const p = Math.min((now - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 4);
          el.textContent = Math.round(end * eased).toLocaleString("en-IN") + suffix;
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        countIO.unobserve(el);
      });
    }, { threshold: 0.5 });
    $$("[data-count]").forEach((el) => countIO.observe(el));

    /* Card spotlight follows the cursor */
    $$(".card").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", e.clientX - r.left + "px");
        card.style.setProperty("--my", e.clientY - r.top + "px");
      });
    });

    /* Subtle 3D tilt on hero visual */
    const visual = $(".hero__visual");
    if (visual && !reduceMotion && window.matchMedia("(hover: hover)").matches) {
      const main = $(".float-card--main", visual);
      visual.addEventListener("pointermove", (e) => {
        const r = visual.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        main.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
      });
      visual.addEventListener("pointerleave", () => { main.style.transform = ""; });
    }

    /* Button ripple */
    $$(".btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const r = btn.getBoundingClientRect();
        const size = Math.max(r.width, r.height);
        const span = document.createElement("span");
        span.className = "ripple";
        span.style.width = span.style.height = size + "px";
        span.style.left = e.clientX - r.left - size / 2 + "px";
        span.style.top = e.clientY - r.top - size / 2 + "px";
        btn.appendChild(span);
        span.addEventListener("animationend", () => span.remove());
      });
    });

    /* Service filters */
    const filters = $$(".filter");
    filters.forEach((f) =>
      f.addEventListener("click", () => {
        filters.forEach((x) => x.classList.toggle("is-active", x === f));
        const cat = f.dataset.filter;
        $$("[data-cat]").forEach((card) => {
          const show = cat === "all" || card.dataset.cat === cat;
          card.classList.toggle("is-hidden", !show);
          if (show) {
            card.classList.remove("is-in");
            requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add("is-in")));
          }
        });
      })
    );

    /* FAQ open / close sounds */
    $$(".faq details").forEach((d) => d.addEventListener("toggle", () => (d.open ? Sound.open() : Sound.close())));

    /* Forms — front-end only; connect to your backend / email service */
    $$("form[data-demo]").forEach((form) => {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (!form.checkValidity()) { form.reportValidity(); return; }
        const note = $(".form__note", form);
        if (note) { note.textContent = "Thank you! Our team will get back to you shortly."; note.classList.add("ok"); }
        Sound.success();
        form.reset();
      });
    });

    /* Footer year */
    $$("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));
  });
})();
