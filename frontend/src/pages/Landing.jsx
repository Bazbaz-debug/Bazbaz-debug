import { useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { KairoLogo, KairoMark } from "../components/KairoLogo";
import {
  ArrowRight, ArrowUpRight, MessageSquare, ShoppingBag, TrendingUp, Sparkles,
  Languages, Inbox, PhoneCall, UserCheck, Package, Camera, Star, Lock, Zap,
  CalendarDays, Clock, Check, Loader2, Mail, ArrowLeft
} from "lucide-react";

// Baazi's Upwork profile — update this link to the real profile URL when available.
const UPWORK_URL = "https://www.upwork.com/";

const PLATFORMS = ["Shopify", "WordPress", "Webflow", "Wix", "Squarespace", "BigCommerce", "Framer"];

// Premium imagery
const IMG_CLEANING = "https://images.unsplash.com/photo-1581270275831-be22c51ba9c9?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA3MDB8MHwxfHNlYXJjaHwzfHxjbGVhbmluZyUyMHNlcnZpY2V8ZW58MHx8fGJsYWNrfDE3ODU5ODIwNDZ8MA&ixlib=rb-4.1.0&q=85";
const IMG_ECOM = "https://images.unsplash.com/photo-1612703769284-0103b1e5ef70?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MjJ8MHwxfHNlYXJjaHwyfHxlY29tbWVyY2UlMjBzdG9yZXxlbnwwfHx8YmxhY2t8MTc4NTk4MjA0Nnww&ixlib=rb-4.1.0&q=85";
const IMG_MARKETING = "https://images.unsplash.com/photo-1551288049-bebda4e38f71?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHxtYXJrZXRpbmclMjBhbmFseXRpY3N8ZW58MHx8fGJsYWNrfDE3ODU5ODIwNDZ8MA&ixlib=rb-4.1.0&q=85";
const IMG_OWNER = "https://images.unsplash.com/photo-1573633509389-0e3075dea01b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwxfHxidXNpbmVzcyUyMG93bmVyfGVufDB8fHxibGFja3wxNzg1OTgyMDUzfDA&ixlib=rb-4.1.0&q=85";
const IMG_BG = "https://images.unsplash.com/photo-1591981863992-7747083cbd11?auto=format&fit=crop&w=1600&q=80";

function RotatingWord({ words }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % words.length), 2100);
    return () => clearInterval(t);
  }, [words.length]);
  return <span key={i} className="flip-word gradient-text-primary">{words[i]}</span>;
}


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

function WaitlistCapture() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [state, setState] = useState("idle"); // idle | loading | done
  const [msg, setMsg] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("Enter your email"); return; }
    setState("loading");
    try {
      const { data } = await api.post("/waitlist", { email: email.trim(), name: name.trim(), source: "landing" });
      setMsg(data.message || "You're on the list!");
      setState("done");
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Please enter a valid email");
      setState("idle");
    }
  };
  if (state === "done") {
    return (
      <div data-testid="waitlist-success" className="flex flex-col items-center text-center gap-3 py-6">
        <div className="w-12 h-12 rounded-full bg-[#48BB78]/15 border border-[#48BB78]/40 flex items-center justify-center"><Check className="text-[#48BB78]" size={22} /></div>
        <p className="font-display font-bold text-lg">You're on the launch list.</p>
        <p className="text-white/55 text-sm max-w-xs">{msg}</p>
      </div>
    );
  }
  return (
    <form onSubmit={submit} data-testid="waitlist-form" className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-[#48BB78] mb-1"><Mail size={16} /><span className="text-[11px] uppercase tracking-[0.25em] font-bold">Join the launch list</span></div>
      <p className="text-white/55 text-sm mb-1">Leave your email and we'll tell you the moment Kairo opens to the public.</p>
      <input data-testid="waitlist-name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name (optional)" className="w-full rounded-xl bg-[#0B1016] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#48BB78]/60 outline-none" />
      <input data-testid="waitlist-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="w-full rounded-xl bg-[#0B1016] border border-white/10 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#48BB78]/60 outline-none" />
      <button data-testid="waitlist-submit" type="submit" disabled={state === "loading"} className="btn-luxe text-sm flex items-center justify-center gap-2 !py-3">
        {state === "loading" ? <><Loader2 size={16} className="animate-spin" /> Adding you…</> : <>Join the list <ArrowRight size={15} /></>}
      </button>
    </form>
  );
}

function BookingCalendar({ onReserved }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeDay, setActiveDay] = useState(null);
  const [picked, setPicked] = useState(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | loading | done
  const [bookingUrl, setBookingUrl] = useState("https://www.upwork.com/");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/public/kairo-availability?days=10");
      setSlots(data.slots || []);
    } catch { setSlots([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Group slots by calendar day
  const byDay = {};
  slots.forEach(s => {
    const day = s.start_iso.slice(0, 10);
    (byDay[day] = byDay[day] || []).push(s);
  });
  const days = Object.keys(byDay).sort();
  useEffect(() => { if (!activeDay && days.length) setActiveDay(days[0]); }, [days, activeDay]);

  const fmtDay = (d) => {
    const dt = new Date(d + "T00:00:00Z");
    return { dow: dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), day: dt.getUTCDate(), mon: dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) };
  };
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";

  const reserve = async () => {
    if (!email.trim()) { toast.error("Enter your email to reserve"); return; }
    if (!picked) { toast.error("Pick a time slot first"); return; }
    setState("loading");
    try {
      const { data } = await api.post("/public/reserve", {
        name: name.trim(), email: email.trim(),
        slot_iso: picked.start_iso, slot_label: picked.label,
      });
      setBookingUrl(data.booking_url || "https://www.upwork.com/");
      setState("done");
      onReserved?.();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Could not reserve — check your email");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div data-testid="booking-success" className="flex flex-col items-center text-center gap-4 py-4">
        <div className="w-12 h-12 rounded-full bg-[#48BB78]/15 border border-[#48BB78]/40 flex items-center justify-center"><Check className="text-[#48BB78]" size={22} /></div>
        <p className="font-display font-bold text-lg">Slot reserved</p>
        <p className="text-white/60 text-sm">We noted <span className="text-white font-semibold">{picked?.label}</span>. Finish booking with Baazi on Upwork to lock it in.</p>
        <a data-testid="booking-continue-upwork" href={bookingUrl} target="_blank" rel="noopener noreferrer" className="btn-luxe text-sm flex items-center gap-2 !px-8 !py-3">
          Continue to Upwork <ArrowUpRight size={16} />
        </a>
      </div>
    );
  }

  return (
    <div data-testid="booking-calendar" className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-[#48BB78]"><CalendarDays size={16} /><span className="text-[11px] uppercase tracking-[0.25em] font-bold">Pick a slot</span></div>
      <p className="text-white/55 text-sm">Choose a time that suits you — then hop over to Upwork to confirm.</p>
      {loading ? (
        <div className="flex items-center gap-2 text-white/50 text-sm py-6"><Loader2 size={16} className="animate-spin" /> Loading availability…</div>
      ) : days.length === 0 ? (
        <p className="text-white/50 text-sm py-6">No open slots right now — please book directly on Upwork.</p>
      ) : (
        <>
          {/* Day chips */}
          <div className="flex gap-2 overflow-x-auto pb-1" data-testid="booking-days">
            {days.slice(0, 8).map(d => {
              const f = fmtDay(d);
              const on = activeDay === d;
              return (
                <button key={d} data-testid={`booking-day-${d}`} onClick={() => { setActiveDay(d); setPicked(null); }}
                  className={`flex-shrink-0 w-16 rounded-xl border px-2 py-2 text-center transition-colors ${on ? "border-[#48BB78] bg-[#48BB78]/15" : "border-white/10 bg-[#0B1016] hover:border-white/25"}`}>
                  <div className="text-[10px] uppercase tracking-wider text-white/45">{f.dow}</div>
                  <div className="font-display font-black text-lg leading-tight">{f.day}</div>
                  <div className="text-[10px] text-white/40">{f.mon}</div>
                </button>
              );
            })}
          </div>
          {/* Time slots */}
          <div className="grid grid-cols-3 gap-2" data-testid="booking-slots">
            {(byDay[activeDay] || []).slice(0, 9).map(s => {
              const on = picked?.start_iso === s.start_iso;
              return (
                <button key={s.start_iso} data-testid={`booking-slot-${s.start_iso}`} onClick={() => setPicked(s)}
                  className={`rounded-lg border px-2 py-2 text-xs font-semibold transition-colors flex items-center justify-center gap-1 ${on ? "border-[#48BB78] bg-[#48BB78]/20 text-white" : "border-white/10 bg-[#0B1016] text-white/70 hover:border-white/30"}`}>
                  <Clock size={11} /> {fmtTime(s.start_iso)}
                </button>
              );
            })}
          </div>
          {/* Contact + reserve */}
          <div className="flex flex-col gap-2 pt-1">
            <input data-testid="booking-name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="w-full rounded-xl bg-[#0B1016] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#48BB78]/60 outline-none" />
            <input data-testid="booking-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" className="w-full rounded-xl bg-[#0B1016] border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-[#48BB78]/60 outline-none" />
            <button data-testid="booking-reserve-btn" onClick={reserve} disabled={state === "loading" || !picked} className="btn-luxe text-sm flex items-center justify-center gap-2 !py-3 disabled:opacity-50">
              {state === "loading" ? <><Loader2 size={16} className="animate-spin" /> Reserving…</> : <>Reserve {picked ? `· ${fmtTime(picked.start_iso)}` : "a slot"} <ArrowRight size={15} /></>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function LandingPage() {
  const nav = useNavigate();
  const openUpwork = () => window.open(UPWORK_URL, "_blank", "noopener");
  const bgRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY || 0;
      if (bgRef.current) {
        bgRef.current.style.transform = `translate3d(0, ${y * 0.12}px, 0)`;
        bgRef.current.style.filter = `hue-rotate(${Math.min(y / 14, 55)}deg)`;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    const els = document.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    // Safety: reveal everything shortly after mount in case observer misses
    const fallback = setTimeout(() => document.querySelectorAll(".reveal").forEach((el) => el.classList.add("in")), 1200);
    return () => { window.removeEventListener("scroll", onScroll); io.disconnect(); clearTimeout(fallback); };
  }, []);

  return (
    <div className="relative isolate min-h-screen bg-[#0B1016] text-white overflow-x-hidden noise" data-testid="landing-page">
      {/* Animated background layers (scroll-reactive) */}
      <div ref={bgRef} className="fixed inset-0 -z-10 pointer-events-none overflow-hidden will-change-transform" aria-hidden="true">
        <div className="dot-grid absolute inset-0 opacity-40" />
        <div className="aurora" />
        <img src={IMG_BG} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.10] mix-blend-screen" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0B1016]" />
      </div>


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
            <span className="gradient-text-primary">Kairo.</span><br />The right moment to&nbsp;<RotatingWord words={["convert.", "book the call.", "answer 24/7.", "upsell.", "close it."]} />
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
        <p className="text-center text-[10px] uppercase tracking-[0.35em] font-bold text-white/30 mb-5">Drops into any website in one line</p>
        <div className="marquee-track items-center gap-4 text-lg">
          {[...PLATFORMS, ...PLATFORMS, ...PLATFORMS].map((p, i) => (
            <span key={i} className="pill-chip text-sm">
              <span className="pill-dot" /> {p}
            </span>
          ))}
        </div>
      </section>

      {/* ============ USE CASES (BENTO) ============ */}
      <section id="use-cases" data-testid="use-cases-section" className="max-w-7xl mx-auto px-6 py-28 reveal">
        <div className="max-w-2xl mb-14">
          <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#48BB78] mb-3">Who it's for</p>
          <h2 className="font-display font-black text-4xl md:text-5xl tracking-tight">Built for people who just need it to work.</h2>
          <p className="text-white/55 mt-4 leading-relaxed">Whether you sell products, run ads, or answer the same booking questions all day — Kairo picks up the moment a visitor lands and turns it into revenue.</p>
        </div>
        <div className="grid md:grid-cols-12 gap-6">
          {/* Large card — ecommerce */}
          <div className="md:col-span-7 glass neon-glow-hover rounded-3xl p-8 overflow-hidden relative group" data-testid="use-case-shopify">
            <div className="relative z-10">
              <ShoppingBag className="text-[#48BB78] mb-5" size={28} />
              <h3 className="font-display font-black text-2xl md:text-3xl tracking-tight mb-3">You run a store and just need a fix.</h3>
              <p className="text-white/55 text-sm md:text-base max-w-lg leading-relaxed">Visitors bounce with questions unanswered. Drop in one line of code and Kairo handles sizing, shipping, returns and order tracking — recovering the sales you were quietly losing.</p>
            </div>
            <div className="mt-6 rounded-2xl overflow-hidden border border-white/10 bg-[#0B1016] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.7)]">
              <img src={IMG_ECOM} alt="Modern online store" className="w-full h-auto block" loading="lazy" />
            </div>
          </div>
          {/* Medium card — ads */}
          <div className="md:col-span-5 glass neon-glow-hover rounded-3xl p-8 overflow-hidden relative group flex flex-col" data-testid="use-case-ads">
            <TrendingUp className="text-[#48BB78] mb-5" size={28} />
            <h3 className="font-display font-black text-2xl tracking-tight mb-3">You buy ads and need every click to convert.</h3>
            <p className="text-white/55 text-sm leading-relaxed">Paid traffic is expensive. Kairo greets each visitor instantly, qualifies them, and books the call — turning cold clicks into booked revenue.</p>
            <div className="img-frame mt-auto pt-0 h-40 mt-6">
              <img src={IMG_MARKETING} alt="Marketing analytics" className="w-full h-full object-cover" loading="lazy" />
            </div>
          </div>
          {/* Full card — service businesses / cleaning */}
          <div className="md:col-span-12 glass neon-glow-hover rounded-3xl overflow-hidden relative grid md:grid-cols-2 gap-0" data-testid="use-case-smb">
            <div className="p-8 md:p-10 flex flex-col justify-center">
              <Zap className="text-[#48BB78] mb-5" size={28} />
              <h3 className="font-display font-black text-2xl md:text-3xl tracking-tight mb-3">Service businesses that live and die by bookings.</h3>
              <p className="text-white/55 text-sm md:text-base leading-relaxed max-w-xl">Cleaning companies, contractors, salons, clinics — Kairo learns your services and prices, answers in 95+ languages, and books the job straight into your calendar, 24/7. It stops chasing quotes so you can do the work only you can do.</p>
            </div>
            <div className="relative min-h-[240px] md:min-h-full">
              <img src={IMG_CLEANING} alt="Professional cleaning service" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0D1117] via-[#0D1117]/40 to-transparent" />
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
              Kairo is offered exclusively to <span className="text-white font-semibold">Upwork clients</span> and is currently in private demo. Join the launch list, pick a slot below, then book a consultation with <span className="text-white font-semibold">Baazi Suufi</span> on Upwork to claim your place.
            </p>

            {/* Waitlist + Booking cards */}
            <div className="grid md:grid-cols-2 gap-5 w-full text-left mb-10">
              <div className="glass rounded-2xl p-6 border border-white/10" data-testid="waitlist-card">
                <WaitlistCapture />
              </div>
              <div className="glass rounded-2xl p-6 border border-white/10" data-testid="booking-card">
                <BookingCalendar />
              </div>
            </div>

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
      <section data-testid="testimonials-section" className="max-w-7xl mx-auto px-6 py-24 reveal">
        <div className="max-w-2xl mb-12">
          <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#48BB78] mb-3">Real results</p>
          <h2 className="font-display font-black text-4xl md:text-5xl tracking-tight">They tried a basic bot. Then they tried Kairo.</h2>
        </div>
        <div className="grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3 glass rounded-3xl p-8 md:p-10 relative overflow-hidden" data-testid="testimonial-featured">
            <div className="flex gap-1 mb-5">{[...Array(5)].map((_, i) => <Star key={i} size={16} className="star" />)}</div>
            <p className="font-display font-bold text-2xl md:text-3xl tracking-tight leading-snug">"We needed a bot for our website. The last freelancer gave us a basic AI that couldn't even hold a conversation — customers got frustrated and left. Baazi's Kairo actually quotes our prices, answers questions, and books cleaning jobs straight into our schedule. It runs circles around what we had. He nailed it."</p>
            <div className="mt-8 flex items-center gap-3">
              <img src={IMG_OWNER} alt="Fresh N Clean owner" className="w-12 h-12 rounded-full object-cover border border-[#48BB78]/40" />
              <div>
                <p className="font-bold text-sm">Owner &amp; Operator</p>
                <p className="text-xs text-white/45">Fresh N Clean LLC · Cleaning Services</p>
              </div>
            </div>
          </div>
          <div className="md:col-span-2 flex flex-col gap-6">
            <div className="glass rounded-3xl p-8 flex flex-col justify-center flex-1" data-testid="testimonial-support">
              <div className="flex gap-1 mb-4">{[...Array(5)].map((_, i) => <Star key={i} size={14} className="star" />)}</div>
              <p className="text-white/80 text-base leading-relaxed">"It booked three orders while I slept and answers customers better than my old support team. This is the evolution of the bot I demoed months ago."</p>
              <div className="mt-5">
                <p className="font-bold text-sm">Marcus Vale</p>
                <p className="text-xs text-white/45">Founder, Vale Athletics (Shopify)</p>
              </div>
            </div>
            <div className="glass rounded-3xl p-8 flex flex-col justify-center flex-1" data-testid="testimonial-marketer">
              <div className="flex gap-1 mb-4">{[...Array(5)].map((_, i) => <Star key={i} size={14} className="star" />)}</div>
              <p className="text-white/80 text-base leading-relaxed">"Every ad dollar goes further. Kairo catches visitors the second they land and turns clicks into booked calls."</p>
              <div className="mt-5">
                <p className="font-bold text-sm">Priya N.</p>
                <p className="text-xs text-white/45">Performance Marketer</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ FOOTER / WHY ============ */}
      <footer data-testid="footer" className="relative border-t border-white/10 bg-black px-6 pt-24 pb-14 overflow-hidden">
        <img src={IMG_BG} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover opacity-[0.08] mix-blend-screen pointer-events-none" />
        <div className="max-w-7xl mx-auto relative z-10">
          {/* WHY YOU NEED THIS */}
          <div className="reveal max-w-3xl mb-16">
            <p className="text-[11px] uppercase tracking-[0.3em] font-bold text-[#48BB78] mb-3">Why this matters</p>
            <h3 className="font-display font-black text-3xl md:text-4xl tracking-tight leading-tight">Even a “simple” website is leaking customers every day.</h3>
            <p className="text-white/60 mt-4 leading-relaxed">Every visitor who lands with a question and doesn't get an instant answer is a sale walking out the door. Just here to book me on Upwork for one small task? Perfect — but picture what happens once Kairo is live: it works every hour you don't, answers everyone, and quietly turns traffic you already paid for into booked revenue.</p>
          </div>
          <div className="reveal grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-20" data-testid="why-grid">
            {[
              { icon: Clock, title: "Never miss a lead", desc: "Replies in seconds, 24/7 — nights, weekends, holidays. You sleep, it sells." },
              { icon: TrendingUp, title: "Browsers → bookings", desc: "Qualifies each visitor and books the call or job right into your calendar." },
              { icon: Languages, title: "Sounds like you", desc: "Learns your business from your site & docs, in 95+ languages, on-brand." },
              { icon: Zap, title: "Live in minutes", desc: "One line of code on Shopify, WordPress, Wix — anywhere. No dev team needed." },
            ].map((w, i) => (
              <div key={i} className="glass rounded-2xl p-6 border border-white/5" data-testid={`why-${i}`}>
                <div className="w-10 h-10 rounded-xl bg-[#48BB78]/15 border border-[#48BB78]/30 flex items-center justify-center text-[#48BB78] mb-4"><w.icon size={18} /></div>
                <h4 className="font-display font-bold text-base tracking-tight mb-1.5">{w.title}</h4>
                <p className="text-white/50 text-sm leading-relaxed">{w.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="font-display font-black tracking-tighter text-[16vw] md:text-[11vw] leading-none">
            <span className="gradient-text-primary">Let's</span> talk.
          </h2>
          <div className="mt-10 flex flex-col md:flex-row md:items-end justify-between gap-8 border-t border-white/10 pt-10">
            <div className="max-w-md">
              <KairoLogo size={28} />
              <p className="text-white/45 text-sm mt-4">The AI concierge that catches high-intent visitors and turns them into revenue. Book me on Upwork and I'll set up Kairo for your business.</p>
            </div>
            <div className="flex flex-col gap-3 md:items-end">
              <button data-testid="footer-upwork-btn" onClick={openUpwork} className="btn-luxe text-sm flex items-center gap-2 !px-8 !py-3.5 w-fit">
                Book me on Upwork <ArrowUpRight size={16} />
              </button>
              <button onClick={() => nav("/login")} className="text-sm text-white/60 hover:text-white transition-colors link-underline w-fit">Client Login</button>
            </div>
          </div>
          <p className="text-white/30 text-xs mt-12">© 2026 Kairo · Built by Baazi Suufi</p>
        </div>
      </footer>
    </div>
  );
}
