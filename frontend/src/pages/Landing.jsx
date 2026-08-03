import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bot, Zap, Globe, Shield, ArrowRight, Sparkles, MessagesSquare } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import MouseGradient from "@/components/MouseGradient";

export default function Landing() {
  const [signupOpen, setSignupOpen] = useState(true);
  const nav = useNavigate();
  useEffect(() => {
    api.get("/settings/public").then(r => setSignupOpen(r.data.public_signup_enabled)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#1A202C] text-white overflow-x-hidden">
      {/* NAV */}
      <nav className="sticky top-0 z-40 glass px-6 md:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-[#48BB78] flex items-center justify-center text-[#1A202C]"><Bot size={20} strokeWidth={2.5}/></div>
          <span className="font-display font-black text-xl">Rozio-Killer</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" data-testid="nav-login-link" className="text-sm text-[#A0AEC0] hover:text-white transition-colors link-underline">Login</Link>
          {signupOpen && (
            <Button data-testid="nav-signup-btn" onClick={() => nav("/register")} className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">
              Get Access
            </Button>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section className="relative px-6 md:px-16 pt-20 pb-32 dot-grid noise overflow-hidden">
        <MouseGradient color="#48BB78" intensity={0.10} />
        <div className="max-w-6xl relative z-10">
          <div className="inline-flex items-center gap-2 border border-[#48BB78]/40 rounded-full px-3 py-1 mb-8 text-xs tracking-[0.2em] uppercase font-bold text-[#48BB78]">
            <Sparkles size={12}/> Cross-Platform AI Widgets
          </div>
          <h1 className="font-display font-black text-5xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tighter mb-8">
            The AI concierge<br/>
            <span className="text-[#48BB78]">that outperforms</span><br/>
            every chatbot.
          </h1>
          <p className="text-lg md:text-xl text-[#A0AEC0] max-w-2xl mb-10 leading-relaxed">
            Drop a single script into Shopify, WordPress, or any custom HTML site. Get a face-to-face AI avatar that speaks every language, sells your products, and books your calendar &mdash; all in real time.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button data-testid="hero-cta-btn" onClick={() => nav(signupOpen ? "/register" : "/login")} size="lg" className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md text-base neon-glow-hover">
              {signupOpen ? "Start Free Trial" : "Login to Continue"} <ArrowRight className="ml-2" size={18}/>
            </Button>
            <Button data-testid="hero-secondary-btn" onClick={() => nav("/login")} variant="outline" size="lg" className="border-white/20 bg-transparent hover:bg-white/5 text-white rounded-md">
              View Live Demo
            </Button>
          </div>
        </div>
      </section>

      {/* BENTO FEATURES */}
      <section className="px-6 md:px-16 py-24">
        <div className="grid grid-cols-12 gap-6">
          <FeatureCard testId="feat-multi-platform" className="col-span-12 md:col-span-8" icon={<Globe size={22}/>} title="Shopify + WordPress + Custom HTML" body="One embed script, three ecosystems. Auto-detects product catalog schemas and delivery timelines on sync."/>
          <FeatureCard testId="feat-avatar" className="col-span-12 md:col-span-4" icon={<Bot size={22}/>} title="Live Video Avatar" body="Face-to-face AI presence, not a plain text bubble."/>
          <FeatureCard testId="feat-langs" className="col-span-12 md:col-span-4" icon={<MessagesSquare size={22}/>} title="Multi-Language" body="Detects & replies in the customer's language automatically."/>
          <FeatureCard testId="feat-branding" className="col-span-12 md:col-span-4" icon={<Sparkles size={22}/>} title="Brand-Matched Widget" body="Pick background, bubble & accent colors. Preview updates live."/>
          <FeatureCard testId="feat-secure" className="col-span-12 md:col-span-4" icon={<Shield size={22}/>} title="Invite-Only Access" body="Enterprise flag lets you gate the funnel and issue manual credentials."/>
        </div>
      </section>

      {/* TRUST BAR */}
      <section className="px-6 md:px-16 py-16 border-y border-white/5">
        <p className="uppercase text-xs tracking-[0.3em] text-[#48BB78] font-bold mb-6">Trusted by ambitious teams</p>
        <div className="flex flex-wrap gap-x-16 gap-y-6 text-2xl font-display font-black text-white/40">
          <span>NORTHWIND</span><span>ACME.IO</span><span>PIXELMATE</span><span>ATLAS SUPPLY</span><span>MERIDIAN</span>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 md:px-16 py-24">
        <div className="max-w-3xl">
          <h2 className="font-display font-black text-4xl md:text-6xl tracking-tighter mb-6">Ready to replace your support team&apos;s Monday?</h2>
          <p className="text-[#A0AEC0] text-lg mb-8">Set it up in under 4 minutes. Refunds on us if it's not the best 4 minutes of your quarter.&nbsp;</p>
          <Button data-testid="footer-cta-btn" onClick={() => nav(signupOpen ? "/register" : "/login")} size="lg" className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">
            {signupOpen ? "Claim Your Invite" : "Login"} <Zap className="ml-2" size={18}/>
          </Button>
        </div>
      </section>

      <footer className="px-6 md:px-16 py-8 border-t border-white/5 text-sm text-[#A0AEC0] flex justify-between">
        <span>&copy; 2026 Rozio-Killer Inc.</span>
        <span>Built with neon &amp; caffeine.</span>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, body, className = "", testId }) {
  return (
    <div data-testid={testId} className={`bg-[#2D3748] border border-white/5 hover:border-[#48BB78]/50 rounded-lg p-8 transition-colors duration-200 ${className}`}>
      <div className="w-11 h-11 rounded-md bg-[#48BB78]/10 border border-[#48BB78]/30 text-[#48BB78] flex items-center justify-center mb-5">{icon}</div>
      <h3 className="font-display font-bold text-xl mb-2 text-white">{title}</h3>
      <p className="text-[#A0AEC0] leading-relaxed">{body}</p>
    </div>
  );
}
