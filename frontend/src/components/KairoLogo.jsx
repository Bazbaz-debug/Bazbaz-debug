export function KairoMark({ size = 32, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="9" fill="#0B1016" stroke="#48BB78" strokeWidth="1.5"/>
      <path d="M11.5 8v16" stroke="#48BB78" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M11.5 16.5 20 8.5" stroke="#48BB78" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M11.5 15.5 20.5 24" stroke="#48BB78" strokeWidth="2.4" strokeLinecap="round"/>
      <circle cx="23.5" cy="8.5" r="2.4" fill="#48BB78"/>
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

export default KairoLogo;
