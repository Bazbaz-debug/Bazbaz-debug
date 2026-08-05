import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { KairoLogo, KairoMark } from "../components/KairoLogo";
import {
  ArrowRight, ArrowUpRight, MessageSquare, ShoppingBag, TrendingUp, Sparkles,
  Languages, Inbox, PhoneCall, UserCheck, Package, Camera, Star, Lock, Zap
} from "lucide-react";

// Baazi's Upwork profile — update this link to the real profile URL when available.
const UPWORK_URL = "https://www.upwork.com/";

const PLATFORMS = ["Shopify", "WordPress", "Webflow", "Wix", "Squarespace", "BigCommerce", "Framer"];

const FEATURES = [
  { icon: MessageSquare, title: "Instant FAQ answers", desc: "Trained on your site, PDFs & policies — no more repeat questions." },
  { icon: TrendingUp, title: "Smart upsells", desc: "Recommends the right add-on at the right moment to lift AOV." },
  { icon: Package, title: "Order tracking", desc: "Visitors check their order status without ever leaving the chat." },
  { icon: Camera, title: "Photo → product", desc: "Shoppers snap a photo, Kairo finds the match in your catalog." },
  { icon: Languages, title: "95+ languages", desc: "Answers every visitor in their own language, automatically." },
  { icon: Inbox, title: "Unified inbox", desc: "Every conversation, booking and lead in one live dashboard." },
  { icon: PhoneCall, title: "Voice concierge", desc: "Visitors can talk to Kairo out loud — hands-free support." },
  { icon: UserCheck, title: "Human handoff", desc: "Jump in live anytime; Kairo hands the thread straight to you." },
];

export default function LandingPage() {
  const nav = useNavigate();
  const openUpwork = () => window.open(UPWORK_URL, "_blank", "noopener");

  return (
    <div className="relative min-h-screen bg-[#0B1016] text-white overflow-x-hidden noise" data-testid="landing-page">
      <div className="dot-grid fixed inset-0 opacity-40 pointer-events-none" />

      {/* ============ STICKY NAV ============ */}
      <header data-testid="sticky-header" className="fixed top-0 inset-x-0 z-50 glass border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <KairoLogo size={30} />
          <nav className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#use-cases" className="link-underline hover:text-white transition-colors">Use cases</a>
            <a href="#features" className="link-underline hover:text-white transition-colors">Features</a>
            <a href="#reserve" className="link-underline hover:text-white transition-colors">Availability</a>
          </nav>
          <div className="flex items-center gap-3">
            <button data-testid="nav-login-btn" onClick={() => nav("/login")} className="text-sm text-white/70 hover:text-white transition-colors link-underline">Client Login</button>
            <button data-testid="nav-upwork-btn" onClick={openUpwork} className="btn-luxe text-xs">Book on Upwork</button>
          </div>
        </div>
      </header>

      {/* ============ HERO ============ */}
      <section data-testid="hero-section" className="relative flex flex-col items-center justify-center text-center min-h-[92vh] px-6 pt-28 pb-16 max-w-5xl mx-auto">
        <div className="float-orb w-[420px] h-[420px] -top-20 left-1/2 -translate-x-1/2 absolute" />
        <div className="relative z-10 flex flex-col items-center">
          <div data-testid="demo-badge" className="fade-up inline-flex items-center gap-2 rounded-full border border-[#48BB78]/50 bg-[#48BB78]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#48BB78] mb-8">
            <Lock size={12} /> In demo mode · Upwork clients only
          </div>
          <h1 className="fade-up font-display font-black text-5xl sm:text-6xl lg:text-7xl tracking-tighter leading-[0.95]" style={{ animationDelay: "0.05s" }}>
            <span className="gradient-text-primary">Kairo.</span><br />The right moment.
          </h1>
          <p className="fade-up mt-6 text-base md:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed" style={{ animationDelay: "0.12s" }}>
            An AI concierge that catches high-intent visitors the instant they land — answering, upselling and booking, so you never lose a ready-to-buy customer again.
          </p>
          <div className="fade-up mt-10 flex flex-col sm:flex-row items-center gap-4" style={{ animationDelay: "0.2s" }}>
            <button data-testid="hero-reserve-btn" onClick={() => nav("/login") } className="btn-luxe text-sm flex items-center gap-2">
              Client Login <ArrowRight size={16} />
            </button>
            <button data-testid="hero-upwork-btn" onClick={openUpwork} className="btn-luxe-ghost text-sm flex items-center gap-2">
              Reserve your spot <ArrowUpRight size={16} />
            </button>
          </div>
          <p className="fade-up mt-6 text-xs text-white/35" style={{ animationDelay: "0.28s" }}>
            Not open to the public yet — booking now reserves your place in line.
          </p>
        </div>
      </section>

      {/* ============ MARQUEE ============ */}
      <section data-testid="marquee-section" className="w-full overflow-hidden py-8 border-y border-white/10 bg-white/[0.015]">
        <div className="marquee-track items-center gap-10 text-white/40 font-display font-bold text-lg">
          {[...PLATFORMS, ...PLATFORMS, ...PLATFORMS].map((p, i) => (
            <span key={i} className="flex items-center gap-10 whitespace-nowrap">
              {p} <Star size={12} className="star" />
            </span>
          ))}
        </div>
      </section>

      {/* ============ USE CASES (BENTO) ============ */}
      <section id="use-cases" data-testid="use-cases-section" className="max-w-7xl mx-auto px-6 py-28">
        <div className="max-w-2xl mb-14">
          <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#48BB78] mb-3">Who it's for</p>
          <h2 className="font-display font-black text-4xl md:text-5xl tracking-tight">Built for people who just need it to work.</h2>
        </div>
        <div className="grid md:grid-cols-12 gap-6">
          {/* Large card */}
          <div className="md:col-span-7 glass neon-glow-hover rounded-3xl p-8 overflow-hidden relative group" data-testid="use-case-shopify">
            <div className="relative z-10">
              <ShoppingBag className="text-[#48BB78] mb-5" size={28} />
              <h3 className="font-display font-black text-2xl md:text-3xl tracking-tight mb-3">You run a Shopify store and just need a fix.</h3>
              <p className="text-white/55 text-sm md:text-base max-w-lg leading-relaxed">Visitors bounce with questions unanswered. Drop in one line of code and Kairo handles sizing, shipping, returns and order tracking — recovering the sales you were quietly losing.</p>
            </div>
            <img src="https://images.unsplash.com/photo-1674027392857-9aed6e8ecab9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHw0fHxzaG9waWZ5JTIwZGFzaGJvYXJkJTIwZGFya3xlbnwwfHx8fDE3ODU5NjQ5ODN8MA&ixlib=rb-4.1.0&q=85" alt="Shopify store dashboard" className="mt-6 w-full h-56 object-cover rounded-2xl border border-white/10 opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
          {/* Medium card */}
          <div className="md:col-span-5 glass neon-glow-hover rounded-3xl p-8 overflow-hidden relative group flex flex-col" data-testid="use-case-ads">
            <TrendingUp className="text-[#48BB78] mb-5" size={28} />
            <h3 className="font-display font-black text-2xl tracking-tight mb-3">You buy ads and need every click to convert.</h3>
            <p className="text-white/55 text-sm leading-relaxed">Paid traffic is expensive. Kairo greets each visitor instantly, qualifies them, and books the call — turning cold clicks into booked revenue.</p>
            <img src="https://images.unsplash.com/photo-1658953229664-e8d5ebd039ba?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzNDR8MHwxfHNlYXJjaHwyfHxtYXJrZXRpbmclMjBhbmFseXRpY3MlMjBkYXJrfGVufDB8fHx8MTc4NTk2NDk4M3ww&ixlib=rb-4.1.0&q=85" alt="Marketing analytics" className="mt-auto pt-6 w-full h-40 object-cover rounded-2xl border border-white/10 opacity-90 group-hover:opacity-100 transition-opacity duration-500" />
          </div>
          {/* Small full card */}
          <div className="md:col-span-12 glass neon-glow-hover rounded-3xl p-8 flex flex-col md:flex-row md:items-center gap-6" data-testid="use-case-smb">
            <Zap className="text-[#48BB78] flex-shrink-0" size={28} />
            <div>
              <h3 className="font-display font-black text-2xl tracking-tight mb-1.5">Any small business that wants to stop answering the same questions.</h3>
              <p className="text-white/55 text-sm leading-relaxed max-w-3xl">Kairo learns your business from your site and documents, then works 24/7 — in 95+ languages — so you can focus on the work only you can do.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" data-testid="features-grid-section" className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl mb-14">
          <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#48BB78] mb-3">Everything it does</p>
          <h2 className="font-display font-black text-4xl md:text-5xl tracking-tight">One concierge. Every high-intent moment.</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => (
            <div key={i} data-testid={`feature-${i}`} className="glass neon-glow-hover rounded-2xl p-6 border border-white/5">
              <f.icon className="text-[#48BB78] mb-4" size={22} />
              <h3 className="font-display font-bold text-lg tracking-tight mb-1.5">{f.title}</h3>
              <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ RESERVATION / WAITLIST ============ */}
      <section id="reserve" data-testid="waitlist-reservation-section" className="max-w-7xl mx-auto px-6 py-24">
        <div className="relative overflow-hidden rounded-[2rem] border border-[#48BB78]/25 bg-[#0D1117] px-8 py-20 md:py-28 text-center">
          <div className="float-orb w-[520px] h-[520px] -top-40 left-1/2 -translate-x-1/2 absolute opacity-25" />
          <img src="https://images.unsplash.com/photo-1781450601840-3528be660057?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NzZ8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGdsb3dpbmclMjBvcmIlMjBncmVlbnxlbnwwfHx8fDE3ODU5NjQ5ODN8MA&ixlib=rb-4.1.0&q=85" alt="" className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-screen pointer-events-none" />
          <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#48BB78]/50 bg-[#48BB78]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#48BB78] mb-8">
              <Lock size={12} /> Not available to the public
            </div>
            <h2 className="font-display font-black text-4xl md:text-6xl tracking-tighter leading-[0.95] mb-6">
              It's not open yet.<br />Reserve your spot.
            </h2>
            <p className="text-white/60 text-base md:text-lg leading-relaxed mb-10">
              Kairo is offered exclusively to <span className="text-white font-semibold">Upwork clients</span> and is currently in private demo. Book a consultation with <span className="text-white font-semibold">Baazi Suufi</span> on Upwork to claim your place — and be first in line the moment it launches.
            </p>
            <button data-testid="reserve-upwork-btn" onClick={openUpwork} className="btn-luxe text-sm md:text-base flex items-center gap-2.5 !px-10 !py-4">
              Book on Upwork to wait <ArrowUpRight size={18} />
            </button>
            <p className="text-xs text-white/35 mt-6">Existing demo client?{" "}
              <button onClick={() => nav("/login")} className="text-[#48BB78] link-underline">Log in here</button>.
            </p>
          </div>
        </div>
      </section>

      {/* ============ TESTIMONIALS ============ */}
      <section data-testid="testimonials-section" className="max-w-7xl mx-auto px-6 py-24">
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3 glass rounded-3xl p-8 md:p-10" data-testid="testimonial-featured">
            <div className="flex gap-1 mb-5">{[...Array(5)].map((_, i) => <Star key={i} size={16} className="star" />)}</div>
            <p className="font-display font-bold text-2xl md:text-3xl tracking-tight leading-snug">"Kairo answers my customers better than my old support team did — and it booked three orders while I slept. This is the evolution of the bot I demoed months ago."</p>
            <div className="mt-8 flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#48BB78]/15 border border-[#48BB78]/30 flex items-center justify-center"><KairoMark size={22} /></div>
              <div>
                <p className="font-bold text-sm">Marcus Vale</p>
                <p className="text-xs text-white/45">Founder, Vale Athletics (Shopify)</p>
              </div>
            </div>
          </div>
          <div className="md:col-span-2 glass rounded-3xl p-8 flex flex-col justify-center" data-testid="testimonial-support">
            <div className="flex gap-1 mb-5">{[...Array(5)].map((_, i) => <Star key={i} size={14} className="star" />)}</div>
            <p className="text-white/75 text-base leading-relaxed">"Every ad dollar goes further. Kairo catches visitors the second they land and turns clicks into booked calls."</p>
            <div className="mt-6">
              <p className="font-bold text-sm">Priya N.</p>
              <p className="text-xs text-white/45">Performance Marketer</p>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER ============ */}
      <footer data-testid="footer" className="border-t border-white/10 bg-black px-6 pt-24 pb-14">
        <div className="max-w-7xl mx-auto">
          <h2 className="font-display font-black tracking-tighter text-[16vw] md:text-[11vw] leading-none text-white/90">Let's talk.</h2>
          <div className="mt-12 flex flex-col md:flex-row md:items-end justify-between gap-8 border-t border-white/10 pt-10">
            <div>
              <KairoLogo size={28} />
              <p className="text-white/45 text-sm mt-4 max-w-sm">The AI concierge that catches high-intent visitors. Currently in private demo for Upwork clients only.</p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <button data-testid="footer-upwork-btn" onClick={openUpwork} className="btn-luxe text-xs w-fit">Book on Upwork</button>
              <button onClick={() => nav("/login")} className="text-sm text-white/60 hover:text-white transition-colors link-underline w-fit">Client Login</button>
            </div>
          </div>
          <p className="text-white/30 text-xs mt-12">© 2026 Kairo · Built by Baazi Suufi</p>
        </div>
      </footer>
    </div>
  );
}
