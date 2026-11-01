"use client";

import { useEffect, useRef } from "react";

/**
 * The main site's night sky, for the open mobile menu.
 *
 * aiastro.ru draws its sky with a canvas "galaxy" library (stars, comets,
 * nebulas, a solar system), configured down to black ground, 999 white stars
 * and a comet — nothing else (`NightSky` in its bundle: `starsCount: 999`,
 * `cometFrequence: 400`, `bgColor: "#000000"`, rotation, sun, planets and
 * nebulas all 0). Its menu is transparent, so that sky is what the menu opens
 * onto. This redraws the same thing with the same numbers, rather than
 * pulling in a whole solar-system library for the two parts of it in use.
 *
 * Every number below is the library's own; the comments say which rule it
 * came from where it isn't obvious.
 */

const STAR_COUNT = 999;
const FPS = 40;
/** Canvas pixels the comet moves per frame. */
const COMET_SPEED = 115;
/** Chance per frame that an idle comet sets off: frequence / 100 / 40. */
const COMET_CHANCE = 400 / 100 / 40;
const COMET_RGB = "255, 207, 207";

/** `a ± b`, uniformly. */
const around = (a: number, b: number) => a - b + Math.random() * b * 2;
const between = (a: number, b: number) => a + Math.random() * (b - a);

type Star = {
  /** Radius, as a percentage of the canvas's shorter side. */
  size: number;
  /** Distance from the centre, as a percentage of the shorter side. */
  distance: number;
  /** Radians. */
  angle: number;
  /** Degrees per frame — with the site's rotation speed of 0 this is a drift
   * of at most ±0.005°, which the library keeps and so does this. */
  speed: number;
};

type Comet = {
  x: number;
  y: number;
  startX: number;
  startY: number;
  direction: number;
  distanceToTarget: number;
  width: number;
};

function makeStars(): Star[] {
  return Array.from({ length: STAR_COUNT }, () => ({
    size: between(0.03, 0.1),
    // sqrt(rand·rand) bunches the stars towards the middle of the screen.
    distance: 120 * Math.sqrt(Math.random() * Math.random()),
    angle: (Math.PI / 180) * 360 * Math.random(),
    speed: around(0, 0.005),
  }));
}

export default function NightSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const stars = makeStars();
    let comet: Comet | null = null;
    // Comets are the only thing that moves fast. A reader who has asked for
    // less motion gets the same sky, standing still.
    const cometsOn = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Twice the element's CSS size whatever the screen's pixel ratio — the
    // library does exactly this, and the star sizes are tuned to it.
    function size() {
      if (!canvas) return;
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
    }
    size();

    function drawStars(w: number, h: number) {
      if (!ctx) return;
      const minSide = Math.min(w, h);
      ctx.fillStyle = "#fff";
      for (const star of stars) {
        star.angle = (star.angle + (Math.PI / 180) * star.speed) % 360;
        const d = (star.distance / 100) * minSide;
        const x = Math.round(w / 2 + Math.cos(star.angle) * d);
        const y = Math.round(h / 2 + Math.sin(star.angle) * d);
        // Rounded like the library's, so a good share of the smallest stars
        // round to nothing — that is part of how its sky looks.
        const r = Math.round((star.size / 100) * minSide);
        if (r <= 0) continue;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    function drawComet(w: number, h: number) {
      if (!ctx) return;
      if (!comet) {
        if (Math.random() > 1 - COMET_CHANCE) {
          // Starts a third of the way out from the centre in a random
          // direction and heads back across the middle, give or take 30°.
          const t = between(0, 2 * Math.PI);
          const maxSide = Math.max(w, h);
          const startX = around((Math.cos(t) * maxSide) / 3, (Math.abs(Math.cos(t) * maxSide) / 3) * 0.5) + w / 2;
          const startY = around((Math.sin(t) * maxSide) / 3, (Math.abs(Math.sin(t) * maxSide) / 3) * 0.5) + h / 2;
          comet = {
            x: startX,
            y: startY,
            startX,
            startY,
            direction: between(t + Math.PI - Math.PI / 6, t + Math.PI + Math.PI / 6),
            distanceToTarget: around(0.6 * maxSide, 0.3),
            width: between(0.2, 0.8),
          };
        }
        return;
      }

      comet.x += COMET_SPEED * Math.cos(comet.direction);
      comet.y += COMET_SPEED * Math.sin(comet.direction);
      const travelled = Math.hypot(comet.x - comet.startX, comet.y - comet.startY);
      if (travelled > comet.distanceToTarget) {
        comet = null;
        return;
      }

      // A streak: an ellipse a fraction of a pixel wide and 90px long, laid
      // along its path, fading out from its centre. The library's opacity
      // formula works out to 0.7 at every point of the flight.
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(comet.x, comet.y, comet.width, 90, comet.direction + Math.PI / 2, 0, 2 * Math.PI);
      ctx.globalAlpha = 0.7;
      const glow = ctx.createRadialGradient(comet.x, comet.y, 0, comet.x, comet.y, 90);
      glow.addColorStop(0, `rgba(${COMET_RGB}, 1)`);
      glow.addColorStop(1, `rgba(${COMET_RGB}, 0)`);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.restore();
    }

    let frame = 0;
    let last = 0;
    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      if (now - last < 1000 / FPS) return;
      last = now;
      if (!canvas || !ctx) return;
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);
      drawStars(w, h);
      if (cometsOn) drawComet(w, h);
    }
    frame = requestAnimationFrame(tick);

    window.addEventListener("resize", size);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", size);
    };
  }, []);

  return <canvas ref={canvasRef} className="night-sky" aria-hidden="true" />;
}
