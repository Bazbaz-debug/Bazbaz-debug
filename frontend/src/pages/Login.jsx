import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bot, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success("Welcome back");
      nav(u.role === "admin" ? "/admin" : "/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Login failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-[#0D1117] relative dot-grid noise">
        <Link to="/" className="flex items-center gap-2 relative z-10">
          <div className="w-9 h-9 rounded-md bg-[#48BB78] flex items-center justify-center text-[#1A202C]"><Bot size={20} strokeWidth={2.5}/></div>
          <span className="font-display font-black text-xl">Rozio-Killer</span>
        </Link>
        <div className="relative z-10 max-w-md">
          <p className="uppercase text-xs tracking-[0.3em] text-[#48BB78] font-bold mb-3">Neon-Green Console</p>
          <h1 className="font-display font-black text-5xl leading-none tracking-tighter mb-4">Log in.<br/>Ship widgets.</h1>
          <p className="text-[#A0AEC0]">The interactive sandbox is waiting on the other side.</p>
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
              <Input data-testid="login-email-input" id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 bg-[#2D3748] border-white/10 text-white h-11" placeholder="you@company.com"/>
            </div>
            <div>
              <Label htmlFor="password" className="text-[#A0AEC0]">Password</Label>
              <Input data-testid="login-password-input" id="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1.5 bg-[#2D3748] border-white/10 text-white h-11" placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"/>
            </div>
            <Button data-testid="login-submit-btn" type="submit" disabled={busy} className="w-full bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold h-11 rounded-md">
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
