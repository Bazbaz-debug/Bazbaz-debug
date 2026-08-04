import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, Zap, Sparkles, MessagesSquare, Star, PhoneCall, ShoppingBag, Package, Camera, Languages, Mail, Wand2, ArrowRight, Briefcase, Wrench } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import MouseGradient from "@/components/MouseGradient";
import ParticleCanvas from "@/components/ParticleCanvas";

// Baazi Suufi's Upwork profile / booking link (update via ENV or hardcode when known)
const BAAZI_BOOKING_URL = "https://www.upwork.com/freelancers/baazisuufi";

// ================ CONSTANT DATA ================
const PILLS_ROW_1 = [
  { icon: ShoppingBag, label: "Product FAQ" },
  { icon: Package, label: "Order tracking" },
  { icon: Camera, label: "Photo → product" },
  { icon: Languages, label: "95+ languages" },
  { icon: PhoneCall, label: "Voice calls" },
  { icon: Mail, label: "Unified inbox" },
  { icon: Wand2, label: "Upsells & recommendations" },
  { icon: Sparkles, label: "AI + Human handoff" },
  { icon: MessagesSquare, label: "Live chat" },
];

const PILLS_ROW_2 = [
  { label: "Shopify" }, { label: "WordPress" }, { label: "Webflow" }, { label: "Wix" }, { label: "Squarespace" },
  { label: "Custom HTML" }, { label: "WooCommerce" }, { label: "BigCommerce" }, { label: "Magento" }, { label: "React apps" },
];

// Featured review pinned to the top + one supporting review
const FEATURED_REVIEW = {
  name: "CEO",
  company: "Fresh N Clean Services LLC",
  role: "CEO · Fresh N Clean Services LLC",
  text: "I hired someone to build my website and all they gave me was a basic bot chat. Then Baazi came in and did a great job — the chat gives live updates in any language, and books Zoom meetings with clients on top of that. We're on step 3 and it keeps getting better.",
  stars: 5,
  featured: true,
};

const REVIEW = {
  name: "Marcus Chen",
  role: "Head of Ops, Atlas Supply",
  text: "The photo-to-product search is unreal. Customers snap a picture, our bot matches from our catalog, guides them straight to checkout. Order tracking inside the chat killed 3,000 emails/mo.",
  stars: 5,
};

export default function Landing() {
  const nav = useNavigate();
  const [signupOpen, setSignupOpen] = useState(false);

  useEffect(() => {
    // signup availability is still fetched but the public CTA is a booking link,
    // so signup only controls whether the discreet "Client login" hint appears.
    api.get("/settings/public").then(r => setSignupOpen(r.data.public_signup_enabled)).catch(() => {});
  }, []);

  const bookBaazi = () => window.open(BAAZI_BOOKING_URL, "_blank", "noopener,noreferrer");

  return (
    <div className="min-h-screen bg-[#0B1016] text-white overflow-x-hidden">
      {/* NAV */}
      <nav data-testid="landing-nav" className="sticky top-0 z-40 glass px-6 md:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#48BB78] to-[#38A169] flex items-center justify-center text-[#0D1117] shadow-lg shadow-[#48BB78]/20"><Bot size={20} strokeWidth={2.5}/></div>
          <span className="font-display font-black text-xl">Rozio-Killer</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm text-white/60 hover:text-white transition-colors link-underline">Features</a>
          <a href="#reviews" className="text-sm text-white/60 hover:text-white transition-colors link-underline">Reviews</a>
          <a href="#status" className="text-sm text-white/60 hover:text-white transition-colors link-underline">Status</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" data-testid="nav-login-link" className="text-sm text-white/70 hover:text-white transition-colors">Client Login</Link>
          <Button data-testid="nav-book-btn" onClick={bookBaazi} className="bg-[#48BB78] hover:bg-[#38A169] text-[#0D1117] hover:text-white font-bold rounded-md">
            <Briefcase size={14} className="mr-1.5"/> Book Baazi
          </Button>
        </div>
      </nav>

      {/* IN-DEVELOPMENT BANNER */}
      <div id="status" data-testid="dev-banner" className="border-b border-[#ED8936]/30 bg-[#ED8936]/10 px-6 md:px-12 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center gap-2 justify-center flex-wrap text-center">
          <Wrench size={14} className="text-[#ED8936] flex-shrink-0"/>
          <p className="text-[12px] text-white/85">
            <b className="text-[#ED8936]">In development · Not publicly available.</b>
            &nbsp;This project is a working prototype and may or may not become a permanent part of my services. To try it or commission a custom build, book me directly on&nbsp;
            <a href={BAAZI_BOOKING_URL} target="_blank" rel="noopener noreferrer" className="underline font-bold text-white hover:text-[#48BB78]" data-testid="banner-book-link">Upwork</a>.
          </p>
        </div>
      </div>

      {/* HERO */}
      <section className="relative px-6 md:px-16 pt-16 md:pt-24 pb-16 dot-grid noise overflow-hidden">
        <MouseGradient color="#48BB78" intensity={0.10} />
        <ParticleCanvas color="#48BB78" density={70}/>

        <div className="absolute pointer-events-none top-24 -right-40 w-[520px] h-[520px] rounded-full float-orb" style={{ background: "radial-gradient(circle, rgba(72,187,120,0.15) 0%, transparent 65%)" }}/>
        <div className="absolute pointer-events-none top-40 -left-32 w-[420px] h-[420px] rounded-full float-orb" style={{ background: "radial-gradient(circle, rgba(66,153,225,0.10) 0%, transparent 60%)", animationDelay: "3s" }}/>

        <div className="max-w-6xl relative z-10 fade-up">
          <div className="inline-flex items-center gap-2 border border-[#48BB78]/40 rounded-full px-3 py-1 mb-8 text-xs tracking-[0.2em] uppercase font-bold text-[#48BB78] bg-[#48BB78]/5">
            <Sparkles size={12}/> Built by Baazi Suufi · Available via Upwork
          </div>
          <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tighter mb-8">
            The AI concierge<br/>
            <span className="gradient-text-primary">that outperforms</span><br/>
            every chatbot.
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mb-10 leading-relaxed">
            Drop one line of code into Shopify, WordPress, or any site. A face-to-face AI concierge that answers FAQs, upsells products, tracks orders, understands photos, speaks 95+ languages &mdash; and hands off to a human when it matters.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button data-testid="hero-book-btn" onClick={bookBaazi} size="lg" className="bg-[#48BB78] hover:bg-[#38A169] text-[#0D1117] hover:text-white font-bold rounded-md text-base neon-glow-hover px-8 h-14">
              <Briefcase size={16} className="mr-2"/> Book Baazi on Upwork <ArrowRight className="ml-2" size={18}/>
            </Button>
            {signupOpen && (
              <Button data-testid="hero-login-btn" onClick={() => nav("/login")} variant="outline" size="lg" className="border-white/20 bg-transparent hover:bg-white/5 text-white rounded-md h-14">
                Client Login
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* MARQUEE PILLS */}
      <section className="relative py-8 border-y border-white/5 bg-[#0D1218] overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#0D1218] to-transparent"/>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#0D1218] to-transparent"/>
        <div className="marquee-track" data-testid="marquee-pills">
          {[...PILLS_ROW_1, ...PILLS_ROW_1].map((p, i) => {
            const Icon = p.icon;
            return (
              <div key={i} className="inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-2 mx-2 bg-white/[0.03] hover:border-[#48BB78]/50 hover:bg-[#48BB78]/5 transition-colors">
                <Icon size={14} className="text-[#48BB78]"/>
                <span className="text-sm font-bold text-white whitespace-nowrap">{p.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* FEATURE GRID */}
      <section id="features" className="px-6 md:px-16 py-24 max-w-7xl mx-auto">
        <div className="mb-14">
          <p className="uppercase text-xs tracking-[0.3em] text-[#48BB78] font-bold mb-3">Capabilities</p>
          <h2 className="font-display font-black text-4xl md:text-6xl leading-tight tracking-tight max-w-3xl">One bot. Every job your CX team hates.</h2>
        </div>
        <div className="grid grid-cols-12 gap-4">
          <FeatureCard testId="feat-faq" className="col-span-12 md:col-span-6" icon={<ShoppingBag size={22}/>}
            title="Answers FAQs about products, shipping & policies instantly"
            body="Reads your website + PDFs + product catalog and cites accurate answers in under 400ms."/>
          <FeatureCard testId="feat-upsell" className="col-span-12 md:col-span-6" icon={<Wand2 size={22}/>}
            title="Recommends products & upsells, guides shoppers to checkout"
            body="Understands buying intent. Suggests related items. Injects real product URLs into the reply."/>
          <FeatureCard testId="feat-track" className="col-span-12 md:col-span-4" icon={<Package size={22}/>}
            title="Track orders with visual package journey"
            body="Real-time timeline — Ordered → Packed → Shipped → Delivered — from your store's own tracking."/>
          <FeatureCard testId="feat-photo" className="col-span-12 md:col-span-4" icon={<Camera size={22}/>}
            title="Understands images — send a photo, find the product"
            body="Visitors upload a picture. The AI describes it and matches against your catalog."/>
          <FeatureCard testId="feat-lang" className="col-span-12 md:col-span-4" icon={<Languages size={22}/>}
            title="95+ languages with real-time translation"
            body="Auto-detects the visitor's language on every message and replies in the same one."/>
          <FeatureCard testId="feat-inbox" className="col-span-12 md:col-span-6" icon={<Mail size={22}/>}
            title="Unified helpdesk inbox — chat + email"
            body="Manage every conversation from one screen. Review AI replies, take over anytime, close threads."/>
          <FeatureCard testId="feat-voice" className="col-span-12 md:col-span-6" icon={<PhoneCall size={22}/>}
            title="Face-to-face voice call, hands-free"
            body="Visitors can tap a phone icon and speak to a photorealistic AI face. Voice matched to persona."/>
        </div>
      </section>

      {/* REVIEWS (featured + one supporting) */}
      <section id="reviews" className="px-6 md:px-16 py-24 bg-gradient-to-b from-transparent via-[#0D1218] to-transparent">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="uppercase text-xs tracking-[0.3em] text-[#48BB78] font-bold mb-3">Client Words</p>
            <h2 className="font-display font-black text-4xl md:text-6xl leading-tight tracking-tight">Straight from the people who booked me.</h2>
          </div>

          {/* Featured review */}
          <div data-testid="review-featured" className="relative bg-gradient-to-br from-[#48BB78]/8 via-[#141B24] to-[#141B24] border border-[#48BB78]/40 rounded-3xl p-8 md:p-10 mb-6 overflow-hidden">
            <span className="absolute top-6 right-6 uppercase text-[10px] tracking-[0.3em] font-bold px-3 py-1 rounded-full bg-[#48BB78]/20 text-[#48BB78] border border-[#48BB78]/40">Top Review</span>
            <div className="pointer-events-none absolute -top-10 -right-10 w-56 h-56 rounded-full" style={{ background: "radial-gradient(circle, rgba(72,187,120,0.18) 0%, transparent 65%)", filter: "blur(20px)" }}/>
            <div className="flex mb-4 relative">
              {Array.from({length: FEATURED_REVIEW.stars}).map((_, si) => <Star key={si} size={18} className="star mr-0.5"/>)}
            </div>
            <p className="text-white text-xl md:text-2xl leading-relaxed mb-8 relative font-light">
              &ldquo;{FEATURED_REVIEW.text}&rdquo;
            </p>
            <div className="flex items-center gap-3 pt-6 border-t border-white/10 relative">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg,#48BB78,#38B2AC)` }}>
                <span className="text-[#0D1117] font-black text-sm">CEO</span>
              </div>
              <div>
                <p className="text-white text-sm font-bold">{FEATURED_REVIEW.name}</p>
                <p className="text-white/60 text-xs">{FEATURED_REVIEW.role}</p>
              </div>
            </div>
          </div>

          {/* Second review — smaller */}
          <div data-testid="review-1" className="bg-[#141B24] border border-white/5 rounded-2xl p-7 hover:border-[#48BB78]/40 transition-colors">
            <div className="flex mb-3">
              {Array.from({length: REVIEW.stars}).map((_, si) => <Star key={si} size={14} className="star mr-0.5"/>)}
            </div>
            <p className="text-white text-[15px] leading-relaxed mb-5">&ldquo;{REVIEW.text}&rdquo;</p>
            <div className="flex items-center gap-3 pt-4 border-t border-white/5">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg,#48BB78,#38B2AC)` }}>
                <span className="text-[#0D1117] font-black text-sm">{REVIEW.name.split(" ").map(n=>n[0]).join("")}</span>
              </div>
              <div>
                <p className="text-white text-sm font-bold">{REVIEW.name}</p>
                <p className="text-white/50 text-xs">{REVIEW.role}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATION MARQUEE */}
      <section id="integrations" className="relative py-12 border-y border-white/5 overflow-hidden">
        <p className="text-center uppercase text-xs tracking-[0.3em] text-[#48BB78] font-bold mb-6">Works everywhere · one script</p>
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#0B1016] to-transparent"/>
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#0B1016] to-transparent"/>
        <div className="marquee-track marquee-track-reverse">
          {[...PILLS_ROW_2, ...PILLS_ROW_2].map((p, i) => (
            <div key={i} className="inline-flex items-center gap-2 border border-white/10 rounded-full px-5 py-2 mx-1.5 bg-white/[0.03]">
              <span className="text-sm font-bold text-white/80 whitespace-nowrap">{p.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA — Book Baazi */}
      <section className="px-6 md:px-16 py-24">
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 50%, rgba(72,187,120,0.10) 0%, transparent 60%)" }}/>
          <p className="uppercase text-xs tracking-[0.3em] text-[#48BB78] font-bold mb-3 relative">Book me directly</p>
          <h2 className="font-display font-black text-4xl md:text-6xl tracking-tighter mb-6 relative">Want this on your site?</h2>
          <p className="text-white/70 text-lg mb-8 relative">Not open for public signup. Book Baazi Suufi on Upwork — I&apos;ll deploy this concierge for your store, in your brand, wired to your catalog.</p>
          <div className="flex flex-wrap justify-center gap-4 relative">
            <Button data-testid="footer-book-btn" onClick={bookBaazi} size="lg" className="bg-[#48BB78] hover:bg-[#38A169] text-[#0D1117] hover:text-white font-bold rounded-md text-base neon-glow-hover px-8 h-14">
              <Briefcase size={16} className="mr-2"/> Book Baazi on Upwork <Zap className="ml-2" size={18}/>
            </Button>
          </div>
          <p className="text-white/40 text-xs mt-6 relative">Currently in development · May or may not become a permanent service · Delivery timelines discussed on Upwork</p>
        </div>
      </section>

      <footer className="px-6 md:px-16 py-8 border-t border-white/5 text-sm text-white/50 flex flex-col md:flex-row justify-between gap-3">
        <span>&copy; 2026 Baazi Suufi. Built for humans, powered by AI.</span>
        <div className="flex gap-6">
          <a href={BAAZI_BOOKING_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Book on Upwork</a>
          <Link to="/login" className="hover:text-white transition-colors">Client Login</Link>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, body, className = "", testId }) {
  return (
    <div data-testid={testId} className={`bg-[#141B24] border border-white/5 hover:border-[#48BB78]/50 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_60px_-15px_rgba(72,187,120,0.15)] ${className}`}>
      <div className="w-11 h-11 rounded-xl bg-[#48BB78]/10 border border-[#48BB78]/30 text-[#48BB78] flex items-center justify-center mb-5">{icon}</div>
      <h3 className="font-display font-bold text-xl mb-2 text-white leading-snug">{title}</h3>
      <p className="text-white/60 leading-relaxed text-sm">{body}</p>
    </div>
  );
}
