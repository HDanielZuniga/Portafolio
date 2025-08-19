import { gsap } from "gsap";

// Respeta reduce-motion
const prefersReduce = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Espera DOM listo
if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

function init() {
  if (prefersReduce()) return;

  const section = document.getElementById("proyectos");
  if (!section) return;

  const root = section.querySelector<HTMLElement>(".gallery");
  const cardsList = section.querySelector(".cards");
  const imgs = section.querySelectorAll<HTMLImageElement>(".cards img");
  if (!root || !cardsList || !imgs.length) return;

  // Fade-in
  gsap.to(imgs, { opacity: 1, delay: 0.1 });

  let iteration = 0;
  const spacing = 0.1;
  const snap = gsap.utils.snap(spacing);
  const cards = gsap.utils.toArray<HTMLLIElement>(cardsList.querySelectorAll("li"));
  const seamlessLoop = buildSeamlessLoop(cards, spacing);

  // tween reutilizable para scrub
  const scrub = gsap.to(seamlessLoop, {
    totalTime: 0,
    duration: 0.45,
    ease: "power3",
    paused: true,
  });

  // ======= RECUADRO =======
  let isHover = false;
  let isVisible = false; // por si está fuera de viewport
  let wheelAccum = 0;

  root.addEventListener("mouseenter", () => (isHover = true));
  root.addEventListener("mouseleave", () => (isHover = false));

  // Observa visibilidad 
  const io = new IntersectionObserver(
    ([e]) => (isVisible = e.isIntersecting),
    { threshold: 0.25 } // al menos 25% visible
  );
  io.observe(root);

  // Rueda del mouse / trackpad
  root.addEventListener(
    "wheel",
    (e) => {
      if (!isHover || !isVisible) return;
      e.preventDefault(); // bloquea el scroll del documento solo sobre el recuadro
      // Normaliza: deltaY suele ser ~100 por “tick” de rueda; en trackpad será suave.
      const step = (e.deltaY / 800) * 1; // factor fino; ajustable
      wheelAccum += step;
      // mueve en múltiplos de spacing
      if (Math.abs(wheelAccum) >= spacing) {
        const steps = Math.trunc(wheelAccum / spacing);
        wheelAccum -= steps * spacing;
        scrubTo((scrub.vars as any).totalTime + steps * spacing);
      }
    },
    { passive: false }
  );

  // Toques (swipe vertical dentro del recuadro)
  let touchStartY = 0;
  root.addEventListener("touchstart", (e) => {
    if (!isVisible) return;
    touchStartY = e.touches[0].clientY;
  });
  root.addEventListener(
    "touchmove",
    (e) => {
      if (!isVisible) return;
      const dy = e.touches[0].clientY - touchStartY;
      if (Math.abs(dy) > 4) {
        e.preventDefault(); // que no se mueva el documento mientras “raspas” las cartas
        const step = (-dy / 800) * 1; // mismo factor que rueda
        scrubTo((scrub.vars as any).totalTime + step);
        touchStartY = e.touches[0].clientY; // incremental
      }
    },
    { passive: false }
  );

  // Botones dentro de la sección
  section
    .querySelector<HTMLButtonElement>(".next")
    ?.addEventListener("click", () => scrubTo((scrub.vars as any).totalTime + spacing));
  section
    .querySelector<HTMLButtonElement>(".prev")
    ?.addEventListener("click", () => scrubTo((scrub.vars as any).totalTime - spacing));

  function scrubTo(totalTime: number) {
    const progress =
      (totalTime - seamlessLoop.duration() * iteration) / seamlessLoop.duration();
    if (progress > 1) {
      wrapForward();
    } else if (progress < 0) {
      wrapBackward();
    } else {
      // Ajusta “virtualmente” sin depender del scroll del documento
      (scrub.vars as any).totalTime = snap(totalTime);
      scrub.invalidate().restart();
    }
  }

  function wrapForward() {
    iteration++;
    seamlessLoop.totalTime(seamlessLoop.totalTime() + seamlessLoop.duration());
    scrub.pause();
  }

  function wrapBackward() {
    iteration--;
    if (iteration < 0) {
      iteration = 9;
      seamlessLoop.totalTime(seamlessLoop.totalTime() + seamlessLoop.duration() * 10);
      scrub.pause();
    }
  }

  function buildSeamlessLoop(items: Element[], spacing: number) {
    const overlap = Math.ceil(1 / spacing);
    const startTime = items.length * spacing + 0.5;
    const loopTime = (items.length + overlap) * spacing + 1;

    const rawSequence = gsap.timeline({ paused: true });
    const loopTl = gsap.timeline({
      paused: true,
      repeat: -1,
      onRepeat() {
        (this as any)._time === (this as any)._dur &&
          ((this as any)._tTime += (this as any)._dur - 0.01);
      },
    });

    const l = items.length + overlap * 2;

    gsap.set(items, { xPercent: 400, opacity: 0, scale: 0 });

    for (let i = 0; i < l; i++) {
      const index = i % items.length;
      const item = items[index] as HTMLElement;
      const time = i * spacing;

      rawSequence
        .fromTo(
          item,
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            zIndex: 100,
            duration: 0.5,
            yoyo: true,
            repeat: 1,
            ease: "power1.in",
            immediateRender: false,
          },
          time
        )
        .fromTo(
          item,
          { xPercent: 400 },
          { xPercent: -400, duration: 1, ease: "none", immediateRender: false },
          time
        );

      if (i <= items.length) loopTl.add("label" + i, time);
    }

    rawSequence.time(startTime);
    loopTl
      .to(rawSequence, {
        time: loopTime,
        duration: loopTime - startTime,
        ease: "none",
      })
      .fromTo(
        rawSequence,
        { time: overlap * spacing + 1 },
        {
          time: startTime,
          duration: startTime - (overlap * spacing + 1),
          immediateRender: false,
          ease: "none",
        }
      );

    return loopTl;
  }

  // Por si cambian tamaños luego de cargar imágenes
  window.addEventListener("load", () => {
    // nada específico que refrescar (no usamos ScrollTrigger),
    // pero si quisieras recalcular algo, hazlo aquí.
  });
}
