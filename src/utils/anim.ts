// src/utils/anim.ts
import type { TweenVars } from "gsap";

/** Pref. motion + existencia de window */
export const canAnimate = () =>
  typeof window !== "undefined" &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function onVisible(
  target: Element | string,
  cb: () => void,
  rootMargin = "120px"
) {
  const el =
    typeof target === "string" ? (document.querySelector(target) as Element | null) : target;
  if (!el) return cb();

  if (!("IntersectionObserver" in window) || !canAnimate()) return cb();

  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        cb();
      }
    },
    { rootMargin }
  );
  io.observe(el);
}

// --- Internals para GSAP dinámico + efectos ---
let gsapRef: any | null = null;
let effectsReady = false;

async function getGSAP() {
  if (gsapRef) return gsapRef;
  const g = (await import("gsap")).default;
  gsapRef = g;
  if (!effectsReady) {
    registerEffects(g);
    effectsReady = true;
  }
  return g;
}

/** Carga ScrollTrigger y lo registra (idempotente). */
export async function withScrollTrigger() {
  const gsap = await getGSAP();
  const { ScrollTrigger } = await import("gsap/ScrollTrigger");
  gsap.registerPlugin(ScrollTrigger); // seguro llamar múltiples veces
  return { gsap, ScrollTrigger };
}

function registerEffects(gsap: any) {
  // ---- Efecto: reveal
  gsap.registerEffect({
    name: "reveal",
    effect: (targets: any, config: TweenVars = {}) => {
      const els = gsap.utils.toArray(targets) as Element[];
      if (!els.length) return gsap.timeline();
      if (!canAnimate()) {
        return gsap.set(els, { clearProps: "all", autoAlpha: 1, y: 0 });
      }
      return gsap.from(els, {
        autoAlpha: 0,
        y: 24,
        duration: 0.6,
        ease: "power3.out",
        ...config,
      });
    },
    defaults: { duration: 0.6, y: 24, ease: "power3.out" },
    extendTimeline: true,
  });

  // ---- Efecto: staggerChildren (revela hijos del contenedor)
  gsap.registerEffect({
    name: "staggerChildren",
    effect: (
      targets: any,
      config: TweenVars & { childSelector?: string; stagger?: number } = {}
    ) => {
      const container = (gsap.utils.toArray(targets)[0] as Element | undefined) || null;
      if (!container) return gsap.timeline();

      const sel = (config.childSelector ?? ":scope > *") as string;
      const items = Array.from(container.querySelectorAll(sel));

      if (!items.length || !canAnimate()) {
        return gsap.set(items, { clearProps: "all", autoAlpha: 1, y: 0 });
      }

      const { stagger = 0.08, childSelector: _omit, ...vars } = config;

      return gsap.from(items, {
        autoAlpha: 0,
        y: 16,
        duration: 0.5,
        ease: "power3.out",
        stagger,
        ...vars,
      });
    },
    defaults: {
      childSelector: ":scope > *",
      stagger: 0.08,
      duration: 0.5,
      ease: "power3.out",
    },
    extendTimeline: true,
  });
}

// --- API pública basada en efectos ---
export async function reveal(el: Element | string, vars: TweenVars = {}) {
  const gsap = await getGSAP();
  return gsap.effects.reveal(el, vars);
}

export async function staggerChildren(
  container: Element | string,
  childSelector = ":scope > *",
  vars: TweenVars = {},
  stagger = 0.08
) {
  const gsap = await getGSAP();
  return gsap.effects.staggerChildren(container, { childSelector, stagger, ...vars });
}

// --- Controles globales opcionales ---
export async function pauseAll() {
  const gsap = await getGSAP();
  gsap.globalTimeline.pause();
}
export async function playAll() {
  const gsap = await getGSAP();
  gsap.globalTimeline.play();
}
export async function setGlobalSpeed(multiplier: number) {
  const gsap = await getGSAP();
  gsap.globalTimeline.timeScale(multiplier);
}
