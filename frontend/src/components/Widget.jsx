import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Send, X, Loader2, Mic, MicOff, Volume2, Sparkles, PhoneCall, PhoneOff, ShoppingCart, Camera, Package, Headset, CheckCircle2, Circle } from "lucide-react";
import { API } from "@/lib/api";
import { toast } from "sonner";

function avatarUrl(gender) {
  const backend = process.env.REACT_APP_BACKEND_URL;
  return `${backend}/api/public/avatar/${gender}.jpg`;
}

function resolveLogoUrl(logo_url) {
  if (!logo_url) return "";
  if (logo_url.startsWith("http")) return logo_url;
  return `${process.env.REACT_APP_BACKEND_URL}${logo_url}`;
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

export default function Widget({ tenant, colors, catalog, embedded = false, onClose }) {
  const bg = colors?.widget_bg || "#1A202C";
  const bubble = colors?.bubble_color || "#48BB78";
  const accent = colors?.accent_color || "#48BB78";
  const gender = tenant?.avatar_gender || "female";

  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState([
    { role: "assistant", text: tenant?.bot_greeting || "Hey — how can I help?" },
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
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  const stopMouthAnalyser = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    analyserRef.current = null;
    document.querySelectorAll("[data-mouth]").forEach(el => {
      el.style.transform = "";
      el.style.opacity = "";
    });
    document.querySelectorAll("[data-face]").forEach(el => {
      const base = el.dataset.baseScale || "1.7";
      el.style.transform = `scale(${base})`;
      el.style.filter = "";
    });
  }, []);

  const startMouthAnalyser = useCallback((audioEl) => {
    try {
      if (!audioCtxRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        audioCtxRef.current = new AC();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const src = ctx.createMediaElementSource(audioEl);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.55;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        if (!analyserRef.current) return;
        analyser.getByteFrequencyData(data);
        // Focus on voice band (roughly 200 Hz - 3.5 kHz)
        let sum = 0, count = 0;
        for (let i = 2; i < 40; i++) { sum += data[i]; count++; }
        const avg = (sum / count) / 255;
        const level = Math.min(1, avg * 2.4);
        // Mouth-shaped overlay: opens vertically with amplitude
        document.querySelectorAll("[data-mouth]").forEach(el => {
          el.style.transform = `translateX(-50%) scaleY(${0.25 + level * 2.2}) scaleX(${1 + level * 0.22})`;
          el.style.opacity = String(0.55 + level * 0.4);
        });
        // Face itself: subtle audio-reactive scale + brightness so the whole head appears to react to speech
        document.querySelectorAll("[data-face]").forEach(el => {
          const base = el.dataset.baseScale || "1.7";
          const s = parseFloat(base) + level * 0.03;
          el.style.transform = `scale(${s}) translateY(${-level * 3}px)`;
          el.style.filter = `brightness(${1 + level * 0.08})`;
        });
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch (e) { /* MediaElementSource may already exist for this element */ }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const playTTS = useCallback(async (text, langHint) => {
    if (!voiceMode || !text) return;
    // CRITICAL: kill any previously-playing audio to prevent double voices
    try { if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; audioRef.current = null; } } catch {}
    try { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); } catch {}
    // SINGLE VOICE, ALWAYS: OpenAI TTS with the tenant's matched persona voice.
    // Never falls back to browser speechSynthesis (which picks a different voice per language and sounds robotic).
    const g = (tenant?.avatar_gender || "female").toLowerCase();
    const voiceName = g === "male" ? "onyx" : g === "neutral" ? "sage" : "nova";
    try {
      const r = await fetch(`${API}/voice/tts`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ text: text.slice(0, 1200), voice: voiceName, tenant_id: tenant?.id }),
      });
      const data = await r.json();
      if (data.audio_base64) {
        const audio = new Audio(`data:${data.mime};base64,${data.audio_base64}`);
        audioRef.current = audio;
        setSpeaking(true);
        return new Promise((resolve) => {
          audio.onended = () => { setSpeaking(false); audioRef.current = null; stopMouthAnalyser(); resolve(); };
          audio.onerror = () => { setSpeaking(false); audioRef.current = null; stopMouthAnalyser(); resolve(); };
          audio.onplay = () => { startMouthAnalyser(audio); };
          audio.play().catch(() => { setSpeaking(false); audioRef.current = null; stopMouthAnalyser(); resolve(); });
        });
      }
    } catch { setSpeaking(false); }
  }, [voiceMode, tenant, startMouthAnalyser, stopMouthAnalyser]);

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

  // ============ Poll for human_agent replies (business-owner takeover) ============
  const lastHumanCheckRef = useRef(new Date().toISOString());
  useEffect(() => {
    if (!tenant?.id) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`${API}/chat/session/${sessionId}/pending?tenant_id=${tenant.id}&since=${encodeURIComponent(lastHumanCheckRef.current)}`);
        const d = await r.json();
        if (cancelled) return;
        if (d.server_time) lastHumanCheckRef.current = d.server_time;
        const news = d.messages || [];
        if (news.length) {
          setMessages(m => [
            ...m,
            ...news.map(n => ({ role: "human_agent", text: n.text, at: n.created_at })),
          ]);
          news.forEach(n => playTTS(n.text));
        }
      } catch {}
    };
    const iv = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [tenant, sessionId, playTTS]);

  // ============ Photo → product search (GPT-4o vision) ============
  const [visionBusy, setVisionBusy] = useState(false);
  const photoInputRef = useRef(null);
  const sendPhoto = async (file) => {
    if (!file || !tenant?.id) return;
    if (!file.type.startsWith("image/")) { toast.error("Please pick an image file"); return; }
    setMessages(m => [...m, { role: "user", text: `📷 Photo: ${file.name}` }, { role: "assistant", text: "", searchingPhoto: true }]);
    setVisionBusy(true); setBusy(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const r = await fetch(`${API}/vision/product-search?tenant_id=${tenant.id}`, { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || "Photo search failed");
      const reply = data.matches?.length
        ? `I think you're looking at ${data.description || "this"}. Here are the closest matches:`
        : `${data.description || "I can see the photo,"} but I couldn't find a clean match in the catalog. Want to describe it in a message?`;
      setMessages(m => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: reply, matches: data.matches || [] }; return c; });
      if (voiceMode && reply) await playTTS(reply);
    } catch (e) {
      setMessages(m => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: e.message || "Photo search failed. Try again in a moment." }; return c; });
    } finally { setVisionBusy(false); setBusy(false); }
  };

  // ============ Shopify order tracking ============
  const [trackingFor, setTrackingFor] = useState(false); // shows form when true
  const [trackNum, setTrackNum] = useState("");
  const [trackEmail, setTrackEmail] = useState("");
  const [trackBusy, setTrackBusy] = useState(false);
  const startTracking = () => {
    setTrackingFor(true);
    setMessages(m => [...m, { role: "assistant", text: "Sure — what's your order number? (You can include the email you used at checkout for a faster match.)" }]);
  };
  const submitTracking = async () => {
    if (!trackNum.trim() || !tenant?.id) return;
    setTrackBusy(true);
    setMessages(m => [...m, { role: "user", text: `Track order ${trackNum}${trackEmail ? " · " + trackEmail : ""}` }, { role: "assistant", text: "", searchingPhoto: true }]);
    try {
      const r = await fetch(`${API}/order/track`, {
        method: "POST", headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ tenant_id: tenant.id, order_number: trackNum.trim(), email: trackEmail.trim() || undefined }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.detail || "Order lookup failed");
      const stages = data.stages || [];
      const now_at = stages.filter(s => s.done).slice(-1)[0]?.label || "Ordered";
      setMessages(m => {
        const c = [...m];
        c[c.length - 1] = {
          role: "assistant",
          text: `Order ${data.order_number} — currently ${now_at.toLowerCase()}.`,
          tracking: {
            stages,
            tracking_number: data.tracking_number,
            tracking_url: data.tracking_url,
            order_number: data.order_number,
          },
        };
        return c;
      });
      setTrackingFor(false); setTrackNum(""); setTrackEmail("");
    } catch (e) {
      setMessages(m => { const c = [...m]; c[c.length - 1] = { role: "assistant", text: e.message || "Couldn't find that order — please double-check the number." }; return c; });
    } finally { setTrackBusy(false); }
  };

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
    // First: ensure microphone permission is actually granted (helps in
    // sandbox/preview iframes where permissions must be prompted).
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch (e) {
      toast.error("Please allow microphone access to start the voice call");
      return;
    }
    callActiveRef.current = true;
    setCallActive(true);
    setVoiceMode(true);
    setMessages(m => [...m, { role: "assistant", text: "Voice call started. Just talk — I'll listen." }]);
    await playTTS("Hey — you're on. What can I do for you?");
    if (SR) {
      listenLoop();
    } else {
      // Fallback: Whisper hold-to-talk still works. Show hint instead of blocking.
      toast("Hold the mic button to talk (voice recognition unavailable in this browser)", { icon: "🎙️" });
    }
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

  const closeWidget = () => {
    if (embedded && onClose) { onClose(); return; }
    setOpen(false);
  };

  // Positioning: absolute inside a relative parent for the sandbox preview,
  // full-frame inset when rendered inside the customer's iframe embed.
  const containerClass = embedded
    ? "fixed inset-0 sm:inset-auto sm:bottom-4 sm:right-4 sm:left-4 sm:top-4 w-auto sm:w-[calc(100vw-2rem)] sm:max-w-[400px] sm:h-[calc(100vh-2rem)] sm:max-h-[720px] rounded-none sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col mx-auto"
    : "absolute bottom-6 right-6 w-[360px] rounded-2xl overflow-hidden shadow-2xl flex flex-col";
  const containerStyle = embedded
    ? { background: bg, border: "1px solid rgba(255,255,255,0.08)" }
    : { background: bg, border: "1px solid rgba(255,255,255,0.08)", maxHeight: "82%" };

  return (
    <div data-testid="sandbox-widget" className={containerClass} style={containerStyle}>
      {/* VOICE-ONLY OVERLAY — sits INSIDE the widget box (absolute, not fixed) */}
      {callActive && (
        <div data-testid="voice-only-overlay" className="absolute inset-0 z-[80] flex flex-col items-center justify-center p-6" style={{ background: "rgba(6, 10, 14, 0.92)", backdropFilter: "blur(24px) saturate(140%)", WebkitBackdropFilter: "blur(24px) saturate(140%)" }}>
          {/* soft accent halo behind face */}
          <div className="absolute pointer-events-none" style={{ width: "28rem", height: "28rem", borderRadius: "9999px", background: `radial-gradient(circle, ${accent}22 0%, transparent 65%)`, filter: "blur(40px)" }}></div>
          <div className={`relative w-44 h-44 rounded-full overflow-hidden mb-6 voice-halo ${callListening || speaking ? "face-speaking" : "face-alive"}`} style={{ border: `3px solid ${accent}`, boxShadow: `0 0 60px ${accent}55, 0 0 120px ${accent}22` }}>
            <img src={avatarUrl(gender)} alt="AI" className="w-full h-full object-cover" data-face data-base-scale="1.15" style={{ objectPosition: "center 22%", transform: "scale(1.15)", transition: "transform 60ms linear, filter 60ms linear" }}/>
          </div>
          <p className="uppercase tracking-[0.4em] text-xs font-bold mb-2 relative" style={{ color: accent }}>
            {callListening ? "LISTENING" : speaking ? "SPEAKING" : "IN CALL"}
          </p>
          <p className="text-white/60 text-xs mb-6 text-center max-w-xs relative">Just talk &mdash; I&rsquo;m listening in any language.</p>
          <button data-testid="widget-endcall-fullscreen" onClick={endCall} className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform relative" style={{ background: "#F56565", color: "#fff" }}>
            <PhoneOff size={22}/>
          </button>
        </div>
      )}
      {/* Chat mode: premium header with hero gradient */}
      <div className="relative px-5 pt-4 pb-5 border-b border-white/5 overflow-hidden" style={{ background: `linear-gradient(160deg, ${accent}26 0%, ${accent}0a 40%, transparent 100%)` }}>
        {/* Ambient glow behind header */}
        <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: `radial-gradient(circle, ${accent}44 0%, transparent 60%)`, filter: "blur(24px)" }}></div>
        <div className="relative flex items-center gap-3">
          {tenant?.logo_url ? (
            <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden bg-white/8 border border-white/15" data-testid="widget-logo" style={{ boxShadow: `0 4px 16px ${accent}33` }}>
              <img src={resolveLogoUrl(tenant.logo_url)} alt="logo" className="w-full h-full object-contain"/>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2" style={{ background: "#48BB78", borderColor: bg }}></span>
            </div>
          ) : (
            <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}77)`, boxShadow: `0 4px 20px ${accent}66` }}>
              <Sparkles size={18} className="text-[#0D1117]"/>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 pulse-dot" style={{ background: "#48BB78", borderColor: bg }}></span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-[15px] font-bold leading-tight truncate">{tenant?.bot_name || tenant?.full_name || "AI Concierge"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#48BB78" }}></span>
              <p className="text-white/60 text-[11px] leading-tight truncate">{tenant?.bot_tagline || "Online · replies instantly"}</p>
            </div>
          </div>
          <button data-testid="widget-startcall-btn" onClick={startCall} title="Start face-to-face voice call" className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:scale-105" style={{ background: `${accent}22`, color: accent, border: `1px solid ${accent}55` }}>
            <PhoneCall size={14}/>
          </button>
          <button data-testid="widget-close-btn" onClick={closeWidget} className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <X size={16}/>
          </button>
        </div>
        {/* Hero greeting line - only when it's a fresh conversation */}
        {messages.length <= 1 && (
          <div className="relative mt-4">
            <p className="text-white text-xl font-black leading-tight tracking-tight" data-testid="widget-hero-greeting">
              Hi there! &#128075;
            </p>
            <p className="text-white/70 text-sm mt-1 leading-snug">How can we help you today?</p>
            <button
              data-testid="widget-startcall-hero"
              onClick={startCall}
              className="mt-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-full transition-all hover:scale-[1.02] hover:brightness-110"
              style={{ background: accent, color: "#0D1117", boxShadow: `0 6px 20px ${accent}55` }}
            >
              <PhoneCall size={12}/> Start Live Voice Call
            </button>
          </div>
        )}
      </div>
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 rk-scroll" style={{ maxHeight: embedded ? undefined : 380, background: `radial-gradient(circle at 50% 0%, ${accent}0a 0%, transparent 55%)` }}>
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const isHuman = m.role === "human_agent";
          const isEmpty = !m.text;
          return (
            <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"} msg-in`}>
              {!isUser && (
                <div className="w-7 h-7 rounded-full flex-shrink-0 mr-2 flex items-center justify-center self-end" style={isHuman ? { background: "#48BB78", boxShadow: "0 2px 8px rgba(72,187,120,0.55)" } : { background: `linear-gradient(135deg, ${accent}, ${accent}77)`, boxShadow: `0 2px 8px ${accent}44` }}>
                  {isHuman ? <Headset size={12} className="text-[#0D1117]"/> : <Sparkles size={12} className="text-[#0D1117]"/>}
                </div>
              )}
              <div className={`max-w-[80%] px-4 py-2.5 text-[13.5px] leading-relaxed ${isUser ? "rounded-[18px] rounded-br-[4px]" : "rounded-[18px] rounded-bl-[4px]"}`} style={isUser ? { background: `linear-gradient(135deg, ${bubble}, ${bubble}dd)`, color: "#0D1117", boxShadow: `0 6px 20px ${bubble}33` } : isHuman ? { background: "rgba(72,187,120,0.14)", color: "#fff", border: "1px solid rgba(72,187,120,0.45)", boxShadow: "0 4px 16px rgba(72,187,120,0.15)" } : { background: "rgba(255,255,255,0.055)", color: "#fff", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
                {isHuman && (
                  <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: accent }} data-testid={`widget-humanmsg-${i}`}>Support · Human</p>
                )}
                {isEmpty && !isUser ? (
                  m.searchingPhoto ? (
                    <div className="flex items-center gap-2 text-xs" data-testid="widget-searching">
                      <Loader2 size={12} className="animate-spin" style={{ color: accent }}/> Working on it&hellip;
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 py-1" data-testid="widget-typing">
                      <span className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: accent, animationDelay: "0ms" }}></span>
                      <span className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: accent, animationDelay: "160ms" }}></span>
                      <span className="w-1.5 h-1.5 rounded-full typing-dot" style={{ background: accent, animationDelay: "320ms" }}></span>
                    </div>
                  )
                ) : (
                  <span className="whitespace-pre-wrap">{m.text}</span>
                )}
                {m.gcal && (
                  <a href={m.gcal} target="_blank" rel="noopener noreferrer" data-testid="widget-gcal-link" className="mt-2 block text-xs font-bold underline" style={{ color: isUser ? "#0D1117" : accent }}>Add to Google Calendar &rarr;</a>
                )}
                {m.tracking && (
                  <TrackingTimeline accent={accent} data={m.tracking} testIdSuffix={i}/>
                )}
                {m.matches && m.matches.length > 0 && (
                  <div className="mt-3 space-y-2" data-testid={`widget-photo-matches-${i}`}>
                    {m.matches.map((p, mi) => (
                      <a key={mi} href={p.url || "#"} target="_blank" rel="noopener noreferrer" data-testid={`widget-match-${i}-${mi}`} className="flex items-center gap-2 rounded-lg overflow-hidden border transition-colors hover:bg-white/10" style={{ borderColor: `${accent}44`, background: "rgba(255,255,255,0.03)" }}>
                        {p.image && <img src={p.image} alt={p.name} className="w-12 h-12 object-cover flex-shrink-0"/>}
                        <div className="min-w-0 flex-1 py-1.5 pr-2">
                          <p className="text-white text-xs font-bold truncate">{p.name}</p>
                          <p className="text-[10px]" style={{ color: accent }}>{p.price}</p>
                          {p.reason && <p className="text-[10px] text-white/50 truncate">{p.reason}</p>}
                        </div>
                        <ShoppingCart size={14} style={{ color: accent }} className="mr-2"/>
                      </a>
                    ))}
                  </div>
                )}
                {m.buys && m.buys.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {m.buys.map((b, bi) => (
                      <a key={bi} href={b.url} target="_blank" rel="noopener noreferrer" data-testid={`widget-buy-btn-${bi}`} className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg hover:opacity-90 transition-opacity" style={{ background: accent, color: "#0D1117" }}>
                        <ShoppingCart size={12}/> Buy {b.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {catalog && catalog.length > 0 && messages.length <= 2 && (
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold mb-2">Popular right now</p>
            <div className="grid grid-cols-3 gap-2">
              {catalog.slice(0, 3).map((p, i) => (
                <button key={i} data-testid={`widget-product-${i}`} onClick={() => sendText(`Tell me about the ${p.name}`)} className="text-left bg-white/[0.04] hover:bg-white/[0.08] rounded-xl overflow-hidden border border-white/5 transition-colors">
                  {p.image && <img src={p.image} className="h-16 w-full object-cover" alt={p.name}/>}
                  <div className="p-1.5">
                    <p className="text-white text-[10px] leading-tight font-bold truncate">{p.name}</p>
                    <p className="text-[10px]" style={{ color: accent }}>{p.price}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Suggested action cards - Intercom Fin style, only shown on greeting */}
        {!busy && messages.length <= 2 && !messages.some(m => m.buys?.length) && (
          <div className="pt-2 space-y-2" data-testid="widget-quickreplies">
            {[
              { label: "Show me your products", onClick: () => sendText("Show me your products") },
              { label: "Track my order", testId: "widget-quickreply-track", onClick: startTracking },
              { label: "Send a photo of a product", testId: "widget-quickreply-photo", onClick: () => photoInputRef.current?.click() },
              { label: "Book a call with the team", onClick: () => sendText("Book a call with the team") },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.onClick}
                data-testid={item.testId || `widget-quickreply-${i}`}
                className="w-full text-left text-[13px] px-4 py-3 rounded-2xl border transition-all hover:bg-white/[0.06] hover:border-white/20 group flex items-center justify-between"
                style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "#fff" }}
              >
                <span className="font-medium">{item.label}</span>
                <span className="text-lg opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ color: accent }}>&rarr;</span>
              </button>
            ))}
          </div>
        )}
        {/* Order tracking form */}
        {trackingFor && (
          <div className="pt-2" data-testid="widget-tracking-form">
            <div className="rounded-2xl border p-3 space-y-2" style={{ borderColor: `${accent}55`, background: "rgba(255,255,255,0.03)" }}>
              <input data-testid="widget-track-num" value={trackNum} onChange={e=>setTrackNum(e.target.value)} placeholder="Order # (e.g. 1042)" className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-md px-3 py-2 outline-none"/>
              <input data-testid="widget-track-email" value={trackEmail} onChange={e=>setTrackEmail(e.target.value)} placeholder="Email on the order (optional)" className="w-full bg-[#0D1117] border border-white/10 text-white text-sm rounded-md px-3 py-2 outline-none"/>
              <div className="flex gap-2">
                <button data-testid="widget-track-submit" disabled={trackBusy || !trackNum.trim()} onClick={submitTracking} className="flex-1 text-xs font-bold px-3 py-2 rounded-md disabled:opacity-40" style={{ background: accent, color: "#0D1117" }}>
                  {trackBusy ? "Looking…" : "Track order"}
                </button>
                <button data-testid="widget-track-cancel" onClick={() => { setTrackingFor(false); setTrackNum(""); setTrackEmail(""); }} className="text-xs font-bold px-3 py-2 rounded-md border border-white/15 text-white/70 hover:bg-white/5">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Input row */}
      <div className="p-3 border-t border-white/5 flex gap-2 items-center" style={{ background: "rgba(255,255,255,0.02)" }}>
        <input ref={photoInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) sendPhoto(f); e.target.value = ""; }} className="hidden" data-testid="widget-photo-input"/>
        <button data-testid="widget-photo-btn" onClick={() => photoInputRef.current?.click()} disabled={visionBusy || busy} title="Send a photo — I'll find matching products" className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40" style={{ background: "rgba(255,255,255,0.05)", color: accent }}>
          <Camera size={16}/>
        </button>
        <button data-testid="widget-track-btn" onClick={startTracking} title="Track your order" className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all" style={{ background: "rgba(255,255,255,0.05)", color: accent }}>
          <Package size={16}/>
        </button>
        <button data-testid="widget-mic-btn" onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all" style={{ background: recording ? "#F56565" : "rgba(255,255,255,0.05)", color: recording ? "#fff" : accent, transform: recording ? "scale(1.08)" : "scale(1)" }} title="Hold to talk (one voice message)">
          {recording ? <MicOff size={16}/> : <Mic size={16}/>}
        </button>
        <input data-testid="widget-chat-input" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendText(input)} placeholder={recording ? "Listening..." : "Message the concierge..."} className="flex-1 bg-white/[0.04] text-white text-sm rounded-full px-4 py-2.5 outline-none border border-white/5 focus:border-[#48BB78]/50 placeholder:text-white/30 transition-colors"/>
        <button data-testid="widget-send-btn" onClick={() => sendText(input)} disabled={busy || !input.trim()} className="w-10 h-10 rounded-full font-bold flex items-center justify-center disabled:opacity-30 transition-transform hover:scale-105 disabled:hover:scale-100 flex-shrink-0" style={{ background: accent, color: "#0D1117" }}>
          {busy ? <Loader2 className="animate-spin" size={16}/> : <Send size={15}/>}
        </button>
      </div>
      <div className="px-3 pb-2 text-center">
        <p className="text-[9px] uppercase tracking-widest text-white/25 font-bold">Powered by Rozio-Killer AI</p>
      </div>
    </div>
  );
}


// ============ Package journey timeline (Ordered → Packed → Shipped → Delivered) ============
function TrackingTimeline({ data, accent, testIdSuffix }) {
  const stages = data.stages || [];
  return (
    <div className="mt-3 rounded-xl border p-3" style={{ borderColor: `${accent}44`, background: "rgba(255,255,255,0.03)" }} data-testid={`widget-tracking-${testIdSuffix}`}>
      <div className="flex items-center gap-1.5 mb-3">
        <Package size={12} style={{ color: accent }}/>
        <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: accent }}>Order {data.order_number}</p>
      </div>
      <div className="relative">
        {/* Connector line */}
        <div className="absolute top-2.5 left-2.5 right-2.5 h-0.5 bg-white/10"/>
        <div className="absolute top-2.5 left-2.5 h-0.5" style={{ background: accent, width: `${(stages.filter(s=>s.done).length - 1) / Math.max(1, stages.length - 1) * 100}%`, maxWidth: "calc(100% - 20px)" }}/>
        <div className="relative flex justify-between">
          {stages.map((s, i) => (
            <div key={s.key} className="flex flex-col items-center" data-testid={`widget-tracking-stage-${testIdSuffix}-${s.key}`}>
              <div className="w-5 h-5 rounded-full flex items-center justify-center relative" style={{ background: s.done ? accent : "rgba(255,255,255,0.10)", boxShadow: s.done ? `0 0 12px ${accent}88` : "none" }}>
                {s.done ? <CheckCircle2 size={10} className="text-[#0D1117]"/> : <Circle size={8} className="text-white/40"/>}
              </div>
              <p className={`text-[9px] mt-1.5 font-bold uppercase tracking-wider ${s.done ? "text-white" : "text-white/40"}`}>{s.label}</p>
              {s.at && s.done && <p className="text-[8px] text-white/40 mt-0.5">{new Date(s.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>}
            </div>
          ))}
        </div>
      </div>
      {data.tracking_url && (
        <a href={data.tracking_url} target="_blank" rel="noopener noreferrer" data-testid={`widget-tracking-link-${testIdSuffix}`} className="mt-3 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest hover:underline" style={{ color: accent }}>
          Carrier tracking &rarr;
        </a>
      )}
      {data.tracking_number && !data.tracking_url && (
        <p className="mt-2 text-[10px] text-white/50 font-mono">Tracking # {data.tracking_number}</p>
      )}
    </div>
  );
}
