import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bot, Lock, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KairoMark, KairoLuxeLogo } from "@/components/KairoLogo";

function RotatingWord({ words }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % words.length), 2100);
    return () => clearInterval(t);
  }, [words.length]);
  return <span key={i} className="flip-word gradient-text-primary">{words[i]}</span>;
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success("Welcome back");
      nav(u.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      setError(
        detail ||
        (status === 401 || status === 400
          ? "That email and password don't match. Please try again."
          : "We couldn't sign you in. Check your connection and try again.")
      );
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[#0D1117] relative dot-grid noise overflow-hidden isolate">
        <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true"><div className="aurora" /></div>
        <Link to="/" className="relative z-10" data-testid="login-luxe-logo">
          <KairoLuxeLogo />
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="uppercase text-xs tracking-[0.3em] text-[#48BB78] font-bold mb-3">Private &amp; Exclusive</p>
          <h1 className="font-display font-black text-5xl leading-none tracking-tighter mb-4">Log in to&nbsp;<RotatingWord words={["convert.", "book.", "automate.", "grow.", "ship."]} /></h1>
          <p className="text-[#A0AEC0]">Your embeddable AI concierge is waiting on the other side.</p>
        </div>
        <p className="text-xs text-[#A0AEC0] relative z-10">Your embeddable AI concierge, isolated per workspace.</p>
      </div>
      <div className="flex items-center justify-center p-6 md:p-12 bg-[#1A202C]">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-8 text-[#48BB78]"><Lock size={18}/><span className="uppercase text-xs tracking-[0.3em] font-bold">Secure Login</span></div>
          <h2 className="font-display font-black text-3xl mb-8 tracking-tight">Welcome back.</h2>
          <div className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-[#A0AEC0]">Email</Label>
              <Input data-testid="login-email-input" id="email" type="email" required value={email} onChange={e => { setEmail(e.target.value); if (error) setError(""); }} className={`mt-1.5 bg-[#2D3748] text-white h-11 transition-all duration-300 ease-out will-change-transform focus:-translate-y-0.5 focus:border-[#48BB78] focus:bg-[#323d4e] focus:shadow-[0_0_0_3px_rgba(72,187,120,0.20),0_10px_25px_-8px_rgba(72,187,120,0.45)] ${error ? "border-red-500/60" : "border-white/10"}`} placeholder="you@company.com"/>
            </div>
            <div>
              <Label htmlFor="password" className="text-[#A0AEC0]">Password</Label>
              <Input data-testid="login-password-input" id="password" type="password" required value={password} onChange={e => { setPassword(e.target.value); if (error) setError(""); }} className={`mt-1.5 bg-[#2D3748] text-white h-11 transition-all duration-300 ease-out will-change-transform focus:-translate-y-0.5 focus:border-[#48BB78] focus:bg-[#323d4e] focus:shadow-[0_0_0_3px_rgba(72,187,120,0.20),0_10px_25px_-8px_rgba(72,187,120,0.45)] ${error ? "border-red-500/60" : "border-white/10"}`} placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"/>
            </div>
            {error && (
              <div data-testid="login-error" role="alert" className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-sm text-red-300 animate-in fade-in slide-in-from-top-1 duration-300">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0"/>
                <span>{error}</span>
              </div>
            )}
            <Button data-testid="login-submit-btn" type="submit" disabled={busy} className="w-full bg-[#48BB78] text-[#1A202C] font-bold h-11 rounded-md transition-all duration-300 ease-out will-change-transform hover:bg-[#38A169] hover:text-white hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-8px_rgba(72,187,120,0.6)] active:translate-y-0 active:scale-[0.99] disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none">
              {busy ? "Signing in..." : "Sign in"}
            </Button>
            <div className="flex justify-between text-sm">
              <Link to="/forgot-password" data-testid="login-forgot-link" className="text-[#48BB78] hover:underline">Forgot password?</Link>
              <Link to="/" className="text-[#A0AEC0] hover:text-white">Back to home</Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
