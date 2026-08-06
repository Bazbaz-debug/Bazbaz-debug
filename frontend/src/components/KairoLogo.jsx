// Luxurious Kairo mark — gradient stroke, soft inner sheen and glow.
export function KairoMark({ size = 32, className = "", glow = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true"
         style={glow ? { filter: "drop-shadow(0 0 6px rgba(72,187,120,0.55))" } : undefined}>
      <defs>
        <linearGradient id="kairoGrad" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9DF3C4"/>
          <stop offset="0.5" stopColor="#48BB78"/>
          <stop offset="1" stopColor="#2F855A"/>
        </linearGradient>
        <linearGradient id="kairoFill" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#111820"/>
          <stop offset="1" stopColor="#0A0F14"/>
        </linearGradient>
      </defs>
      <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="9.5" fill="url(#kairoFill)" stroke="url(#kairoGrad)" strokeWidth="1.6"/>
      <path d="M11.5 8v16" stroke="url(#kairoGrad)" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M11.5 16.5 20 8.5" stroke="url(#kairoGrad)" strokeWidth="2.6" strokeLinecap="round"/>
      <path d="M11.5 15.5 20.5 24" stroke="url(#kairoGrad)" strokeWidth="2.6" strokeLinecap="round"/>
      <circle cx="23.5" cy="8.5" r="2.6" fill="#9DF3C4"/>
    </svg>
  );
}

export function KairoLogo({ size = 32, className = "", textClass = "text-xl" }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`} data-testid="kairo-logo">
      <KairoMark size={size}/>
      <span className={`font-display font-black tracking-tight text-white ${textClass}`}>Kairo</span>
    </div>
  );
}

// Premium hero lockup for the login / exclusive surfaces.
export function KairoLuxeLogo({ className = "" }) {
  return (
    <div className={`flex flex-col items-start ${className}`} data-testid="kairo-luxe-logo">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute -inset-2 rounded-3xl bg-[#48BB78]/25 blur-2xl" aria-hidden="true"></div>
          <div className="relative w-16 h-16 rounded-2xl flex items-center justify-center border border-[#48BB78]/40"
               style={{ background: "linear-gradient(145deg, rgba(72,187,120,0.14), rgba(11,16,22,0.6))", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 18px 40px -14px rgba(72,187,120,0.55)" }}>
            <KairoMark size={40} glow/>
          </div>
        </div>
        <div className="leading-none">
          <span className="block font-display font-black tracking-tighter text-4xl bg-gradient-to-br from-white via-white to-[#9DF3C4] bg-clip-text text-transparent">Kairo</span>
          <span className="block text-[10px] uppercase tracking-[0.42em] text-[#48BB78] font-bold mt-2">AI Concierge</span>
        </div>
      </div>
    </div>
  );
}

export default KairoLogo;
