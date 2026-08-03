import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { Mail, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/forgot", { email });
      setSent(true);
      toast.success("If that email exists, a reset link was sent");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Something went wrong");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1A202C] p-6 dot-grid">
      <div className="w-full max-w-md bg-[#2D3748] p-8 rounded-lg border border-white/5">
        <Link to="/login" className="inline-flex items-center gap-2 text-[#A0AEC0] hover:text-white text-sm mb-6"><ArrowLeft size={14}/> Back to login</Link>
        <div className="w-12 h-12 rounded-md bg-[#48BB78]/10 border border-[#48BB78]/40 flex items-center justify-center text-[#48BB78] mb-5"><Mail size={22}/></div>
        <h1 className="font-display font-black text-3xl tracking-tight mb-3">Recover access</h1>
        <p className="text-[#A0AEC0] mb-6 text-sm">Enter your email &mdash; we&apos;ll dispatch recovery instructions to your primary inbox.</p>
        {sent ? (
          <div data-testid="forgot-sent-message" className="bg-[#1A202C] border border-[#48BB78]/40 rounded-md p-4 text-sm text-[#48BB78]">
            Recovery instructions dispatched. Please check your inbox.
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-[#A0AEC0]">Email address</Label>
              <Input data-testid="forgot-email-input" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1.5 bg-[#1A202C] border-white/10 text-white h-11"/>
            </div>
            <Button data-testid="forgot-submit-btn" type="submit" disabled={busy} className="w-full bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold h-11 rounded-md">
              {busy ? "Sending..." : "Send recovery link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
