import { useEffect, useRef } from "react";

/**
 * Mouse-reactive glowing background. Sits absolute inside a positioned parent.
 * Uses a soft radial gradient that follows the cursor + a static mesh overlay.
 */
export default function MouseGradient({ color = "#48BB78", intensity = 0.15 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const style = window.getComputedStyle(parent);
    if (style.position === "static") parent.style.position = "relative";

    let raf = 0, tx = -9999, ty = -9999, cx = -9999, cy = -9999;
    const onMove = (e) => {
      const r = parent.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
    };
    const loop = () => {
      cx += (tx - cx) * 0.08;
      cy += (ty - cy) * 0.08;
      if (el) el.style.background = `radial-gradient(600px circle at ${cx}px ${cy}px, ${color}${Math.floor(intensity*255).toString(16).padStart(2,'0')} 0%, transparent 60%)`;
      raf = requestAnimationFrame(loop);
    };
    parent.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(loop);
    return () => { parent.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, [color, intensity]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Static organic mesh */}
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, #48BB78 0%, transparent 60%)" }}></div>
      <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #4299E1 0%, transparent 60%)" }}></div>
      <div className="absolute -bottom-40 left-1/4 w-[500px] h-[500px] rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(circle, #9F7AEA 0%, transparent 60%)" }}></div>
      {/* Cursor-follow layer */}
      <div ref={ref} className="absolute inset-0"></div>
    </div>
  );
}
