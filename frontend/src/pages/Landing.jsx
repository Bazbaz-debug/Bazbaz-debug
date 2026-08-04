import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, Zap, Globe, Shield, ArrowRight, Sparkles, MessagesSquare, Star, PhoneCall, ShoppingBag, Package, Camera, Languages, Mail, Wand2, PlayCircle, Check } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import MouseGradient from "@/components/MouseGradient";
import ParticleCanvas from "@/components/ParticleCanvas";

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
  { label: "Shopify" },
  { label: "WordPress" },
  { label: "Webflow" },
  { label: "Wix" },
  { label: "Squarespace" },
  { label: "Custom HTML" },
  { label: "WooCommerce" },
  { label: "BigCommerce" },
  { label: "Magento" },
  { label: "React apps" },
];

const REVIEWS = [
  {
    name: "Priya Ramanathan",
    role: "Founder, Northwind Apparel",
    text: "Replaced our entire live-chat team on nights and weekends. Rozio-Killer handles 92% of tickets, and the ones it escalates arrive with a full transcript. Conversion up 34%.",
    stars: 5,
  },
  {
    name: "Marcus Chen",
    role: "Head of Ops, Atlas Supply",
    text: "The photo-to-product search is unreal. Customers snap a picture, our bot matches from our catalog, guides them straight to checkout. Order tracking inside the chat killed 3,000 emails/mo.",
    stars: 5,
  },
  {
    name: "Sofia Alves",
    role: "CX Lead, Meridian DTC",
    text: "Our Portuguese-speaking customers finally have parity with our English service. The AI concierge auto-detects and replies in 40+ languages we tested. Feels like magic.",
    stars: 5,
  },
  {
    name: "Deon Reed",
    role: "COO, PixelMate Studio",
    text: "The unified inbox is the killer feature. Chat + email in one view, take over any AI conversation with one click. Our team ships more, apologises less.",
    stars: 5,
  },
];

const TRUST_LOGOS = ["NORTHWIND", "ACME.IO", "PIXELMATE", "ATLAS SUPPLY", "MERIDIAN", "AURORA", "HELIX", "LUMEN", "ORBIT", "NOVA LABS"];

export default function Landing() {
  const [signupOpen, setSignupOpen] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    api.get("/settings/public").then(r => setSignupOpen(r.data.public_signup_enabled)).catch(() => {});
  }, []);

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
          <a href="#integrations" className="text-sm text-white/60 hover:text-white transition-colors link-underline">Integrations</a>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" data-testid="nav-login-link" className="text-sm text-white/70 hover:text-white transition-colors">Login</Link>
          {signupOpen && (
            <Button data-testid="nav-signup-btn" onClick={() => nav("/register")} className="bg-[#48BB78] hover:bg-[#38A169] text-[#0D1117] hover:text-white font-bold rounded-md">
              Get Access
            </Button>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="relative px-6 md:px-16 pt-16 md:pt-24 pb-16 dot-grid noise overflow-hidden">
        <MouseGradient color="#48BB78" intensity={0.10} />
        <ParticleCanvas color="#48BB78" density={70}/>

        {/* Floating orbs */}
        <div className="absolute pointer-events-none top-24 -right-40 w-[520px] h-[520px] rounded-full float-orb" style={{ background: "radial-gradient(circle, rgba(72,187,120,0.15) 0%, transparent 65%)" }}/>
        <div className="absolute pointer-events-none top-40 -left-32 w-[420px] h-[420px] rounded-full float-orb" style={{ background: "radial-gradient(circle, rgba(66,153,225,0.10) 0%, transparent 60%)", animationDelay: "3s" }}/>

        <div className="max-w-6xl relative z-10 fade-up">
          <div className="inline-flex items-center gap-2 border border-[#48BB78]/40 rounded-full px-3 py-1 mb-8 text-xs tracking-[0.2em] uppercase font-bold text-[#48BB78] bg-[#48BB78]/5">
            <Sparkles size={12}/> Cross-Platform · GPT 5.6 Terra
          </div>
          <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tighter mb-8">
            The AI concierge<br/>
            <span className="gradient-text-primary">that outperforms</span><br/>
            every chatbot.
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mb-10 leading-relaxed">
            Drop one line of code into Shopify, WordPress, or any site. Get a face-to-face AI concierge that answers FAQs, upsells products, tracks orders, understands photos, speaks 95+ languages &mdash; and hands off to a human when it matters.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button data-testid="hero-cta-btn" onClick={() => nav(signupOpen ? "/register" : "/login")} size="lg" className="bg-[#48BB78] hover:bg-[#38A169] text-[#0D1117] hover:text-white font-bold rounded-md text-base neon-glow-hover px-8 h-14">
              {signupOpen ? "Start Free Trial" : "Login to Continue"} <ArrowRight className="ml-2" size={18}/>
            </Button>
            <Button data-testid="hero-secondary-btn" onClick={() => nav("/login")} variant="outline" size="lg" className="border-white/20 bg-transparent hover:bg-white/5 text-white rounded-md h-14">
              <PlayCircle size={16} className="mr-2"/> View Live Demo
            </Button>
          </div>

          {/* Rating strip */}
          <div className="flex items-center gap-6 mt-10 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="flex">
                {[0,1,2,3,4].map(i => <Star key={i} size={16} className="star"/>)}
              </div>
              <span className="text-white text-sm font-bold">4.9</span>
              <span className="text-white/50 text-sm">from 240+ shops</span>
            </div>
            <span className="text-white/20">·</span>
            <span className="text-white/60 text-sm">Trusted by <b className="text-white">1,200+</b> stores</span>
            <span className="text-white/20">·</span>
            <span className="text-white/60 text-sm"><b className="text-white">92%</b> tickets resolved without a human</span>
          </div>
        </div>
      </section>

      {/* MARQUEE PILLS - what the bot does */}
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

      {/* REVIEWS */}
      <section id="reviews" className="px-6 md:px-16 py-24 bg-gradient-to-b from-transparent via-[#0D1218] to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="uppercase text-xs tracking-[0.3em] text-[#48BB78] font-bold mb-3">Customer Love</p>
            <h2 className="font-display font-black text-4xl md:text-6xl leading-tight tracking-tight">Founders can't stop talking.</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {REVIEWS.map((r, i) => (
              <div key={i} data-testid={`review-${i}`} className="bg-[#141B24] border border-white/5 rounded-2xl p-7 hover:border-[#48BB78]/40 transition-colors">
                <div className="flex mb-3">
                  {Array.from({length: r.stars}).map((_, si) => <Star key={si} size={14} className="star mr-0.5"/>)}
                </div>
                <p className="text-white text-[15px] leading-relaxed mb-5">&ldquo;{r.text}&rdquo;</p>
                <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg,#48BB78,#38B2AC)` }}>
                    <span className="text-[#0D1117] font-black text-sm">{r.name.split(" ").map(n=>n[0]).join("")}</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{r.name}</p>
                    <p className="text-white/50 text-xs">{r.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* INTEGRATION PILLS (second marquee) */}
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

      {/* TRUSTED BY */}
      <section className="px-6 md:px-16 py-20">
        <p className="text-center uppercase text-xs tracking-[0.3em] text-[#48BB78] font-bold mb-8">Trusted by ambitious teams</p>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#0B1016] to-transparent"/>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#0B1016] to-transparent"/>
          <div className="marquee-track marquee-track-fast">
            {[...TRUST_LOGOS, ...TRUST_LOGOS].map((brand, i) => (
              <span key={i} className="mx-10 text-2xl md:text-3xl font-display font-black text-white/25 whitespace-nowrap">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-16 py-24">
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 50% 50%, rgba(72,187,120,0.10) 0%, transparent 60%)" }}/>
          <h2 className="font-display font-black text-4xl md:text-6xl tracking-tighter mb-6 relative">Ready to replace your Monday support inbox?</h2>
          <p className="text-white/70 text-lg mb-8 relative">Set it up in under 4 minutes. Refunds on us if it&apos;s not the best 4 minutes of your quarter.</p>
          <div className="flex flex-wrap justify-center gap-4 relative">
            <Button data-testid="footer-cta-btn" onClick={() => nav(signupOpen ? "/register" : "/login")} size="lg" className="bg-[#48BB78] hover:bg-[#38A169] text-[#0D1117] hover:text-white font-bold rounded-md text-base neon-glow-hover px-8 h-14">
              {signupOpen ? "Claim Your Invite" : "Login"} <Zap className="ml-2" size={18}/>
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6 mt-8 text-white/50 text-sm relative">
            <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[#48BB78]"/> No credit card</span>
            <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[#48BB78]"/> 14-day trial</span>
            <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[#48BB78]"/> Cancel anytime</span>
          </div>
        </div>
      </section>

      <footer className="px-6 md:px-16 py-8 border-t border-white/5 text-sm text-white/50 flex flex-col md:flex-row justify-between gap-3">
        <span>&copy; 2026 Rozio-Killer Inc. Built for humans, powered by AI.</span>
        <div className="flex gap-6">
          <Link to="/setup" className="hover:text-white transition-colors">Install</Link>
          <Link to="/login" className="hover:text-white transition-colors">Login</Link>
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
