import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { Bot, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Register() {
  const nav = useNavigate();
  const [enabled, setEnabled] = useState(true);
  const [form, setForm] = useState({ full_name: "", email: "", target_domain: "" });
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(null);

  useEffect(() => {
    api.get("/settings/public").then(r => setEnabled(r.data.public_signup_enabled));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/register", form);
      setVerified(data);
      toast.success("Verification email sent");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Registration failed");
    } finally { setBusy(false); }
  };

  if (!enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A202C] p-6">
        <div className="max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-[#48BB78]/10 border border-[#48BB78]/40 flex items-center justify-center mx-auto mb-6 text-[#48BB78]"><Bot size={28}/></div>
          <h1 className="font-display font-black text-3xl mb-3">Invite-only</h1>
          <p className="text-[#A0AEC0] mb-6">Public signup is currently closed. Contact your account manager for a manual invite.</p>
          <Link to="/login"><Button data-testid="register-back-login-btn" className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">Login instead</Button></Link>
        </div>
      </div>
    );
  }

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1A202C] p-6">
        <div className="max-w-md w-full bg-[#2D3748] p-8 rounded-lg border border-[#48BB78]/40 neon-glow">
          <div className="w-14 h-14 rounded-full bg-[#48BB78]/10 border border-[#48BB78]/40 flex items-center justify-center mb-6 text-[#48BB78]"><Mail size={26}/></div>
          <h2 className="font-display font-black text-2xl mb-3">Verification email dispatched</h2>
          <p className="text-[#A0AEC0] mb-5">Check <span className="text-white">{form.email}</span> for your login credentials. For demo purposes your temporary password:</p>
          <code className="block bg-[#1A202C] border border-white/10 text-[#48BB78] px-3 py-2 rounded font-mono text-sm mb-6" data-testid="register-temp-password">{verified.email_preview_password}</code>
          <Button data-testid="register-go-login-btn" onClick={() => nav("/login")} className="w-full bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">Continue to login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A202C] p-6 dot-grid">
      <form onSubmit={submit} className="w-full max-w-md bg-[#2D3748] p-8 rounded-lg border border-white/5">
        <Link to="/" className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-md bg-[#48BB78] flex items-center justify-center text-[#1A202C]"><Bot size={18} strokeWidth={2.5}/></div>
          <span className="font-display font-black">Rozio-Killer</span>
        </Link>
        <h1 className="font-display font-black text-3xl mb-6 tracking-tight">Claim your invite</h1>
        <div className="space-y-4">
          <div>
            <Label className="text-[#A0AEC0]">Full name</Label>
            <Input data-testid="register-name-input" required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} className="mt-1.5 bg-[#1A202C] border-white/10 text-white h-11"/>
          </div>
          <div>
            <Label className="text-[#A0AEC0]">Email</Label>
            <Input data-testid="register-email-input" type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="mt-1.5 bg-[#1A202C] border-white/10 text-white h-11"/>
          </div>
          <div>
            <Label className="text-[#A0AEC0]">Target domain URL</Label>
            <Input data-testid="register-domain-input" required placeholder="https://yourshop.com" value={form.target_domain} onChange={e => setForm({...form, target_domain: e.target.value})} className="mt-1.5 bg-[#1A202C] border-white/10 text-white h-11"/>
          </div>
          <Button data-testid="register-submit-btn" type="submit" disabled={busy} className="w-full bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold h-11 rounded-md">
            {busy ? "Sending verification..." : "Send verification email"}
          </Button>
          <p className="text-sm text-center text-[#A0AEC0]">Have an account? <Link to="/login" className="text-[#48BB78] hover:underline">Log in</Link></p>
        </div>
      </form>
    </div>
  );
}
