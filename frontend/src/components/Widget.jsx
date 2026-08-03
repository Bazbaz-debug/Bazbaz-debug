import { useState, useRef, useEffect } from "react";
import { Bot, Send, PhoneCall, X, Loader2 } from "lucide-react";
import { API } from "@/lib/api";
import { toast } from "sonner";

const AVATAR_IMG = "https://images.pexels.com/photos/13108284/pexels-photo-13108284.jpeg?auto=compress&cs=tinysrgb&w=400";

export default function Widget({ tenant, colors, catalog }) {
  const bg = colors?.widget_bg || "#1A202C";
  const bubble = colors?.bubble_color || "#48BB78";
  const accent = colors?.accent_color || "#48BB78";

  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I'm your live AI concierge. Ask me about products, delivery, or book a slot." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [routing, setRouting] = useState(false);
  const scrollRef = useRef(null);
  const sessionId = useRef(`sess-${Date.now()}`).current;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async () => {
    if (!input.trim() || busy) return;
    const userMsg = { role: "user", text: input.trim() };
    setMessages(m => [...m, userMsg, { role: "assistant", text: "" }]);
    const q = input.trim();
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: q, user_id: tenant?.id }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const payload = JSON.parse(line.slice(6));
            if (payload.delta) {
              acc += payload.delta;
              setMessages(m => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", text: acc };
                return copy;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      toast.error("Chat failed");
    } finally {
      setBusy(false);
    }
  };

  const escalate = async () => {
    if (!tenant?.id) { toast.error("No tenant"); return; }
    setRouting(true);
    try {
      const res = await fetch(`${API}/chat/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: tenant.id, transcript: messages }),
      });
      const data = await res.json();
      toast.success(`${data.status} Phone fallback: ${data.phone}`);
      setMessages(m => [...m, { role: "assistant", text: `Routing to Live Line... Transcript emailed. Callback: ${data.phone}` }]);
    } catch { toast.error("Escalation failed"); }
    finally { setTimeout(() => setRouting(false), 1200); }
  };

  const book = async (slot = "Tomorrow 3:00 PM") => {
    if (!tenant?.id) return;
    try {
      await fetch(`${API}/booking/confirm`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ tenant_id: tenant.id, slot, customer_email: tenant.email }),
      });
      setMessages(m => [...m, { role: "assistant", text: `Booking confirmed for ${slot}. Confirmation email dispatched.` }]);
      toast.success("Booking confirmed & emailed");
    } catch { toast.error("Booking failed"); }
  };

  if (!open) {
    return (
      <button data-testid="widget-launcher-btn" onClick={() => setOpen(true)} className="absolute bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl" style={{ background: accent }}>
        <Bot size={24}/>
      </button>
    );
  }

  return (
    <div data-testid="sandbox-widget" className="absolute bottom-6 right-6 w-[360px] rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: bg, border: "1px solid rgba(255,255,255,0.08)", maxHeight: "82%" }}>
      {/* Avatar video header */}
      <div className="relative">
        <img src={AVATAR_IMG} alt="AI avatar" className="w-full h-40 object-cover"/>
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: accent }}></span>
          <span className="text-xs font-bold text-white">LIVE · AI Avatar</span>
        </div>
        <button data-testid="widget-close-btn" onClick={() => setOpen(false)} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"><X size={14}/></button>
      </div>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: 320 }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed" style={m.role === "user" ? { background: bubble, color: "#1A202C" } : { background: "#2D3748", color: "#fff" }}>
              {m.text || <Loader2 className="animate-spin" size={14}/>}
            </div>
          </div>
        ))}
        {/* Product cards for e-commerce */}
        {catalog && catalog.length > 0 && messages.length <= 2 && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            {catalog.slice(0, 3).map((p, i) => (
              <div key={i} data-testid={`widget-product-${i}`} className="bg-[#2D3748] rounded-lg overflow-hidden border border-white/5">
                <img src={p.image} className="h-16 w-full object-cover" alt={p.name}/>
                <div className="p-1.5">
                  <p className="text-white text-[10px] leading-tight font-bold truncate">{p.name}</p>
                  <p className="text-[10px]" style={{ color: accent }}>{p.price}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Actions */}
      <div className="px-4 py-2 flex gap-2 border-t border-white/5">
        <button data-testid="widget-escalate-btn" onClick={escalate} disabled={routing} className="flex-1 text-xs font-bold px-3 py-2 rounded-md border transition-colors" style={{ borderColor: accent, color: accent }}>
          {routing ? "Routing..." : <span className="inline-flex items-center gap-1.5"><PhoneCall size={12}/> Talk to Live Human</span>}
        </button>
        <button data-testid="widget-book-btn" onClick={() => book()} className="text-xs font-bold px-3 py-2 rounded-md" style={{ background: bubble, color: "#1A202C" }}>Book slot</button>
      </div>
      {/* Input */}
      <div className="p-3 border-t border-white/5 flex gap-2">
        <input data-testid="widget-chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask in any language..." className="flex-1 bg-[#2D3748] text-white text-sm rounded-md px-3 py-2 outline-none border border-white/5 focus:border-[#48BB78]/50"/>
        <button data-testid="widget-send-btn" onClick={send} disabled={busy} className="px-3 rounded-md font-bold flex items-center justify-center" style={{ background: accent, color: "#1A202C" }}>
          {busy ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>}
        </button>
      </div>
    </div>
  );
}
