import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload, Sparkles, CalendarDays, Palette, Bot, Link2, FileText, Copy, Check, Maximize2, CalendarClock, Video, Clock, Ban, Plus, Trash2, Image as ImageIcon, Settings2, Home, MessagesSquare, BookOpen, Send, User, Zap, Loader2, Activity, ShieldAlert, X, GraduationCap, KeyRound, Mail, Phone } from "lucide-react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Widget from "@/components/Widget";
import MetricsBar from "@/components/MetricsBar";
import MouseGradient from "@/components/MouseGradient";
import ParticleCanvas from "@/components/ParticleCanvas";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const INDUSTRIES = ["E-Commerce", "Local Service", "General Website"];
const industryPrompts = {
  "E-Commerce": "Describe your store, catalog focus, shipping zones... e.g. 'We are a modern sneaker shop shipping worldwide.'",
  "Local Service": "Describe your service radius and offerings... e.g. 'We are a cleaning company serving downtown Austin.'",
  "General Website": "Describe your organisation and top questions from visitors.",
};

export default function Dashboard() {
  const { user, logout, refresh } = useAuth();
  const nav = useNavigate();
  const [section, setSection] = useState("dashboard");
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash && ["dashboard", "messages", "knowledge", "settings"].includes(hash)) setSection(hash);
  }, []);

  const handleSelect = (k) => {
    setSection(k);
    window.location.hash = k;
  };

  const updateField = async (field, value) => {
    await api.put("/me/profile", { [field]: value });
    await refresh();
  };

  if (!user) return null;

  const impersonating = !!localStorage.getItem("rk_admin_token");
  const exitViewAs = () => {
    const adminTok = localStorage.getItem("rk_admin_token");
    if (adminTok) { localStorage.setItem("rk_token", adminTok); localStorage.removeItem("rk_admin_token"); }
    window.location.href = "/admin";
  };

  const colors = {
    widget_bg: user.widget_bg || "#1A202C",
    bubble_color: user.bubble_color || "#48BB78",
    accent_color: user.accent_color || "#48BB78",
    user_text_color: user.user_text_color || "#0D1117",
    bot_bubble_color: user.bot_bubble_color || "#232B36",
    bot_text_color: user.bot_text_color || "#FFFFFF",
  };

  return (
    <div className="min-h-screen flex bg-[#0B1016] text-white">
      <DashboardSidebar active={section} onSelect={handleSelect} user={user} onLogout={() => { logout(); nav("/"); }}/>

      <main className="flex-1 min-w-0 overflow-x-hidden">
        {impersonating && (
          <div data-testid="impersonation-banner" className="bg-[#ED8936] text-[#1A202C] px-6 md:px-10 py-2.5 flex items-center justify-between text-sm font-bold">
            <span className="flex items-center gap-2"><ShieldAlert size={16}/> View As mode — you are viewing <span className="underline">{user.email}</span>'s workspace as admin</span>
            <button data-testid="exit-view-as-btn" onClick={exitViewAs} className="inline-flex items-center gap-1.5 bg-[#1A202C] text-white px-3 py-1.5 rounded-md hover:bg-black/70 transition-colors"><X size={13}/> Exit View As</button>
          </div>
        )}
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-[#0B1016]/95 backdrop-blur border-b border-white/5 px-6 md:px-10 py-4 flex items-center justify-between">
          <div>
            <p className="uppercase text-[10px] tracking-[0.3em] font-bold text-[#48BB78]">Client Workspace</p>
            <h1 className="font-display font-black text-2xl tracking-tight">{section === "knowledge" ? "Knowledge Base" : section.charAt(0).toUpperCase() + section.slice(1)}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button data-testid="topbar-open-preview" onClick={() => setPreviewOpen(true)} size="sm" className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">
              <Maximize2 size={14} className="mr-1.5"/> Live Preview
            </Button>
          </div>
        </header>

        {/* Section content — locked-width, centered workspace */}
        <div className="px-6 md:px-10 py-8 max-w-[1200px] mx-auto w-full">
          {section === "dashboard" && <DashboardHome user={user} colors={colors} onOpenPreview={() => setPreviewOpen(true)}/>}
          {section === "messages" && <MessagesInbox tenantId={user.id}/>}
          {section === "knowledge" && <KnowledgeBase user={user} updateField={updateField} refresh={refresh}/>}
          {section === "settings" && <SettingsPanel user={user} updateField={updateField} refresh={refresh} colors={colors}/>}
        </div>
      </main>

      {/* Live Preview Modal — full viewport, edge-to-edge */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-[#0D1117] border-0 text-white !max-w-none !w-screen !h-screen !p-0 overflow-hidden flex flex-col !rounded-none !fixed !left-0 !top-0 !translate-x-0 !translate-y-0 data-[state=open]:!zoom-in-100 data-[state=closed]:!zoom-out-100">
          <DialogHeader className="px-6 py-3 border-b border-white/10 flex-shrink-0">
            <DialogTitle className="font-display text-xl">Live Preview &mdash; test your widget on any site</DialogTitle>
          </DialogHeader>
          <LivePreviewSandbox
            user={user}
            colors={colors}
            open={previewOpen}
            initialUrl={user.crawled_url || user.target_domain}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ================= DASHBOARD HOME =================
function DashboardHome({ user, colors, onOpenPreview }) {
  const backend = process.env.REACT_APP_BACKEND_URL;
  const snippet = `<script async src="${backend}/api/embed/${user.id}/loader.js"></script>`;
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Embed script copied");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-8">
      <MetricsBar/>

      {/* Two-column: Preview card + Install snippet */}
      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 bg-[#141B24] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-6 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#48BB78] mb-1">Sandbox</p>
                <h2 className="font-display font-black text-xl">Live widget preview</h2>
                <p className="text-xs text-[#A0AEC0] mt-1">Try the chat, mic, and voice-call button — this is exactly what your visitors will see.</p>
              </div>
              <Button data-testid="home-open-preview" onClick={onOpenPreview} variant="outline" size="sm" className="border-white/10 bg-transparent text-white hover:bg-white/5">
                <Maximize2 size={12} className="mr-1.5"/> Full-screen
              </Button>
            </div>
          </div>
          <div className="relative h-[540px] bg-[#0D1117] border-t border-white/5 dot-grid overflow-hidden">
            <MouseGradient color={colors.accent_color} intensity={0.10}/>
            <ParticleCanvas color={colors.accent_color} density={35}/>
            <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
              <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: colors.accent_color }}></span>
              <span className="uppercase text-[10px] tracking-[0.3em] font-bold text-[#48BB78]">Interactive Sandbox</span>
            </div>
            <Widget tenant={user} colors={colors} catalog={user.catalog || []}/>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <RecentActivity/>
          {/* Embed snippet card */}
          <div className="bg-gradient-to-br from-[#48BB78]/10 via-[#141B24] to-[#141B24] border border-[#48BB78]/30 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-[#48BB78]"/>
              <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#48BB78]">One-line install</p>
            </div>
            <h3 className="font-display font-black text-lg mb-2">Drop this into your site</h3>
            <p className="text-xs text-[#A0AEC0] mb-4">Shopify, WordPress, Webflow, or any HTML page. Colors sync live.</p>
            <div className="bg-[#0D1117] border border-white/10 rounded-lg p-3 font-mono text-[11px] text-[#48BB78] break-all mb-3" data-testid="home-embed-snippet">{snippet}</div>
            <button data-testid="home-embed-copy" onClick={copy} className="w-full inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-lg bg-[#48BB78] hover:bg-[#38A169] text-[#0D1117] hover:text-white transition-colors">
              {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy snippet"}
            </button>
          </div>

          {/* Capabilities card */}
          <div className="bg-[#141B24] border border-white/5 rounded-2xl p-6">
            <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#48BB78] mb-3">What your bot can do</p>
            <ul className="space-y-3 text-[13px]">
              {[
                { icon: "🛍️", title: "Product Q&A + upsells", desc: "Answers about products, shipping & policies, then recommends and guides to checkout" },
                { icon: "📦", title: "Order tracking", desc: "Real-time package journey (Ordered → Packed → Shipped → Delivered)" },
                { icon: "🖼️", title: "Photo → product search", desc: "Visitors can send an image and get a match from your catalog" },
                { icon: "🌍", title: "95+ languages", desc: "Auto-detects the visitor's language and replies in the same one" },
                { icon: "📞", title: "Voice + human takeover", desc: "Face-to-face voice call, plus one-tap live escalation" },
              ].map((c, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="text-lg flex-shrink-0">{c.icon}</span>
                  <div className="min-w-0">
                    <p className="text-white font-bold text-[13px]">{c.title}</p>
                    <p className="text-[#A0AEC0] text-[12px] leading-snug">{c.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ================= RECENT ACTIVITY FEED =================
function RecentActivity() {
  const [events, setEvents] = useState([]);
  const [sample, setSample] = useState(false);
  useEffect(() => {
    const load = () => api.get("/me/activity").then(r => { setEvents(r.data.events || []); setSample(!!r.data.is_sample); }).catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);
  const iconFor = (type) => type === "booking" ? <CalendarDays size={13}/> : type === "escalation" ? <MessagesSquare size={13}/> : <Sparkles size={13}/>;
  const rel = (at) => {
    if (!at) return "";
    const diff = Math.max(0, (Date.now() - new Date(at).getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${Math.floor(diff)}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };
  return (
    <div className="bg-[#141B24] border border-white/5 rounded-2xl p-6" data-testid="recent-activity">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[#48BB78]"/>
          <p className="text-[10px] uppercase tracking-[0.3em] font-bold text-[#48BB78]">Recent activity</p>
        </div>
        {sample && <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/50" data-testid="activity-sample-badge">Sample</span>}
      </div>
      <ul className="space-y-2.5">
        {events.map((e, i) => (
          <li key={i} className="flex items-center gap-3" data-testid={`activity-item-${i}`}>
            <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-[#48BB78]/12 text-[#48BB78]">{iconFor(e.type)}</span>
            <p className="text-[13px] text-white/85 flex-1 min-w-0 truncate">{e.text}</p>
            <span className="text-[10px] text-white/35 flex-shrink-0">{rel(e.at)}</span>
          </li>
        ))}
        {events.length === 0 && <li className="text-xs text-white/40">No activity yet.</li>}
      </ul>
    </div>
  );
}

// ================= MESSAGES INBOX =================
function MessagesInbox({ tenantId }) {
  const [convs, setConvs] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [conv, setConv] = useState(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const loadConvs = useCallback(async () => {
    try {
      const r = await api.get("/messages/conversations");
      setConvs(r.data);
      if (!activeId && r.data.length) setActiveId(r.data[0].session_id);
    } catch {}
  }, [activeId]);

  const loadThread = useCallback(async (sid) => {
    try {
      const r = await api.get(`/messages/conversations/${sid}`);
      setMsgs(r.data.messages || []);
      setConv(r.data.conversation);
    } catch {}
  }, []);

  const activeIdRef = useRef(null);
  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);

  // Live inbox via Server-Sent Events — updates push in instantly, no manual refresh
  useEffect(() => {
    loadConvs();
    const token = localStorage.getItem("rk_token");
    if (!token) return;
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/messages/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "update" && data.conversations?.length) {
          setConvs((prev) => {
            const map = new Map(prev.map((c) => [c.session_id, c]));
            data.conversations.forEach((c) => map.set(c.session_id, c));
            return Array.from(map.values()).sort((a, b) => (b.last_at || "").localeCompare(a.last_at || ""));
          });
          if (activeIdRef.current && data.conversations.some((c) => c.session_id === activeIdRef.current)) {
            loadThread(activeIdRef.current);
          }
        }
      } catch {}
    };
    return () => es.close();
  }, [loadConvs, loadThread]);
  useEffect(() => { if (activeId) loadThread(activeId); }, [activeId, loadThread]);

  const sendHumanReply = async () => {
    if (!reply.trim() || !activeId) return;
    setBusy(true);
    try {
      await api.post(`/messages/conversations/${activeId}/reply`, { text: reply.trim() });
      setReply("");
      await Promise.all([loadThread(activeId), loadConvs()]);
      toast.success("Reply sent — AI paused for this conversation");
    } catch { toast.error("Send failed"); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid lg:grid-cols-[340px_1fr] gap-4 h-[calc(100vh-180px)]">
      {/* Conversations list */}
      <div className="bg-[#141B24] border border-white/5 rounded-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <p className="font-display font-bold text-sm">Inbox <span className="text-[#48BB78] font-mono ml-1">{convs.length}</span></p>
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#48BB78] flex items-center gap-1.5" data-testid="inbox-live-indicator"><span className="w-1.5 h-1.5 rounded-full bg-[#48BB78] animate-pulse"/> Live</span>
        </div>
        <div className="flex-1 overflow-y-auto rk-scroll" data-testid="inbox-list">
          {convs.length === 0 ? (
            <div className="p-6 text-center">
              <MessagesSquare size={28} className="text-[#48BB78]/50 mx-auto mb-3"/>
              <p className="text-sm text-white/60 mb-1 font-bold">No conversations yet</p>
              <p className="text-xs text-white/40">When someone chats with your embedded widget, threads land here.</p>
            </div>
          ) : convs.map((c) => (
            <button
              key={c.session_id}
              data-testid={`inbox-conv-${c.session_id}`}
              onClick={() => setActiveId(c.session_id)}
              className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${activeId === c.session_id ? "bg-[#48BB78]/10 border-l-2 border-l-[#48BB78]" : "hover:bg-white/5"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-white text-[12px] font-bold truncate flex-1">Visitor · {c.session_id.slice(-6)}</p>
                <span className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded ${c.status === "human" ? "bg-[#48BB78]/20 text-[#48BB78]" : "bg-white/10 text-white/50"}`}>{c.status === "human" ? "You" : "AI"}</span>
              </div>
              <p className="text-[11px] text-white/50 truncate">{c.last_reply || c.last_message || "New conversation"}</p>
              <p className="text-[10px] text-white/30 mt-1">{c.last_at ? new Date(c.last_at).toLocaleString() : ""}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      <div className="bg-[#141B24] border border-white/5 rounded-2xl overflow-hidden flex flex-col min-h-0">
        {activeId && conv ? (
          <>
            <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-bold">Conversation · {activeId.slice(-8)}</p>
                <p className="text-[11px] text-white/40">{conv.msg_count || msgs.length} messages · {conv.status === "human" ? "Human handling" : "AI is answering"}</p>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-[#48BB78] font-bold">Live thread</span>
            </div>
            <div className="flex-1 overflow-y-auto rk-scroll px-5 py-4 space-y-3" data-testid="inbox-thread">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[75%] px-4 py-2.5 text-[13px] leading-relaxed rounded-2xl ${m.role === "user" ? "bg-white/5 text-white rounded-bl-sm" : m.role === "human_agent" ? "bg-[#48BB78] text-[#0D1117] rounded-br-sm font-medium" : "bg-[#48BB78]/15 text-white border border-[#48BB78]/25 rounded-br-sm"}`}>
                    <p className="whitespace-pre-wrap">{m.text}</p>
                    <p className="text-[9px] opacity-60 mt-1">{m.role === "user" ? "Visitor" : m.role === "human_agent" ? "You (human)" : "AI"} · {new Date(m.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
              {msgs.length === 0 && <p className="text-center text-white/40 text-sm">No messages in this thread yet.</p>}
            </div>
            <div className="border-t border-white/5 px-4 py-3 flex items-center gap-2 bg-[#0D1117]">
              <Input data-testid="inbox-reply-input" value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === "Enter" && sendHumanReply()} placeholder="Type your human reply — AI will pause for this thread" className="bg-[#141B24] border-white/10 text-white h-11"/>
              <Button data-testid="inbox-reply-send" onClick={sendHumanReply} disabled={busy || !reply.trim()} className="bg-[#48BB78] hover:bg-[#38A169] text-[#0D1117] hover:text-white font-bold h-11 rounded-md">
                <Send size={14} className="mr-1.5"/>{busy ? "Sending..." : "Send"}
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <MessagesSquare size={40} className="text-[#48BB78]/40 mx-auto mb-3"/>
              <p className="text-white/70 font-bold">Select a conversation</p>
              <p className="text-white/40 text-sm mt-1">Every chat from your widget lands here. You can take over anytime.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ================= KNOWLEDGE BASE =================
function KnowledgeBase({ user, updateField, refresh }) {
  const [files, setFiles] = useState([]);
  const [crawlUrl, setCrawlUrl] = useState(user?.crawled_url || "");
  const [busy, setBusy] = useState(false);

  const loadFiles = useCallback(() => {
    api.get("/knowledge/files").then(r => setFiles(r.data)).catch(() => {});
  }, []);
  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { toast.error("Only PDF files"); return; }
    setBusy(true);
    const fd = new FormData(); fd.append("file", file);
    try {
      await fetch(`${API}/knowledge/upload`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("rk_token")}` }, body: fd });
      toast.success("PDF uploaded to knowledge base");
      loadFiles();
    } catch { toast.error("Upload failed"); }
    finally { setBusy(false); }
  };

  const doCrawl = async () => {
    if (!crawlUrl) return;
    setBusy(true);
    try {
      const { data } = await api.post("/knowledge/crawl", { url: crawlUrl });
      toast.success(`Successfully crawled ${data.products.length} product${data.products.length === 1 ? "" : "s"}`);
      await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Error crawling site — check the URL and try again"); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <Card title="Business context" subtitle="How the AI understands your business">
        <div className="space-y-4">
          <div>
            <Label className="text-[#A0AEC0]">Industry</Label>
            <Select value={user.industry || "General Website"} onValueChange={(v) => updateField("industry", v)}>
              <SelectTrigger data-testid="industry-select" className="mt-1.5 bg-[#0D1117] border-white/10 text-white h-11"><SelectValue/></SelectTrigger>
              <SelectContent className="bg-[#2D3748] border-white/10 text-white">
                {INDUSTRIES.map(i => <SelectItem key={i} value={i} className="focus:bg-[#48BB78]/20 focus:text-white">{i}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[#A0AEC0]">Custom instruction</Label>
            <Textarea data-testid="instruction-textarea" defaultValue={user.custom_instruction || ""} onBlur={e => updateField("custom_instruction", e.target.value)} placeholder={industryPrompts[user.industry || "General Website"]} className="mt-1.5 bg-[#0D1117] border-white/10 text-white min-h-[110px]"/>
            <p className="text-xs text-[#A0AEC0] mt-1.5">Saved on blur. The AI concierge uses this to answer visitors.</p>
          </div>
        </div>
      </Card>

      <Card title="Website crawl / catalog sync" subtitle="Pull real products, prices & shipping info from your site">
        <div className="flex gap-2">
          <Input data-testid="crawl-url-input" value={crawlUrl} onChange={e => setCrawlUrl(e.target.value)} placeholder="https://yourshop.com/products" className="bg-[#0D1117] border-white/10 text-white h-11"/>
          <Button data-testid="crawl-btn" onClick={doCrawl} disabled={busy} className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold h-11 rounded-md min-w-[110px]">{busy ? <><Loader2 size={14} className="mr-1.5 animate-spin"/> Syncing…</> : <><Link2 size={14} className="mr-1.5"/> Sync</>}</Button>
        </div>
        {user.catalog?.length > 0 && (
          <div data-testid="catalog-preview" className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {user.catalog.map((p, i) => (
              <div key={i} className="bg-[#0D1117] rounded-md p-2 border border-white/5 text-xs">
                {p.image && <img src={p.image} alt={p.name} className="h-16 w-full object-cover rounded mb-2"/>}
                <p className="text-white font-bold truncate">{p.name}</p>
                <p className="text-[#48BB78]">{p.price}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="PDF knowledge" subtitle="Upload menus, policies, FAQs — the AI reads them and cites answers">
        <label onDrop={handleDrop} onDragOver={e => e.preventDefault()} className="border-2 border-dashed border-white/10 hover:border-[#48BB78]/50 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#0D1117]/50">
          <Upload size={22} className="text-[#48BB78] mb-2"/>
          <p className="text-sm text-white font-bold">Drop PDF or click to upload</p>
          <p className="text-xs text-[#A0AEC0] mt-1">Stored securely in Emergent Object Storage</p>
          <input data-testid="pdf-upload-input" type="file" accept=".pdf" onChange={handleDrop} className="hidden"/>
        </label>
        {files.length > 0 && (
          <ul data-testid="files-list" className="mt-3 space-y-1.5">
            {files.map(f => (
              <li key={f.id} className="flex items-center gap-2 text-sm text-[#A0AEC0] bg-[#0D1117] px-3 py-2 rounded-md border border-white/5">
                <FileText size={14} className="text-[#48BB78]"/> {f.original_filename} <span className="ml-auto text-xs">{(f.size/1024).toFixed(1)} KB</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ================= SETTINGS =================
function SettingsPanel({ user, updateField, refresh, colors }) {
  return (
    <div className="max-w-4xl">
      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="bg-[#141B24] border border-white/5 rounded-lg p-1 h-11 mb-6 w-full grid grid-cols-6">
          <TabsTrigger data-testid="settings-tab-branding" value="branding" className="data-[state=active]:bg-[#0D1117] data-[state=active]:text-[#48BB78] text-white/60"><Palette size={13} className="mr-1.5"/>Branding</TabsTrigger>
          <TabsTrigger data-testid="settings-tab-bot" value="bot" className="data-[state=active]:bg-[#0D1117] data-[state=active]:text-[#48BB78] text-white/60"><Bot size={13} className="mr-1.5"/>Bot Identity</TabsTrigger>
          <TabsTrigger data-testid="settings-tab-booking" value="booking" className="data-[state=active]:bg-[#0D1117] data-[state=active]:text-[#48BB78] text-white/60"><CalendarClock size={13} className="mr-1.5"/>Booking</TabsTrigger>
          <TabsTrigger data-testid="settings-tab-keys" value="keys" className="data-[state=active]:bg-[#0D1117] data-[state=active]:text-[#48BB78] text-white/60"><KeyRound size={13} className="mr-1.5"/>My Keys</TabsTrigger>
          <TabsTrigger data-testid="settings-tab-integrations" value="integrations" className="data-[state=active]:bg-[#0D1117] data-[state=active]:text-[#48BB78] text-white/60"><Zap size={13} className="mr-1.5"/>Integrations</TabsTrigger>
          <TabsTrigger data-testid="settings-tab-training" value="training" className="data-[state=active]:bg-[#0D1117] data-[state=active]:text-[#48BB78] text-white/60"><GraduationCap size={13} className="mr-1.5"/>Training</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="space-y-6">
          <Card title="Visual style" subtitle="Colors and background — live-sync with the widget">
            <div className="space-y-4">
              <AvatarGenderPicker current={user.avatar_gender || "female"} onChange={v => updateField("avatar_gender", v)}/>
              <AvatarBackgroundPicker current={user.avatar_background || "studio_dark"} onChange={v => updateField("avatar_background", v)}/>
              <ColorPicker testId="color-widget-bg" label="Widget background" value={colors.widget_bg} onChange={v => updateField("widget_bg", v)}/>
              <ColorPicker testId="color-bubble" label="Bubble color" value={colors.bubble_color} onChange={v => updateField("bubble_color", v)}/>
              <ColorPicker testId="color-accent" label="Button / accent color" value={colors.accent_color} onChange={v => updateField("accent_color", v)}/>
            </div>
          </Card>
          <Card title="Message colors" subtitle="Fine-tune the chat bubbles — live-sync with the widget">
            <div className="space-y-4">
              <ColorPicker testId="color-bot-text" label="Bot message text color" value={colors.bot_text_color} onChange={v => updateField("bot_text_color", v)}/>
              <ColorPicker testId="color-bot-bubble" label="Bot message bubble color" value={colors.bot_bubble_color} onChange={v => updateField("bot_bubble_color", v)}/>
              <ColorPicker testId="color-user-text" label="Your message text color" value={colors.user_text_color} onChange={v => updateField("user_text_color", v)}/>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="bot" className="space-y-6">
          <BotCustomizationPanel user={user} updateField={updateField} refresh={refresh}/>
        </TabsContent>

        <TabsContent value="booking" className="space-y-6">
          <BookingRulesPanel user={user} updateField={updateField}/>
        </TabsContent>

        <TabsContent value="keys" className="space-y-6">
          <ClientKeysPanel/>
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <IntegrationsHub/>
          <GoogleCalendarCard/>
          <Card title="Shopify order tracking" subtitle="Let visitors track their order right inside the chat. Requires an Admin API access token from your Shopify store.">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[#A0AEC0]">Shopify store domain</Label>
                <Input data-testid="shopify-domain-input" defaultValue={user.shopify_domain || ""} onBlur={e => updateField("shopify_domain", e.target.value.replace(/^https?:\/\//, "").replace(/\/$/, ""))} placeholder="yourshop.myshopify.com" className="mt-1.5 bg-[#0D1117] border-white/10 text-white h-11"/>
              </div>
              <div>
                <Label className="text-[#A0AEC0]">Admin API access token</Label>
                <Input data-testid="shopify-token-input" type="password" defaultValue={user.shopify_admin_token || ""} onBlur={e => updateField("shopify_admin_token", e.target.value)} placeholder="shpat_..." className="mt-1.5 bg-[#0D1117] border-white/10 text-white h-11"/>
              </div>
            </div>
            <p className="text-[11px] text-[#A0AEC0] mt-3 leading-relaxed">
              Get a token: Shopify Admin → Apps → App and sales channel settings → Develop apps → Create an app → API scopes → grant <b>read_orders</b> and <b>read_fulfillments</b>, then install and copy the Admin API access token.
            </p>
          </Card>
          <Card title="Contact & notifications" subtitle="Where escalations and lead alerts are sent">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-[#A0AEC0]">Notification email</Label>
                <Input data-testid="notif-email" defaultValue={user.notification_email || ""} onBlur={e => updateField("notification_email", e.target.value)} placeholder="ops@yourcompany.com" className="mt-1.5 bg-[#0D1117] border-white/10 text-white h-11"/>
              </div>
              <div>
                <Label className="text-[#A0AEC0]">Business owner phone</Label>
                <Input data-testid="notif-phone" defaultValue={user.business_owner_phone || ""} onBlur={e => updateField("business_owner_phone", e.target.value)} placeholder="+15551234567" className="mt-1.5 bg-[#0D1117] border-white/10 text-white h-11"/>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-6">
          <TrainingCenter/>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ================= REUSABLE UI =================
function Card({ title, subtitle, children }) {
  return (
    <div className="bg-[#141B24] border border-white/5 rounded-2xl p-6">
      <div className="mb-4">
        <h3 className="font-display font-bold text-white text-lg">{title}</h3>
        {subtitle && <p className="text-xs text-[#A0AEC0] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ============ CLIENT KEYS (per-account, encrypted) ============
const CK_ICONS = { mail: Mail, calendar: CalendarClock, "message-square": MessagesSquare, phone: Phone, sparkles: Sparkles };
function ClientKeysPanel() {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({});
  const [configured, setConfigured] = useState({});
  const [saving, setSaving] = useState(false);
  const hydrate = useCallback(async () => {
    try {
      const r = await api.get("/me/platform-keys");
      const cats = r.data.categories || [];
      setCategories(cats);
      const f = {}; const c = {};
      cats.forEach(cat => cat.fields.forEach(fl => { f[fl.key] = fl.secret ? "" : (fl.value || ""); c[fl.key] = fl.configured; }));
      setForm(f); setConfigured(c);
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { hydrate(); }, [hydrate]);
  const save = async () => {
    setSaving(true);
    try {
      const values = {};
      categories.forEach(cat => cat.fields.forEach(fl => {
        const v = (form[fl.key] ?? "").trim();
        if (fl.secret) { if (v) values[fl.key] = v; } else { values[fl.key] = v; }
      }));
      await api.put("/me/platform-keys", { values });
      toast.success("Your keys were saved securely");
      await hydrate();
    } catch { toast.error("Could not save your keys"); }
    finally { setSaving(false); }
  };
  return (
    <div className="bg-[#141B24] border border-white/5 rounded-2xl p-6" data-testid="client-keys-panel">
      <div className="mb-1 flex items-center gap-2">
        <KeyRound size={16} className="text-[#48BB78]"/>
        <h3 className="font-display font-bold text-white text-lg">My Keys &amp; Integrations</h3>
      </div>
      <p className="text-xs text-[#A0AEC0] mb-5">These belong to your account only — email, calendar, messaging, voice & chat. Secrets are encrypted and shown masked. Leave a secret blank to keep the current value.</p>
      <div className="space-y-6">
        {categories.map(cat => {
          const Icon = CK_ICONS[cat.icon] || KeyRound;
          return (
            <div key={cat.category} data-testid={`ck-cat-${cat.category}`}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                <Icon size={15} className="text-[#48BB78]"/>
                <h4 className="font-display font-bold text-sm text-white">{cat.label}</h4>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {cat.fields.map(fl => (
                  <div key={fl.key}>
                    <div className="flex items-center justify-between mb-1">
                      <Label className="text-[11px] text-[#A0AEC0] font-bold uppercase tracking-widest">{fl.label}</Label>
                      {fl.secret && configured[fl.key] && (
                        <span data-testid={`ck-configured-${fl.key}`} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[#48BB78] text-[#0D1117]"><Check size={9} strokeWidth={3}/> {fl.value || "Set"}</span>
                      )}
                    </div>
                    <Input
                      data-testid={`ck-input-${fl.key}`}
                      type={fl.secret ? "password" : "text"}
                      value={form[fl.key] ?? ""}
                      onChange={e => setForm(s => ({ ...s, [fl.key]: e.target.value }))}
                      placeholder={fl.secret && configured[fl.key] ? "•••• enter new to replace" : fl.placeholder}
                      className={`bg-[#0D1117] border-white/10 text-white h-10 mt-0.5 text-sm ${fl.secret ? "font-mono text-xs" : ""}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Button data-testid="client-keys-save" onClick={save} disabled={saving} className="mt-6 bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">
        {saving ? "Saving…" : "Save my keys"}
      </Button>
    </div>
  );
}

// ============ INTEGRATIONS HUB (encrypted secrets) ============
function IntegrationsHub() {
  const [items, setItems] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const load = useCallback(() => api.get("/me/integrations").then(r => setItems(r.data.integrations || [])).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const setField = (provider, field, value) => setDrafts(d => ({ ...d, [provider]: { ...(d[provider] || {}), [field]: value } }));
  const save = async (it) => {
    setSavingKey(it.provider);
    try {
      await api.put("/me/integrations", { provider: it.provider, values: drafts[it.provider] || {} });
      toast.success(`${it.label} connected securely`);
      setDrafts(d => ({ ...d, [it.provider]: {} }));
      await load();
    } catch { toast.error("Could not save integration"); }
    finally { setSavingKey(null); }
  };
  const remove = async (it) => { await api.delete(`/me/integrations/${it.provider}`); toast.success(`${it.label} disconnected`); await load(); };
  const fieldLabel = (f) => ({ api_key: "API Key", api_secret: "API Secret", webhook_url: "Webhook URL" }[f] || f);
  return (
    <Card title="Integrations Hub" subtitle="Connect third-party tools. Keys are encrypted at rest and never shown again.">
      <div className="space-y-3" data-testid="integrations-hub">
        {items.map(it => (
          <div key={it.provider} className="bg-[#0D1117] border border-white/5 rounded-xl p-4" data-testid={`integration-${it.provider}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-md bg-[#48BB78]/10 border border-[#48BB78]/25 text-[#48BB78] flex items-center justify-center"><KeyRound size={16}/></div>
                <div>
                  <p className="text-white font-bold text-sm">{it.label}</p>
                  {it.connected
                    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#48BB78]" data-testid={`integration-status-${it.provider}`}><Check size={11}/> Connected {it.masked?.[it.fields[0]] ? `· ${it.masked[it.fields[0]]}` : ""}</span>
                    : <span className="text-[10px] uppercase tracking-widest text-white/40 font-bold" data-testid={`integration-status-${it.provider}`}>Not connected</span>}
                </div>
              </div>
              {it.connected && <button data-testid={`integration-remove-${it.provider}`} onClick={() => remove(it)} className="text-red-400 hover:text-red-300 text-xs font-bold inline-flex items-center gap-1"><Trash2 size={12}/> Remove</button>}
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {it.fields.map(f => (
                <Input key={f} data-testid={`integration-${it.provider}-${f}`} type="password" value={(drafts[it.provider] || {})[f] || ""} onChange={e => setField(it.provider, f, e.target.value)} placeholder={it.connected ? `Update ${fieldLabel(f)}` : fieldLabel(f)} className="bg-[#141B24] border-white/10 text-white h-10 font-mono text-xs"/>
              ))}
            </div>
            <Button data-testid={`integration-save-${it.provider}`} onClick={() => save(it)} disabled={savingKey === it.provider} size="sm" className="mt-2 bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">
              {savingKey === it.provider ? <Loader2 size={13} className="mr-1.5 animate-spin"/> : <KeyRound size={13} className="mr-1.5"/>}{it.connected ? "Update key" : "Connect"}
            </Button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============ CONVERSATION TRAINING CENTER ============
function TrainingCenter() {
  const [transcripts, setTranscripts] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [analytics, setAnalytics] = useState({ total_corrections: 0, total_uses: 0, ranked: [] });
  const [edits, setEdits] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [sugEdits, setSugEdits] = useState({});
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState("");
  const [scanned, setScanned] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const scanSuggestions = async () => {
    setScanning(true); setScanMsg(""); setScanned(false);
    try {
      const { data } = await api.get("/me/training/suggestions");
      const list = data.suggestions || [];
      setSuggestions(list);
      const seed = {};
      list.forEach(s => { seed[s.message_id] = s.suggested; });
      setSugEdits(seed);
      setScanMsg(data.message || (list.length ? "" : "No weak replies found — your AI is answering confidently."));
      setScanned(true);
    } catch { toast.error("Could not scan for weak replies"); }
    finally { setScanning(false); }
  };
  const applySuggestion = async (s) => {
    const corrected = (sugEdits[s.message_id] ?? s.suggested ?? "").trim();
    if (!corrected) { toast.error("Suggestion is empty"); return; }
    setApplyingId(s.message_id);
    try {
      await api.post("/me/training/correct", { message_id: s.message_id, session_id: s.session_id, question: s.question, original: s.original, corrected });
      toast.success("Suggestion approved — the AI will use this answer going forward");
      setSuggestions(list => list.filter(x => x.message_id !== s.message_id));
      await load();
    } catch { toast.error("Could not approve suggestion"); }
    finally { setApplyingId(null); }
  };
  const load = useCallback(async () => {
    try {
      const [t, c, a] = await Promise.all([
        api.get("/me/training/transcripts"),
        api.get("/me/training/corrections"),
        api.get("/me/training/analytics"),
      ]);
      setTranscripts(t.data.transcripts || []);
      setCorrections(c.data.corrections || []);
      setAnalytics(a.data || { total_corrections: 0, total_uses: 0, ranked: [] });
    } catch {}
  }, []);
  useEffect(() => { load(); }, [load]);
  const saveCorrection = async (t) => {
    const corrected = (edits[t.message_id] ?? "").trim();
    if (!corrected) { toast.error("Type the corrected answer first"); return; }
    setSavingId(t.message_id);
    try {
      await api.post("/me/training/correct", { message_id: t.message_id, session_id: t.session_id, question: t.question, original: t.answer, corrected });
      toast.success("Correction saved — the AI will use this answer going forward");
      setEdits(e => ({ ...e, [t.message_id]: "" }));
      await load();
    } catch { toast.error("Could not save correction"); }
    finally { setSavingId(null); }
  };
  const removeCorrection = async (id) => { await api.delete(`/me/training/corrections/${id}`); toast.success("Correction removed"); await load(); };
  return (
    <div className="space-y-6" data-testid="training-center">
      <Card title="Answer suggestions" subtitle="Let Kairo find its weakest replies and suggest a better answer you can approve in one click.">
        <div className="flex items-center gap-3 mb-4">
          <Button data-testid="scan-suggestions-btn" onClick={scanSuggestions} disabled={scanning} size="sm" className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">
            {scanning ? <Loader2 size={14} className="mr-1.5 animate-spin"/> : <Sparkles size={14} className="mr-1.5"/>}
            {scanning ? "Scanning replies…" : "Scan for weak replies"}
          </Button>
          {scanned && suggestions.length > 0 && (
            <span className="text-xs text-white/50">{suggestions.length} weak {suggestions.length === 1 ? "reply" : "replies"} found</span>
          )}
        </div>
        {scanning && (
          <p className="text-sm text-white/50">Kairo is reviewing recent conversations and drafting stronger answers…</p>
        )}
        {!scanning && scanned && suggestions.length === 0 && (
          <p className="text-sm text-[#A0AEC0]" data-testid="suggestions-empty">{scanMsg || "No weak replies found — your AI is answering confidently."}</p>
        )}
        {!scanning && suggestions.length > 0 && (
          <ul className="space-y-4" data-testid="suggestions-list">
            {suggestions.map(s => (
              <li key={s.message_id} className="bg-[#0D1117] border border-[#48BB78]/25 rounded-lg p-3" data-testid={`suggestion-${s.message_id}`}>
                {s.question && <p className="text-[12px] text-white/50 mb-1"><span className="text-white/30 font-bold uppercase tracking-widest text-[10px] mr-1">Visitor</span>{s.question}</p>}
                <p className="text-[12px] text-white/45 mb-2 line-through"><span className="text-red-300/70 font-bold uppercase tracking-widest text-[10px] mr-1 no-underline inline-block">Weak reply</span>{s.original || "(no answer)"}</p>
                <p className="text-[10px] uppercase tracking-widest text-[#48BB78] font-bold mb-1">Kairo suggests</p>
                <Textarea data-testid={`suggestion-edit-${s.message_id}`} value={sugEdits[s.message_id] ?? s.suggested} onChange={e => setSugEdits(x => ({ ...x, [s.message_id]: e.target.value }))} className="bg-[#141B24] border-[#48BB78]/30 text-white min-h-[70px] text-sm"/>
                <Button data-testid={`suggestion-apply-${s.message_id}`} onClick={() => applySuggestion(s)} disabled={applyingId === s.message_id} size="sm" className="mt-2 bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">
                  {applyingId === s.message_id ? <Loader2 size={13} className="mr-1.5 animate-spin"/> : <Check size={13} className="mr-1.5"/>}Approve suggestion
                </Button>
              </li>
            ))}
          </ul>
        )}
        {!scanned && !scanning && (
          <p className="text-sm text-[#A0AEC0]">Click “Scan for weak replies” and Kairo will surface the answers most worth improving.</p>
        )}
      </Card>
      <div className="grid sm:grid-cols-3 gap-4" data-testid="training-analytics">
        <div className="bg-[#141B24] border border-white/5 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#48BB78] mb-1">Approved answers</p>
          <p className="font-display font-black text-3xl">{analytics.total_corrections}</p>
        </div>
        <div className="bg-[#141B24] border border-white/5 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#48BB78] mb-1">Times used by AI</p>
          <p className="font-display font-black text-3xl" data-testid="training-total-uses">{analytics.total_uses}</p>
        </div>
        <div className="bg-[#141B24] border border-white/5 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#48BB78] mb-1">Top answer</p>
          <p className="text-sm text-white/80 truncate mt-1">{analytics.ranked?.[0]?.corrected || "—"}</p>
          <p className="text-xs text-white/40 mt-0.5">{analytics.ranked?.[0]?.used_count || 0} uses</p>
        </div>
      </div>
      {analytics.ranked && analytics.ranked.length > 0 && (
        <Card title="Which answers pay off" subtitle="Your approved answers ranked by how often the AI has used them.">
          <ul className="space-y-2" data-testid="analytics-ranked-list">
            {analytics.ranked.slice(0, 8).map((r, i) => (
              <li key={r.id} className="flex items-center gap-3 bg-[#0D1117] border border-white/5 rounded-lg px-3 py-2">
                <span className="text-[#48BB78] font-display font-black text-sm w-6">#{i + 1}</span>
                <div className="min-w-0 flex-1">
                  {r.question && <p className="text-[11px] text-white/40 truncate">Q: {r.question}</p>}
                  <p className="text-sm text-white truncate">{r.corrected}</p>
                </div>
                <span className="text-xs font-bold text-[#48BB78] flex-shrink-0">{r.used_count} uses</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title="Approved answers" subtitle="Corrections you've saved. The AI prefers these over its own phrasing.">
        {corrections.length === 0 ? (
          <p className="text-sm text-[#A0AEC0]">No approved answers yet. Correct a transcript below to train your bot.</p>
        ) : (
          <ul className="space-y-2" data-testid="corrections-list">
            {corrections.map(c => (
              <li key={c.id} className="bg-[#0D1117] border border-[#48BB78]/25 rounded-lg p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {c.question && <p className="text-[11px] text-white/40 mb-0.5 truncate">Q: {c.question}</p>}
                    <p className="text-sm text-white">{c.corrected}</p>
                  </div>
                  <button data-testid={`correction-remove-${c.id}`} onClick={() => removeCorrection(c.id)} className="text-red-400 hover:text-red-300 flex-shrink-0"><Trash2 size={13}/></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Review transcripts" subtitle="Read how your AI answered real visitors and correct any reply.">
        {transcripts.length === 0 ? (
          <p className="text-sm text-[#A0AEC0]">No conversations to review yet. Once visitors chat with your widget, their exchanges appear here.</p>
        ) : (
          <ul className="space-y-4" data-testid="transcripts-list">
            {transcripts.slice().reverse().map(t => (
              <li key={t.message_id} className="bg-[#0D1117] border border-white/5 rounded-lg p-3" data-testid={`transcript-${t.message_id}`}>
                {t.question && <p className="text-[12px] text-white/50 mb-1"><span className="text-white/30 font-bold uppercase tracking-widest text-[10px] mr-1">Visitor</span>{t.question}</p>}
                <p className="text-[13px] text-white mb-2"><span className="text-[#48BB78] font-bold uppercase tracking-widest text-[10px] mr-1">AI</span>{t.answer}</p>
                <Textarea data-testid={`transcript-edit-${t.message_id}`} value={edits[t.message_id] ?? ""} onChange={e => setEdits(x => ({ ...x, [t.message_id]: e.target.value }))} placeholder="Better answer the AI should give next time…" className="bg-[#141B24] border-white/10 text-white min-h-[60px] text-sm"/>
                <Button data-testid={`transcript-save-${t.message_id}`} onClick={() => saveCorrection(t)} disabled={savingId === t.message_id} size="sm" className="mt-2 bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">
                  {savingId === t.message_id ? <Loader2 size={13} className="mr-1.5 animate-spin"/> : <Check size={13} className="mr-1.5"/>}Save correction
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ============ LIVE PREVIEW SANDBOX ============
function LivePreviewSandbox({ user, colors, open, initialUrl }) {
  const normalize = (u) => {
    if (!u) return "";
    let s = u.trim();
    if (!s.startsWith("http://") && !s.startsWith("https://")) s = "https://" + s;
    return s;
  };
  const [inputUrl, setInputUrl] = useState(normalize(initialUrl || ""));
  const [loadedUrl, setLoadedUrl] = useState(normalize(initialUrl || ""));
  const [useProxy, setUseProxy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const backend = process.env.REACT_APP_BACKEND_URL;

  const iframeSrc = loadedUrl
    ? (useProxy ? `${backend}/api/preview/proxy?url=${encodeURIComponent(loadedUrl)}` : loadedUrl)
    : "";

  const goToUrl = () => {
    const u = normalize(inputUrl);
    if (!u) return;
    setLoadedUrl(u); setUseProxy(false); setLoadKey(k => k + 1); setChecking(true);
    setTimeout(() => setChecking(false), 4200);
  };
  const switchToProxy = () => { setUseProxy(true); setLoadKey(k => k + 1); };

  const demoSites = [
    { label: "example.com", url: "https://example.com" },
    { label: "wikipedia.org", url: "https://en.wikipedia.org/wiki/Chatbot" },
    { label: "vercel demo store", url: "https://demo.vercel.store" },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col" data-testid="preview-modal-canvas">
      <div className="px-4 py-2.5 border-b border-white/5 bg-[#1A202C] flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-1 mr-1">
          <span className="w-2.5 h-2.5 rounded-full bg-[#F56565]"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#ED8936]"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#48BB78]"></span>
        </div>
        <Input data-testid="preview-url-input" value={inputUrl} onChange={e => setInputUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && goToUrl()} placeholder="Paste any website URL — e.g. https://yourshop.com" className="flex-1 bg-[#0D1117] border-white/10 text-white h-9 text-sm rounded-full px-4"/>
        <Button data-testid="preview-load-btn" onClick={goToUrl} size="sm" className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-full h-9 px-4">Load</Button>
        {loadedUrl && (
          <Button data-testid="preview-proxy-btn" onClick={switchToProxy} disabled={useProxy} variant="outline" size="sm" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-9 rounded-full text-xs disabled:opacity-40">
            {useProxy ? "Proxied" : "Load via proxy"}
          </Button>
        )}
      </div>
      <div className="relative flex-1 min-h-0 bg-[#0D1117]">
        {!loadedUrl ? (
          <div className="absolute inset-0 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="w-14 h-14 rounded-2xl bg-[#48BB78]/10 border border-[#48BB78]/30 text-[#48BB78] flex items-center justify-center mx-auto mb-4"><Maximize2 size={24}/></div>
              <h3 className="font-display font-black text-2xl mb-2">Preview on any real website</h3>
              <p className="text-[#A0AEC0] text-sm mb-5">Paste a URL above — your storefront, landing page, any competitor. We'll load it here with your chat widget overlaid.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {demoSites.map(s => (
                  <button key={s.url} data-testid={`preview-demo-${s.label}`} onClick={() => { setInputUrl(s.url); setLoadedUrl(s.url); setUseProxy(false); setLoadKey(k=>k+1); setChecking(true); setTimeout(()=>setChecking(false),4200); }} className="text-xs font-bold px-3 py-2 rounded-full border border-white/10 bg-white/5 text-white hover:bg-white/10 hover:border-[#48BB78]/40">
                    Try {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <iframe key={loadKey} data-testid="preview-iframe" src={iframeSrc} title="Live preview" className="absolute inset-0 w-full h-full border-0 bg-white" sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer"/>
            {checking && !useProxy && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[#1A202C] border border-white/10 rounded-full px-4 py-1.5 text-xs text-[#A0AEC0] shadow-lg z-10">
                Loading… If nothing appears, the site blocked embedding → click <b className="text-[#48BB78]">Load via proxy</b>
              </div>
            )}
          </>
        )}
        {open && <Widget tenant={user} colors={colors} catalog={user.catalog || []}/>}
      </div>
      <div className="px-4 py-2 border-t border-white/5 bg-[#1A202C] flex items-center justify-between text-xs flex-shrink-0">
        <p className="text-[#A0AEC0]">
          {loadedUrl ? (<>Previewing: <b className="text-white">{loadedUrl}</b> {useProxy && <span className="text-[#48BB78]">(via server proxy)</span>}</>) : "Enter any URL to see your widget on a real site"}
        </p>
        <p className="text-[#48BB78] font-bold">Chat is live — try it →</p>
      </div>
    </div>
  );
}

// ================= COLOR / AVATAR PICKERS =================
function ColorPicker({ label, value, onChange, testId }) {
  const preset = ["#48BB78", "#1A202C", "#F56565", "#4299E1", "#ED8936", "#9F7AEA", "#38B2AC", "#FFFFFF"];
  return (
    <div>
      <Label className="text-[#A0AEC0]">{label}</Label>
      <div className="mt-1.5 flex items-center gap-3">
        <input data-testid={testId} type="color" value={value} onChange={e => onChange(e.target.value)} className="hide-native"/>
        <div className="font-mono text-xs text-white bg-[#0D1117] border border-white/10 px-3 py-2 rounded-md">{value}</div>
        <div className="flex gap-1.5 flex-wrap">
          {preset.map(c => (
            <button key={c} onClick={() => onChange(c)} className={`w-6 h-6 rounded-full border-2 ${value.toLowerCase() === c.toLowerCase() ? "border-[#48BB78] ring-2 ring-[#48BB78] ring-offset-2 ring-offset-[#141B24]" : "border-white/15"}`} style={{ background: c }} aria-label={c}></button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AvatarGenderPicker({ current, onChange }) {
  const [profiles, setProfiles] = useState({});
  useEffect(() => { api.get("/avatar/profiles").then(r => setProfiles(r.data)).catch(() => {}); }, []);
  return (
    <div>
      <Label className="text-[#A0AEC0]">Avatar profile (voice matched)</Label>
      <p className="text-xs text-[#A0AEC0] mb-2">Choose the on-screen persona. Voice + face matched automatically.</p>
      <div className="grid grid-cols-3 gap-3" data-testid="avatar-gender-grid">
        {Object.entries(profiles).map(([key, p]) => (
          <button key={key} data-testid={`avatar-gender-${key}`} onClick={() => onChange(key)} className={`rounded-md border-2 overflow-hidden text-left transition-colors ${current === key ? "border-[#48BB78] ring-2 ring-[#48BB78] ring-offset-2 ring-offset-[#141B24]" : "border-white/10 hover:border-white/30"}`}>
            <img src={p.image} alt={p.label} className="w-full h-24 object-cover bg-[#0D1117]"/>
            <div className="p-2 bg-[#0D1117]">
              <p className="text-white font-bold text-sm">{p.label}</p>
              <p className="text-xs text-[#48BB78]">voice: {p.voice}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const BACKGROUNDS = [
  { key: "studio_dark", label: "Studio Dark", bg: "linear-gradient(135deg,#1A202C 0%,#2D3748 100%)" },
  { key: "office", label: "Office", bg: "linear-gradient(135deg,#4A5568 0%,#2D3748 100%)" },
  { key: "clean_gradient", label: "Clean Gradient", bg: "linear-gradient(135deg,#48BB78 0%,#4299E1 100%)" },
];
function AvatarBackgroundPicker({ current, onChange }) {
  return (
    <div>
      <Label className="text-[#A0AEC0]">Avatar background scene</Label>
      <div className="grid grid-cols-3 gap-3 mt-1.5" data-testid="avatar-bg-grid">
        {BACKGROUNDS.map(b => (
          <button key={b.key} data-testid={`avatar-bg-${b.key}`} onClick={() => onChange(b.key)} className={`rounded-md border-2 overflow-hidden text-left transition-colors h-24 flex items-end p-2 ${current === b.key ? "border-[#48BB78] ring-2 ring-[#48BB78] ring-offset-2 ring-offset-[#141B24]" : "border-white/10 hover:border-white/30"}`} style={{ background: b.bg }}>
            <span className="bg-black/50 px-2 py-0.5 rounded text-xs text-white font-bold">{b.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function GoogleCalendarCard() {
  const [status, setStatus] = useState({ connected: false });
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get("/google/status").then(r => setStatus(r.data)).catch(() => {}); }, []);
  const connect = async () => {
    setBusy(true);
    try {
      const { data } = await api.get("/google/oauth/start");
      window.open(data.auth_url, "_blank", "noopener,noreferrer,width=520,height=680");
      toast.success("Complete the Google consent flow in the new tab");
      const iv = setInterval(async () => {
        const s = await api.get("/google/status");
        if (s.data.connected) { clearInterval(iv); setStatus(s.data); setBusy(false); toast.success("Google Calendar connected"); }
      }, 3000);
      setTimeout(() => { clearInterval(iv); setBusy(false); }, 120000);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Google OAuth not configured"); setBusy(false);
    }
  };
  const disconnect = async () => { await api.post("/google/oauth/disconnect"); setStatus({ connected: false }); toast.success("Disconnected"); };
  return (
    <div className="bg-[#141B24] rounded-2xl p-6 border border-white/5" data-testid="gcal-card">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-[#48BB78]/10 border border-[#48BB78]/30 text-[#48BB78] flex items-center justify-center"><CalendarClock size={18}/></div>
          <div>
            <h3 className="font-display font-bold text-lg">Google Calendar</h3>
            <p className="text-xs text-[#A0AEC0]">{status.connected ? `Connected ${status.connected_at ? "· " + new Date(status.connected_at).toLocaleDateString() : ""}` : "Bookings sync directly to your calendar when connected."}</p>
          </div>
        </div>
        {status.connected ? (
          <Button data-testid="gcal-disconnect-btn" onClick={disconnect} size="sm" variant="outline" className="border-red-500/40 bg-transparent text-red-400 hover:bg-red-500/10">Disconnect</Button>
        ) : (
          <Button data-testid="gcal-connect-btn" onClick={connect} disabled={busy} size="sm" className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold">{busy ? "Waiting..." : "Connect"}</Button>
        )}
      </div>
    </div>
  );
}

// ============ BOT CUSTOMIZATION PANEL ============
const TONES = [
  { key: "friendly", label: "Friendly", desc: "Warm & conversational" },
  { key: "professional", label: "Professional", desc: "Polished & business-like" },
  { key: "casual", label: "Casual", desc: "Relaxed & upbeat" },
  { key: "luxury", label: "Luxury", desc: "Quiet, five-star concierge" },
];

function BotCustomizationPanel({ user, updateField, refresh }) {
  const [uploading, setUploading] = useState(false);
  const uploadLogo = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Logo must be under 5MB"); return; }
    setUploading(true);
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await fetch(`${API}/me/logo`, { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("rk_token")}` }, body: fd });
      const data = await r.json();
      if (data.logo_url) { toast.success("Logo uploaded"); await refresh(); }
      else toast.error(data?.detail || "Upload failed");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };
  const removeLogo = async () => { await api.delete("/me/logo"); await refresh(); toast.success("Logo removed"); };
  const backend = process.env.REACT_APP_BACKEND_URL;
  const resolvedLogo = user.logo_url ? (user.logo_url.startsWith("http") ? user.logo_url : `${backend}${user.logo_url}`) : "";
  return (
    <div className="space-y-5">
      <Card title="Bot identity" subtitle="How your bot introduces itself">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-[#A0AEC0]">Bot name</Label>
            <Input data-testid="bot-name-input" defaultValue={user.bot_name || ""} onBlur={e => updateField("bot_name", e.target.value)} placeholder="e.g. Aria, Max, Zoe" className="mt-1.5 bg-[#0D1117] border-white/10 text-white h-11"/>
          </div>
          <div>
            <Label className="text-[#A0AEC0]">Tagline (under name)</Label>
            <Input data-testid="bot-tagline-input" defaultValue={user.bot_tagline || ""} onBlur={e => updateField("bot_tagline", e.target.value)} placeholder="e.g. Your booking concierge" className="mt-1.5 bg-[#0D1117] border-white/10 text-white h-11"/>
          </div>
        </div>
        <div className="mt-4">
          <Label className="text-[#A0AEC0]">First greeting shown to visitors</Label>
          <Input data-testid="bot-greeting-input" defaultValue={user.bot_greeting || ""} onBlur={e => updateField("bot_greeting", e.target.value)} placeholder="Hey — how can I help?" className="mt-1.5 bg-[#0D1117] border-white/10 text-white h-11"/>
        </div>
      </Card>

      <Card title="Business logo" subtitle="PNG, JPG, WEBP or SVG · Max 5MB · Shown in the chat header + emails">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-md bg-[#0D1117] border border-white/10 flex items-center justify-center overflow-hidden">
            {resolvedLogo ? <img src={resolvedLogo} alt="logo" className="w-full h-full object-contain" data-testid="current-logo"/> : <ImageIcon size={26} className="text-white/20"/>}
          </div>
          <div className="flex-1">
            <div className="flex gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-md bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white cursor-pointer">
                <Upload size={12}/> {uploading ? "Uploading..." : (resolvedLogo ? "Replace" : "Upload logo")}
                <input data-testid="logo-upload-input" type="file" accept=".png,.jpg,.jpeg,.webp,.svg" onChange={uploadLogo} className="hidden"/>
              </label>
              {resolvedLogo && (
                <button data-testid="logo-remove-btn" onClick={removeLogo} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-md border border-red-500/40 text-red-400 hover:bg-red-500/10">
                  <Trash2 size={12}/> Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title="Voice & tone" subtitle="How the bot sounds">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="bot-tone-grid">
          {TONES.map(t => {
            const active = (user.bot_tone || "friendly") === t.key;
            return (
              <button key={t.key} data-testid={`bot-tone-${t.key}`} onClick={() => updateField("bot_tone", t.key)} className={`text-left rounded-md p-3 border-2 transition-colors ${active ? "border-[#48BB78] bg-[#48BB78]/10" : "border-white/10 hover:border-white/30 bg-[#0D1117]"}`}>
                <p className="text-white font-bold text-sm">{t.label}</p>
                <p className="text-[10px] text-[#A0AEC0] mt-1 leading-tight">{t.desc}</p>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// ============ BOOKING RULES PANEL ============
const DAYS = [
  { key: "mon", label: "Mon" }, { key: "tue", label: "Tue" }, { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" }, { key: "fri", label: "Fri" }, { key: "sat", label: "Sat" }, { key: "sun", label: "Sun" },
];
const DEFAULT_HOURS = { start: "09:00", end: "17:00", enabled: true };
const DEFAULT_WEEK = {
  mon: { ...DEFAULT_HOURS }, tue: { ...DEFAULT_HOURS }, wed: { ...DEFAULT_HOURS }, thu: { ...DEFAULT_HOURS }, fri: { ...DEFAULT_HOURS },
  sat: { ...DEFAULT_HOURS, enabled: false, start: "10:00", end: "14:00" },
  sun: { ...DEFAULT_HOURS, enabled: false, start: "10:00", end: "14:00" },
};

function BookingRulesPanel({ user, updateField }) {
  const [hours, setHours] = useState(user.business_hours || DEFAULT_WEEK);
  const [duration, setDuration] = useState(user.meeting_duration || 30);
  const [zoom, setZoom] = useState(user.zoom_meeting_link || "");
  const [tz, setTz] = useState(user.business_timezone || "UTC");
  const [blocked, setBlocked] = useState(user.blocked_slots || []);
  const [recurring, setRecurring] = useState(user.recurring_blocks || []);
  const [preview, setPreview] = useState([]);
  const [newBlock, setNewBlock] = useState({ date: "", start: "09:00", end: "17:00", note: "" });
  const [newRec, setNewRec] = useState({ day: "friday", start: "17:00", end: "23:59" });

  const saveHours = async (h) => { setHours(h); await updateField("business_hours", h); };
  const saveDuration = async (d) => { setDuration(d); await updateField("meeting_duration", d); };
  const saveZoom = async (z) => { setZoom(z); await updateField("zoom_meeting_link", z); };
  const saveTz = async (t) => { setTz(t); await updateField("business_timezone", t); };
  const saveBlocked = async (b) => { setBlocked(b); await updateField("blocked_slots", b); };
  const saveRecurring = async (r) => { setRecurring(r); await updateField("recurring_blocks", r); };

  const addBlock = async () => {
    if (!newBlock.date) { toast.error("Pick a date"); return; }
    const next = [...blocked, { ...newBlock }]; await saveBlocked(next);
    setNewBlock({ date: "", start: "09:00", end: "17:00", note: "" });
    toast.success("Block added");
  };
  const removeBlock = async (i) => { const next = blocked.filter((_,idx)=>idx!==i); await saveBlocked(next); };
  const addRec = async () => { const next = [...recurring, { ...newRec }]; await saveRecurring(next); setNewRec({ day: "friday", start: "17:00", end: "23:59" }); toast.success("Recurring block added"); };
  const removeRec = async (i) => { const next = recurring.filter((_,idx)=>idx!==i); await saveRecurring(next); };

  const refreshPreview = useCallback(async () => {
    try { const r = await api.get(`/booking/available-slots?tenant_id=${user.id}&days=7`); setPreview(r.data.slots || []); } catch { setPreview([]); }
  }, [user.id]);
  useEffect(() => { refreshPreview(); }, [refreshPreview, hours, duration, blocked, recurring]);

  return (
    <div className="space-y-5">
      <Card title="Zoom meeting" subtitle="Included in the confirmation email, calendar invite, and SMS to the customer">
        <Label className="text-[#A0AEC0]">Personal Zoom link</Label>
        <Input data-testid="zoom-link-input" value={zoom} onChange={e=>setZoom(e.target.value)} onBlur={e => saveZoom(e.target.value)} placeholder="https://zoom.us/j/1234567890" className="mt-1.5 bg-[#0D1117] border-white/10 text-white h-11"/>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Meeting duration">
          <Select value={String(duration)} onValueChange={(v) => saveDuration(parseInt(v))}>
            <SelectTrigger data-testid="duration-select" className="bg-[#0D1117] border-white/10 text-white h-11"><SelectValue/></SelectTrigger>
            <SelectContent className="bg-[#2D3748] border-white/10 text-white">
              {[15, 30, 45, 60, 90].map(m => <SelectItem key={m} value={String(m)} className="focus:bg-[#48BB78]/20 focus:text-white">{m} min</SelectItem>)}
            </SelectContent>
          </Select>
        </Card>
        <Card title="Timezone">
          <Input data-testid="timezone-input" value={tz} onChange={e=>setTz(e.target.value)} onBlur={e => saveTz(e.target.value)} placeholder="UTC, America/New_York" className="bg-[#0D1117] border-white/10 text-white h-11"/>
        </Card>
      </div>
      <Card title="Weekly availability" subtitle="Set your business hours per day">
        <div className="space-y-2">
          {DAYS.map(d => {
            const conf = hours[d.key] || DEFAULT_HOURS;
            return (
              <div key={d.key} className="flex items-center gap-3 bg-[#0D1117] rounded-md px-3 py-2 border border-white/5" data-testid={`day-row-${d.key}`}>
                <label className="flex items-center gap-2 w-20 cursor-pointer">
                  <input type="checkbox" data-testid={`day-toggle-${d.key}`} checked={!!conf.enabled} onChange={(e) => saveHours({ ...hours, [d.key]: { ...conf, enabled: e.target.checked } })} className="accent-[#48BB78] w-4 h-4"/>
                  <span className="text-white font-bold text-sm">{d.label}</span>
                </label>
                <input type="time" data-testid={`day-start-${d.key}`} value={conf.start} disabled={!conf.enabled} onChange={(e) => saveHours({ ...hours, [d.key]: { ...conf, start: e.target.value } })} className="bg-[#141B24] border border-white/10 text-white text-sm rounded-md px-2 py-1.5 flex-1 disabled:opacity-40"/>
                <span className="text-[#A0AEC0] text-xs">to</span>
                <input type="time" data-testid={`day-end-${d.key}`} value={conf.end} disabled={!conf.enabled} onChange={(e) => saveHours({ ...hours, [d.key]: { ...conf, end: e.target.value } })} className="bg-[#141B24] border border-white/10 text-white text-sm rounded-md px-2 py-1.5 flex-1 disabled:opacity-40"/>
              </div>
            );
          })}
        </div>
      </Card>
      <Card title="Blocked times" subtitle="One-off date + time windows the bot must never offer">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3" data-testid="block-form">
          <input type="date" data-testid="block-date" value={newBlock.date} onChange={e => setNewBlock({...newBlock, date: e.target.value})} className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-md px-3 py-2"/>
          <input type="time" data-testid="block-start" value={newBlock.start} onChange={e => setNewBlock({...newBlock, start: e.target.value})} className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-md px-3 py-2"/>
          <input type="time" data-testid="block-end" value={newBlock.end} onChange={e => setNewBlock({...newBlock, end: e.target.value})} className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-md px-3 py-2"/>
          <Button data-testid="add-block-btn" onClick={addBlock} className="bg-[#F56565] hover:bg-[#E53E3E] text-white font-bold rounded-md h-auto"><Plus size={14} className="mr-1"/>Add</Button>
        </div>
        {blocked.length > 0 && (
          <ul className="space-y-1.5" data-testid="blocked-list">
            {blocked.map((b, i) => (
              <li key={i} className="flex items-center gap-3 bg-[#0D1117] rounded-md px-3 py-2 border border-red-500/20">
                <Ban size={12} className="text-[#F56565] flex-shrink-0"/>
                <span className="text-white text-sm font-bold">{b.date}</span>
                <span className="text-[#A0AEC0] text-xs">{b.start} - {b.end}</span>
                <button data-testid={`remove-block-${i}`} onClick={() => removeBlock(i)} className="ml-auto text-red-400 hover:text-red-300"><Trash2 size={12}/></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Recurring blocks" subtitle='e.g. "no bookings after 5pm on Fridays"'>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2" data-testid="rec-form">
          <Select value={newRec.day} onValueChange={(v) => setNewRec({...newRec, day: v})}>
            <SelectTrigger data-testid="rec-day" className="bg-[#0D1117] border-white/10 text-white text-sm h-10"><SelectValue/></SelectTrigger>
            <SelectContent className="bg-[#2D3748] border-white/10 text-white">
              {["monday","tuesday","wednesday","thursday","friday","saturday","sunday"].map(d => <SelectItem key={d} value={d} className="focus:bg-[#48BB78]/20 capitalize">{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <input type="time" data-testid="rec-start" value={newRec.start} onChange={e => setNewRec({...newRec, start: e.target.value})} className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-md px-3 py-2"/>
          <input type="time" data-testid="rec-end" value={newRec.end} onChange={e => setNewRec({...newRec, end: e.target.value})} className="bg-[#0D1117] border border-white/10 text-white text-sm rounded-md px-3 py-2"/>
          <Button data-testid="add-rec-btn" onClick={addRec} className="bg-[#ED8936] hover:bg-[#DD6B20] text-white font-bold rounded-md h-auto"><Plus size={14} className="mr-1"/>Add</Button>
        </div>
        {recurring.length > 0 && (
          <ul className="mt-3 space-y-1.5" data-testid="recurring-list">
            {recurring.map((r, i) => (
              <li key={i} className="flex items-center gap-3 bg-[#0D1117] rounded-md px-3 py-2 border border-orange-500/20">
                <Ban size={12} className="text-[#ED8936] flex-shrink-0"/>
                <span className="text-white text-sm font-bold capitalize">{r.day}</span>
                <span className="text-[#A0AEC0] text-xs">{r.start} - {r.end}</span>
                <button data-testid={`remove-rec-${i}`} onClick={() => removeRec(i)} className="ml-auto text-red-400 hover:text-red-300"><Trash2 size={12}/></button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="Bookable slots · Next 7 days">
        {preview.length === 0 ? (
          <p className="text-[#A0AEC0] text-sm">No slots available. Adjust hours or reduce blocks.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto" data-testid="slot-preview-grid">
            {preview.slice(0, 24).map((s, i) => (
              <span key={i} className="text-[10px] font-mono px-2 py-1 rounded-md bg-[#0D1117] border border-[#48BB78]/30 text-[#48BB78]">{s.label}</span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
