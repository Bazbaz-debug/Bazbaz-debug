import { useEffect, useRef } from "react";

/**
 * Interactive particle canvas that follows cursor. Vanilla canvas, no deps.
 * Renders subtle glowing dots with connection lines that attract to the mouse.
 */
export default function ParticleCanvas({ color = "#48BB78", density = 55 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(0);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.offsetWidth, H = canvas.offsetHeight;
    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      W = canvas.offsetWidth; H = canvas.offsetHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Init particles
    const particles = Array.from({ length: density }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 0.4,
    }));

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      mouseRef.current.x = e.clientX - r.left;
      mouseRef.current.y = e.clientY - r.top;
    };
    const onLeave = () => { mouseRef.current.x = -9999; mouseRef.current.y = -9999; };
    // Attach to window so pointer-events-none on canvas still gets mouse
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    const rgba = (a) => {
      const c = color.replace("#", "");
      const rr = parseInt(c.substring(0,2), 16);
      const gg = parseInt(c.substring(2,4), 16);
      const bb = parseInt(c.substring(4,6), 16);
      return `rgba(${rr},${gg},${bb},${a})`;
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      for (const p of particles) {
        // Attract toward mouse
        const dx = mx - p.x, dy = my - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 220 && dist > 0) {
          p.vx += (dx / dist) * 0.02;
          p.vy += (dy / dist) * 0.02;
        }
        // Damping
        p.vx *= 0.985; p.vy *= 0.985;
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        // Glow
        ctx.beginPath();
        ctx.fillStyle = rgba(0.65);
        ctx.shadowBlur = 8; ctx.shadowColor = color;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      // Connection lines to mouse
      for (const p of particles) {
        const dx = mx - p.x, dy = my - p.y;
        const d = Math.sqrt(dx*dx + dy*dy);
        if (d < 140) {
          ctx.beginPath();
          ctx.strokeStyle = rgba(0.15 * (1 - d/140));
          ctx.lineWidth = 0.6;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mx, my);
          ctx.stroke();
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [color, density]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: "block" }} aria-hidden/>;
}
