import { useState, useRef, useEffect } from "react";
import { Bot, Send, PhoneCall, X, Loader2, Mic, MicOff, Volume2 } from "lucide-react";
import { API } from "@/lib/api";
import { toast } from "sonner";

const AVATAR_IMG = "https://images.pexels.com/photos/13108284/pexels-photo-13108284.jpeg?auto=compress&cs=tinysrgb&w=400";

export default function Widget({ tenant, colors, catalog }) {
  const bg = colors?.widget_bg || "#1A202C";
  const bubble = colors?.bubble_color || "#48BB78";
  const accent = colors?.accent_color || "#48BB78";

  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hi! I'm your live AI concierge. Tap the mic and speak in any language, or type below." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [routing, setRouting] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const scrollRef = useRef(null);
  const audioRef = useRef(null);
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const sessionId = useRef(`sess-${Date.now()}`).current;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const playTTS = async (text) => {
    if (!voiceMode || !text) return;
    try {
      const r = await fetch(`${API}/voice/tts`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ text: text.slice(0, 1200), voice: "nova", tenant_id: tenant?.id }),
      });
      const data = await r.json();
      if (data.audio_base64) {
        const audio = new Audio(`data:${data.mime};base64,${data.audio_base64}`);
        audioRef.current = audio;
        setSpeaking(true);
        audio.onended = () => setSpeaking(false);
        audio.onerror = () => setSpeaking(false);
        await audio.play();
      }
    } catch { setSpeaking(false); }
  };

  const sendText = async (text) => {
    if (!text.trim() || busy) return;
    setMessages(m => [...m, { role: "user", text }, { role: "assistant", text: "" }]);
    setInput("");
    setBusy(true);
    let acc = "";
    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ session_id: sessionId, message: text, user_id: tenant?.id }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const p = JSON.parse(line.slice(6));
            if (p.delta) {
              acc += p.delta;
              setMessages(m => { const c=[...m]; c[c.length-1]={role:"assistant",text:acc}; return c; });
            }
          } catch {}
        }
      }
      if (acc && voiceMode) await playTTS(acc);
    } catch (e) { toast.error("Chat failed"); }
    finally { setBusy(false); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      rec.ondataavailable = e => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setBusy(true);
        try {
          const fd = new FormData();
          fd.append("file", blob, "voice.webm");
          const r = await fetch(`${API}/voice/stt`, { method: "POST", body: fd });
          const data = await r.json();
          if (data.text) {
            await sendText(data.text);
          } else toast.error("Could not transcribe");
        } catch { toast.error("Voice transcribe failed"); }
        finally { setBusy(false); }
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true);
    } catch (e) { toast.error("Mic permission needed"); }
  };

  const stopRecording = () => {
    if (mediaRecRef.current && recording) {
      mediaRecRef.current.stop();
      setRecording(false);
    }
  };

  const escalate = async () => {
    if (!tenant?.id) return;
    setRouting(true);
    try {
      const res = await fetch(`${API}/chat/escalate`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ tenant_id: tenant.id, transcript: messages }),
      });
      const data = await res.json();
      const stat = data.call_status === "live_call_placed" ? `LIVE CALL PLACED (${data.phone})` : `Routing (mocked) - transcript emailed`;
      toast.success(stat);
      setMessages(m => [...m, { role: "assistant", text: `${data.status} ${stat}` }]);
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
      {/* Audio-reactive avatar */}
      <div className="relative">
        <img src={AVATAR_IMG} alt="AI avatar" className="w-full h-40 object-cover transition-transform duration-300" style={{ transform: speaking ? "scale(1.03)" : "scale(1)" }}/>
        {/* Reactive ring overlay when speaking */}
        {speaking && (
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 60px 8px ${accent}55` }}></div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: accent }}></span>
          <span className="text-xs font-bold text-white">{speaking ? "SPEAKING" : "LIVE · AI Avatar"}</span>
          {speaking && <Volume2 size={11} className="text-white"/>}
        </div>
        <button data-testid="widget-close-btn" onClick={() => setOpen(false)} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"><X size={14}/></button>
        <button data-testid="widget-voice-toggle" onClick={() => setVoiceMode(v => !v)} title="Toggle voice mode" className="absolute bottom-3 right-3 text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: voiceMode ? accent : "rgba(0,0,0,0.6)", color: voiceMode ? "#1A202C" : "#fff" }}>
          {voiceMode ? "VOICE ON" : "VOICE OFF"}
        </button>
      </div>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: 280 }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed" style={m.role === "user" ? { background: bubble, color: "#1A202C" } : { background: "#2D3748", color: "#fff" }}>
              {m.text || <Loader2 className="animate-spin" size={14}/>}
            </div>
          </div>
        ))}
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
      <div className="p-3 border-t border-white/5 flex gap-2 items-center">
        <button data-testid="widget-mic-btn" onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform" style={{ background: recording ? "#F56565" : accent, color: "#1A202C", transform: recording ? "scale(1.1)" : "scale(1)" }} title="Hold to talk">
          {recording ? <MicOff size={16}/> : <Mic size={16}/>}
        </button>
        <input data-testid="widget-chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendText(input)} placeholder={recording ? "Listening..." : "Speak or type (any language)"} className="flex-1 bg-[#2D3748] text-white text-sm rounded-md px-3 py-2 outline-none border border-white/5 focus:border-[#48BB78]/50"/>
        <button data-testid="widget-send-btn" onClick={() => sendText(input)} disabled={busy} className="px-3 py-2 rounded-md font-bold flex items-center justify-center" style={{ background: accent, color: "#1A202C" }}>
          {busy ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>}
        </button>
      </div>
    </div>
  );
}
