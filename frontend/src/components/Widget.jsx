import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Loader2, Mic, MicOff, Volume2, Sparkles, PhoneCall, PhoneOff, ShoppingCart } from "lucide-react";
import { API } from "@/lib/api";
import { toast } from "sonner";

function avatarUrl(gender) {
  const backend = process.env.REACT_APP_BACKEND_URL;
  return `${backend}/api/public/avatar/${gender}.jpg`;
}

// Parse action + language + buy markers from streaming text
function extractActions(text) {
  const actions = [];
  const re = /\[\[ACTION:([a-zA-Z_]+)(?::([^\]]+))?\]\]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    actions.push({ kind: m[1].toLowerCase(), arg: (m[2] || "").trim() });
  }
  const langMatch = text.match(/\[\[LANG:([a-z]{2})\]\]/i);
  const lang = langMatch ? langMatch[1].toLowerCase() : null;
  const buys = [];
  const buyRe = /\[\[BUY:([^\|\]]+)\|([^\]]+)\]\]/g;
  let bm;
  while ((bm = buyRe.exec(text)) !== null) {
    buys.push({ name: bm[1].trim(), url: bm[2].trim() });
  }
  let clean = text
    .replace(re, "")
    .replace(/\[\[LANG:[a-z]{2}\]\]/gi, "")
    .replace(buyRe, "")
    .trim();
  return { clean, actions, lang, buys };
}

export default function Widget({ tenant, colors, catalog }) {
  const bg = colors?.widget_bg || "#1A202C";
  const bubble = colors?.bubble_color || "#48BB78";
  const accent = colors?.accent_color || "#48BB78";
  const gender = tenant?.avatar_gender || "female";

  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hey — how can I help?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const [lipsyncMode, setLipsyncMode] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  const [generatingVideo, setGeneratingVideo] = useState(false);
  const [replyLang, setReplyLang] = useState("en");
  const [callActive, setCallActive] = useState(false);
  const [callListening, setCallListening] = useState(false);
  const scrollRef = useRef(null);
  const audioRef = useRef(null);
  const videoElRef = useRef(null);
  const mediaRecRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const sessionId = useRef(`sess-${Date.now()}`).current;
  const callActiveRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const playTTS = useCallback(async (text, langHint) => {
    if (!voiceMode || !text) return;
    const lang = (langHint || replyLang || "en").toLowerCase();
    // In voice-call mode use browser's built-in speechSynthesis for near-zero latency + native language voice
    if (callActiveRef.current && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text.slice(0, 1200));
        u.rate = 1.02; u.pitch = 1.0; u.volume = 1.0;
        // Voice selection: prefer voice matching lang + gender
        const voices = window.speechSynthesis.getVoices();
        const g = (tenant?.avatar_gender || "female").toLowerCase();
        // Match language first (lang code prefix like 'es', 'es-ES', 'es-MX')
        const langVoices = voices.filter(v => (v.lang || "").toLowerCase().startsWith(lang));
        const pool = langVoices.length ? langVoices : voices;
        let pick = pool.find(v =>
          (g === "male" && /male|david|daniel|guy|jorge|carlos|hans|hiroshi|takumi|wang/i.test(v.name)) ||
          (g === "female" && /female|samantha|zira|jenny|aria|maria|helena|marlene|kyoko|xiaoxiao|paulina/i.test(v.name))
        );
        if (!pick) pick = pool[0];
        if (pick) u.voice = pick;
        u.lang = pick?.lang || lang;
        setSpeaking(true);
        return new Promise((resolve) => {
          u.onend = () => { setSpeaking(false); resolve(); };
          u.onerror = () => { setSpeaking(false); resolve(); };
          window.speechSynthesis.speak(u);
        });
      } catch {}
    }
    // Otherwise use OpenAI TTS (multi-language native, higher quality)
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
        return new Promise((resolve) => {
          audio.onended = () => { setSpeaking(false); resolve(); };
          audio.onerror = () => { setSpeaking(false); resolve(); };
          audio.play().catch(() => { setSpeaking(false); resolve(); });
        });
      }
    } catch { setSpeaking(false); }
  }, [voiceMode, tenant, replyLang]);

  const escalate = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const res = await fetch(`${API}/chat/escalate`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ tenant_id: tenant.id, transcript: messages }),
      });
      const data = await res.json();
      const stat = data.call_status === "live_call_placed" ? `LIVE CALL PLACED (${data.phone})` : `Routing (mocked) - transcript emailed to ${data.phone}`;
      toast.success(stat);
      setMessages(m => [...m, { role: "assistant", text: `Connecting you now. ${stat}` }]);
    } catch { toast.error("Escalation failed"); }
  }, [tenant, messages]);

  const bookSlot = useCallback(async (slotText) => {
    if (!tenant?.id) return;
    try {
      const r = await fetch(`${API}/booking/confirm`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ tenant_id: tenant.id, slot: slotText, customer_email: tenant.email }),
      });
      const data = await r.json();
      const link = data.google_calendar_url;
      setMessages(m => [...m, { role: "assistant", text: `Booked "${slotText}". Confirmation email sent.`, gcal: link }]);
      toast.success("Booking confirmed - opening Google Calendar");
      if (link) window.open(link, "_blank", "noopener,noreferrer");
    } catch { toast.error("Booking failed"); }
  }, [tenant]);

  const sendText = useCallback(async (text) => {
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
              const { clean, lang } = extractActions(acc);
              if (lang && lang !== replyLang) setReplyLang(lang);
              setMessages(m => { const c=[...m]; c[c.length-1]={role:"assistant",text:clean}; return c; });            }
          } catch {}
        }
      }
      // Final: check for action markers + language + buy
      const { clean, actions, lang, buys } = extractActions(acc);
      if (lang) setReplyLang(lang);
      setMessages(m => { const c=[...m]; c[c.length-1]={role:"assistant",text:clean, buys}; return c; });
      // Play TTS with clean text (pass lang so browser picks matching voice)
      if (clean && voiceMode) {
        if (lipsyncMode && tenant?.id) {
          setGeneratingVideo(true);
          try {
            const rr = await fetch(`${API}/avatar/lipsync`, {
              method: "POST", headers: {"Content-Type":"application/json"},
              body: JSON.stringify({ tenant_id: tenant.id, text: clean.slice(0, 800) }),
            });
            const dd = await rr.json();
            if (dd.video_url) {
              setVideoUrl(dd.video_url);
              setSpeaking(true);
            } else if (dd.audio_b64) {
              const audio = new Audio(`data:audio/mpeg;base64,${dd.audio_b64}`);
              audioRef.current = audio; setSpeaking(true);
              audio.onended = () => setSpeaking(false);
              audio.play();
              if (dd.error) toast.error(`Lipsync fallback: ${dd.error.slice(0,60)}`);
            }
          } catch { await playTTS(clean, lang); }
          finally { setGeneratingVideo(false); }
        } else {
          await playTTS(clean, lang);
        }
      }
      // Execute actions AFTER speaking
      for (const a of actions) {
        if (a.kind === "escalate") await escalate();
        if (a.kind === "book") await bookSlot(a.arg || "Slot requested by visitor");
      }
    } catch (e) { toast.error("Chat failed"); }
    finally { setBusy(false); }
  }, [busy, sessionId, tenant, voiceMode, lipsyncMode, playTTS, escalate, bookSlot]);

  // ============ Hold-to-talk mic (single utterance via Whisper) ============
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
          if (data.text) await sendText(data.text);
          else toast.error("Could not transcribe");
        } catch { toast.error("Voice transcribe failed"); }
        finally { setBusy(false); }
      };
      rec.start();
      mediaRecRef.current = rec;
      setRecording(true);
    } catch (e) { toast.error("Mic permission needed"); }
  };
  const stopRecording = () => {
    if (mediaRecRef.current && recording) { mediaRecRef.current.stop(); setRecording(false); }
  };

  // ============ Voice Call mode: continuous SpeechRecognition loop ============
  const startCall = async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast.error("Voice call needs Chrome or Edge browser"); return; }
    callActiveRef.current = true;
    setCallActive(true);
    setVoiceMode(true);
    setMessages(m => [...m, { role: "assistant", text: "Voice call started. Just talk — I'll listen." }]);
    // Greet fast via browser speech
    await playTTS("Hey — you're on. What can I do for you?");
    listenLoop();
  };
  const listenLoop = () => {
    if (!callActiveRef.current) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recog = new SR();
    recog.continuous = false;
    recog.interimResults = false;
    recog.lang = ""; // auto detect
    recog.onstart = () => setCallListening(true);
    recog.onresult = async (e) => {
      const t = e.results?.[0]?.[0]?.transcript?.trim();
      setCallListening(false);
      if (t) {
        await sendText(t);
      }
      // After bot finishes speaking, TTS.onended triggers setSpeaking(false); we then loop again
      const waitStart = Date.now();
      const wait = () => new Promise(r => {
        const iv = setInterval(() => {
          if (!callActiveRef.current) { clearInterval(iv); r(); return; }
          if (!audioRef.current || audioRef.current.paused || audioRef.current.ended) { clearInterval(iv); r(); }
          if (Date.now() - waitStart > 30000) { clearInterval(iv); r(); }
        }, 300);
      });
      await wait();
      if (callActiveRef.current) listenLoop();
    };
    recog.onerror = () => { setCallListening(false); if (callActiveRef.current) setTimeout(listenLoop, 800); };
    recog.onend = () => setCallListening(false);
    recognitionRef.current = recog;
    try { recog.start(); } catch {}
  };
  const endCall = () => {
    callActiveRef.current = false;
    setCallActive(false); setCallListening(false);
    try { recognitionRef.current?.stop(); } catch {}
    if (audioRef.current) { try { audioRef.current.pause(); } catch {} }
    setMessages(m => [...m, { role: "assistant", text: "Voice call ended." }]);
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
      {/* VOICE-ONLY FULLSCREEN OVERLAY */}
      {callActive && (
        <div data-testid="voice-only-overlay" className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6" style={{ background: `radial-gradient(circle at center, ${accent}25 0%, ${bg} 70%)` }}>
          <div className={`w-40 h-40 rounded-full overflow-hidden mb-6 voice-halo ${callListening || speaking ? "face-speaking" : "face-alive"}`} style={{ border: `3px solid ${accent}` }}>
            <img src={avatarUrl(gender)} alt="AI" className="w-full h-full object-cover"/>
          </div>
          <p className="uppercase tracking-[0.3em] text-xs font-bold mb-2" style={{ color: accent }}>
            {callListening ? "LISTENING" : speaking ? "SPEAKING" : "IN CALL"}
          </p>
          <p className="text-white/70 text-sm mb-8 text-center">Just talk — I'm listening in any language.</p>
          <button data-testid="widget-endcall-fullscreen" onClick={endCall} className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl" style={{ background: "#F56565", color: "#fff" }}>
            <PhoneOff size={24}/>
          </button>
        </div>
      )}
      {/* Avatar */}
      <div className="relative">
        {videoUrl ? (
          <video ref={videoElRef} src={videoUrl} autoPlay playsInline controls={false}
            onEnded={() => setSpeaking(false)} onError={() => { setVideoUrl(null); setSpeaking(false); }}
            className="w-full h-40 object-cover" data-testid="widget-avatar-video"/>
        ) : (
          <img src={avatarUrl(gender)} alt="AI avatar" className="w-full h-40 object-cover bg-[#2D3748] transition-transform duration-300"
            style={{ transform: speaking || callListening ? "scale(1.03)" : "scale(1)" }} data-testid="widget-avatar-image"/>
        )}
        {(speaking || callListening) && !videoUrl && (
          <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 60px 8px ${accent}55` }}></div>
        )}
        {generatingVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white text-xs font-bold"><Loader2 className="animate-spin" size={14}/> Generating lip-synced video...</div>
          </div>
        )}
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: accent }}></span>
          <span className="text-xs font-bold text-white">
            {callActive ? (callListening ? "LISTENING" : "IN CALL") : (speaking ? "SPEAKING" : "LIVE · AI Avatar")}
          </span>
          {speaking && <Volume2 size={11} className="text-white"/>}
        </div>
        <button data-testid="widget-close-btn" onClick={() => setOpen(false)} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80"><X size={14}/></button>
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          <button data-testid="widget-lipsync-toggle" onClick={() => setLipsyncMode(v => !v)} title="Lip-synced video mode" className="text-[10px] font-bold px-2 py-1 rounded-full inline-flex items-center gap-1" style={{ background: lipsyncMode ? accent : "rgba(0,0,0,0.6)", color: lipsyncMode ? "#1A202C" : "#fff" }}>
            <Sparkles size={10}/> {lipsyncMode ? "VIDEO" : "STILL"}
          </button>
          <button data-testid="widget-voice-toggle" onClick={() => setVoiceMode(v => !v)} title="Toggle voice mode" className="text-[10px] font-bold px-2 py-1 rounded-full" style={{ background: voiceMode ? accent : "rgba(0,0,0,0.6)", color: voiceMode ? "#1A202C" : "#fff" }}>
            {voiceMode ? "VOICE ON" : "VOICE OFF"}
          </button>
        </div>
      </div>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: 300 }}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed" style={m.role === "user" ? { background: bubble, color: "#1A202C" } : { background: "#2D3748", color: "#fff" }}>
              {m.text || <Loader2 className="animate-spin" size={14}/>}
              {m.gcal && (
                <a href={m.gcal} target="_blank" rel="noopener noreferrer" data-testid="widget-gcal-link" className="mt-1.5 block text-xs font-bold underline" style={{ color: accent }}>Add to Google Calendar &rarr;</a>
              )}
              {m.buys && m.buys.length > 0 && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {m.buys.map((b, bi) => (
                    <a key={bi} href={b.url} target="_blank" rel="noopener noreferrer" data-testid={`widget-buy-btn-${bi}`} className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-md" style={{ background: accent, color: "#1A202C" }}>
                      <ShoppingCart size={12}/> Buy {b.name}
                    </a>
                  ))}
                </div>
              )}
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
      {/* Input row */}
      <div className="p-3 border-t border-white/5 flex gap-2 items-center">
        {/* Voice Call toggle */}
        {callActive ? (
          <button data-testid="widget-endcall-btn" onClick={endCall} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "#F56565", color: "#fff" }} title="End voice call">
            <PhoneOff size={16}/>
          </button>
        ) : (
          <button data-testid="widget-startcall-btn" onClick={startCall} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: accent, color: "#1A202C" }} title="Start hands-free voice call">
            <PhoneCall size={16}/>
          </button>
        )}
        {/* Hold-to-talk mic */}
        <button data-testid="widget-mic-btn" onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform" style={{ background: recording ? "#F56565" : "#2D3748", color: recording ? "#fff" : accent, transform: recording ? "scale(1.1)" : "scale(1)" }} title="Hold to talk (one message)">
          {recording ? <MicOff size={16}/> : <Mic size={16}/>}
        </button>
        <input data-testid="widget-chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendText(input)} placeholder={callActive ? "Voice call active..." : recording ? "Listening..." : "Type or ask 'talk to a human'"} disabled={callActive} className="flex-1 bg-[#2D3748] text-white text-sm rounded-md px-3 py-2 outline-none border border-white/5 focus:border-[#48BB78]/50 disabled:opacity-50"/>
        <button data-testid="widget-send-btn" onClick={() => sendText(input)} disabled={busy || callActive} className="px-3 py-2 rounded-md font-bold flex items-center justify-center disabled:opacity-50" style={{ background: accent, color: "#1A202C" }}>
          {busy ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>}
        </button>
      </div>
    </div>
  );
}
