import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload, LogOut, Sparkles, CalendarDays, Palette, Book, TrendingUp, Bot, Link2, FileText, Shield, Copy, Check, Maximize2, Code2, CalendarClock, Layers } from "lucide-react";
import api, { API } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Widget from "@/components/Widget";
import MetricsBar from "@/components/MetricsBar";
import MouseGradient from "@/components/MouseGradient";
import ParticleCanvas from "@/components/ParticleCanvas";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
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
  const [files, setFiles] = useState([]);
  const [crawlUrl, setCrawlUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedDates, setSelectedDates] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const loadFiles = useCallback(() => {
    api.get("/knowledge/files").then(r => setFiles(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadFiles();
    if (user?.crawled_url) setCrawlUrl(user.crawled_url);
    if (user?.active_slots) setSelectedDates(user.active_slots.map(s => new Date(s)));
  }, [user, loadFiles]);

  const updateField = async (field, value) => {
    await api.put("/me/profile", { [field]: value });
    await refresh();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0] || e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { toast.error("Only PDF files"); return; }
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
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
      toast.success(`Synced ${data.products.length} products + delivery windows`);
      await refresh();
    } catch { toast.error("Crawl failed"); }
    finally { setBusy(false); }
  };

  const toggleSlot = async (date) => {
    const iso = date.toISOString().slice(0, 10);
    const exists = selectedDates.find(d => d.toISOString().slice(0,10) === iso);
    const next = exists ? selectedDates.filter(d => d.toISOString().slice(0,10) !== iso) : [...selectedDates, date];
    setSelectedDates(next);
    await updateField("active_slots", next.map(d => d.toISOString()));
  };

  if (!user) return null;

  const colors = {
    widget_bg: user.widget_bg || "#1A202C",
    bubble_color: user.bubble_color || "#48BB78",
    accent_color: user.accent_color || "#48BB78",
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#1A202C] text-white">
      {/* LEFT PANE - CONFIG */}
      <div className="w-full lg:w-[52%] lg:max-w-2xl overflow-y-auto px-6 py-6 md:px-10 md:py-10 border-r border-white/5">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-md bg-[#48BB78] flex items-center justify-center text-[#1A202C]"><Bot size={20} strokeWidth={2.5}/></div>
            <div>
              <p className="font-display font-black text-lg leading-none">Rozio-Killer</p>
              <p className="text-xs text-[#A0AEC0] mt-0.5">{user.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {user.role === "admin" && (
              <Button data-testid="dashboard-admin-btn" onClick={() => nav("/admin")} variant="outline" size="sm" className="border-[#48BB78]/40 text-[#48BB78] bg-transparent hover:bg-[#48BB78]/10"><Shield size={14} className="mr-1"/> Admin</Button>
            )}
            <Button data-testid="dashboard-logout-btn" onClick={() => { logout(); nav("/"); }} variant="outline" size="sm" className="border-white/10 bg-transparent text-white hover:bg-white/5"><LogOut size={14} className="mr-1"/> Logout</Button>
          </div>
        </div>

        <p className="uppercase text-xs tracking-[0.3em] font-bold text-[#48BB78] mb-2">Client Configuration</p>
        <h1 className="font-display font-black text-4xl tracking-tight mb-6">Widget console.</h1>

        <MetricsBar />

        <div className="mb-6 flex flex-wrap gap-2">
          <Button data-testid="open-preview-btn" onClick={() => setPreviewOpen(true)} className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md neon-glow-hover">
            <Maximize2 size={14} className="mr-2"/> Open Live Preview
          </Button>
          <Button data-testid="open-setup-btn" onClick={() => nav("/setup")} variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5">
            <Code2 size={14} className="mr-2"/> Install Guides
          </Button>
        </div>

        <Tabs defaultValue="knowledge" className="w-full">
          <TabsList className="bg-[#2D3748] border border-white/5 rounded-md p-1 h-11 mb-6 w-full grid grid-cols-3">
            <TabsTrigger data-testid="tab-knowledge" value="knowledge" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><Book size={14} className="mr-1.5"/>Knowledge</TabsTrigger>
            <TabsTrigger data-testid="tab-branding" value="branding" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><Palette size={14} className="mr-1.5"/>Branding</TabsTrigger>
            <TabsTrigger data-testid="tab-matrix" value="matrix" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><CalendarDays size={14} className="mr-1.5"/>Matrix</TabsTrigger>
          </TabsList>

          {/* TAB 1: KNOWLEDGE */}
          <TabsContent value="knowledge" className="space-y-6">
            <div>
              <Label className="text-[#A0AEC0]">Industry</Label>
              <Select value={user.industry || "General Website"} onValueChange={(v) => updateField("industry", v)}>
                <SelectTrigger data-testid="industry-select" className="mt-1.5 bg-[#2D3748] border-white/10 text-white h-11"><SelectValue/></SelectTrigger>
                <SelectContent className="bg-[#2D3748] border-white/10 text-white">
                  {INDUSTRIES.map(i => <SelectItem key={i} value={i} className="focus:bg-[#48BB78]/20 focus:text-white">{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#A0AEC0]">Custom instruction</Label>
              <Textarea data-testid="instruction-textarea" defaultValue={user.custom_instruction || ""} onBlur={e => updateField("custom_instruction", e.target.value)} placeholder={industryPrompts[user.industry || "General Website"]} className="mt-1.5 bg-[#2D3748] border-white/10 text-white min-h-[100px]"/>
              <p className="text-xs text-[#A0AEC0] mt-1.5">Saved on blur. The AI avatar uses this to answer visitors.</p>
            </div>
            <div>
              <Label className="text-[#A0AEC0]">Website crawl / catalog sync</Label>
              <div className="flex gap-2 mt-1.5">
                <Input data-testid="crawl-url-input" value={crawlUrl} onChange={e => setCrawlUrl(e.target.value)} placeholder="https://yourshop.com/products" className="bg-[#2D3748] border-white/10 text-white h-11"/>
                <Button data-testid="crawl-btn" onClick={doCrawl} disabled={busy} className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold h-11 rounded-md"><Link2 size={14} className="mr-1.5"/> Sync</Button>
              </div>
              {user.catalog?.length > 0 && (
                <div data-testid="catalog-preview" className="mt-3 grid grid-cols-3 gap-2">
                  {user.catalog.map((p, i) => (
                    <div key={i} className="bg-[#2D3748] rounded-md p-2 border border-white/5 text-xs">
                      <p className="text-white font-bold truncate">{p.name}</p>
                      <p className="text-[#48BB78]">{p.price}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-[#A0AEC0]">PDF upload</Label>
              <label onDrop={handleDrop} onDragOver={e => e.preventDefault()} className="mt-1.5 border-2 border-dashed border-white/10 hover:border-[#48BB78]/50 rounded-md p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-[#2D3748]/50">
                <Upload size={22} className="text-[#48BB78] mb-2"/>
                <p className="text-sm text-white font-bold">Drop PDF or click to upload</p>
                <p className="text-xs text-[#A0AEC0] mt-1">Stored in Emergent Object Storage</p>
                <input data-testid="pdf-upload-input" type="file" accept=".pdf" onChange={handleDrop} className="hidden"/>
              </label>
              {files.length > 0 && (
                <ul data-testid="files-list" className="mt-3 space-y-1">
                  {files.map(f => (
                    <li key={f.id} className="flex items-center gap-2 text-sm text-[#A0AEC0] bg-[#2D3748] px-3 py-2 rounded-md border border-white/5">
                      <FileText size={14} className="text-[#48BB78]"/> {f.original_filename} <span className="ml-auto text-xs">{(f.size/1024).toFixed(1)} KB</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: BRANDING */}
          <TabsContent value="branding" className="space-y-6">
            <p className="text-[#A0AEC0] text-sm">Live preview updates in the sandbox on the right &rarr;</p>
            <AvatarGenderPicker current={user.avatar_gender || "female"} onChange={v => updateField("avatar_gender", v)}/>
            <AvatarBackgroundPicker current={user.avatar_background || "studio_dark"} onChange={v => updateField("avatar_background", v)}/>
            <ColorPicker testId="color-widget-bg" label="Widget background" value={colors.widget_bg} onChange={v => updateField("widget_bg", v)}/>
            <ColorPicker testId="color-bubble" label="Bubble color" value={colors.bubble_color} onChange={v => updateField("bubble_color", v)}/>
            <ColorPicker testId="color-accent" label="Button / accent color" value={colors.accent_color} onChange={v => updateField("accent_color", v)}/>
            <EmbedScript userId={user.id}/>
          </TabsContent>

          {/* TAB 3: MATRIX */}
          <TabsContent value="matrix" className="space-y-6">
            <GoogleCalendarCard/>
            <div className="bg-[#2D3748] rounded-md p-5 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="uppercase text-xs tracking-[0.3em] font-bold text-[#48BB78]">Spending Analytics</p>
                  <h3 className="font-display text-2xl font-bold">{user.spending_points || 0} pts</h3>
                </div>
                <TrendingUp size={30} className="text-[#48BB78]"/>
              </div>
              <p className="text-xs text-[#A0AEC0]">Automated credit card supplier spending points &mdash; funding your marketing budget.</p>
              <div className="mt-3 flex gap-2">
                <Button data-testid="spending-add-btn" onClick={() => updateField("spending_points", (user.spending_points || 0) + 50)} size="sm" className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">+50 credit spend</Button>
              </div>
            </div>
            <div>
              <Label className="text-[#A0AEC0]">Available booking slots</Label>
              <p className="text-xs text-[#A0AEC0] mb-2">Click dates to toggle bookable slots. Visitors can book any active date via the AI widget.</p>
              <div data-testid="calendar-grid" className="bg-[#2D3748] rounded-md p-3 border border-white/5 inline-block">
                <Calendar mode="multiple" selected={selectedDates} onSelect={(dates) => { setSelectedDates(dates || []); updateField("active_slots", (dates||[]).map(d => d.toISOString())); }} className="text-white"/>
              </div>
              <p className="text-xs text-[#48BB78] mt-2">{selectedDates.length} active slot(s)</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* RIGHT PANE - SANDBOX */}
      <div className="hidden lg:flex flex-1 h-screen sticky top-0 bg-[#0D1117] items-center justify-center relative dot-grid noise overflow-hidden">
        <MouseGradient color={colors.accent_color} intensity={0.12} />
        <ParticleCanvas color={colors.accent_color} density={45}/>
        <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
          <span className="w-2 h-2 rounded-full pulse-dot" style={{ background: colors.accent_color }}></span>
          <span className="uppercase text-xs tracking-[0.3em] font-bold text-[#48BB78]">Interactive Sandbox</span>
        </div>
        {/* Fake site preview */}
        <div className="w-[85%] max-w-lg bg-[#1A202C] border border-white/10 rounded-lg p-8 opacity-80">
          <div className="h-2 w-24 rounded bg-white/10 mb-4"></div>
          <div className="h-8 w-3/4 rounded bg-white/10 mb-4"></div>
          <div className="h-3 w-full rounded bg-white/5 mb-2"></div>
          <div className="h-3 w-5/6 rounded bg-white/5 mb-2"></div>
          <div className="h-3 w-2/3 rounded bg-white/5 mb-6"></div>
          <div className="flex gap-2">
            <div className="h-24 w-1/2 rounded bg-white/5"></div>
            <div className="h-24 w-1/2 rounded bg-white/5"></div>
          </div>
        </div>
        <Widget tenant={user} colors={colors} catalog={user.catalog || []}/>
      </div>

      {/* Live Preview Modal (full-screen sandbox) */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="bg-[#0D1117] border-white/10 text-white max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="px-6 py-3 border-b border-white/10 flex-shrink-0">
            <DialogTitle className="font-display text-xl">Live Preview &mdash; publish-ready sandbox</DialogTitle>
          </DialogHeader>
          <div className="relative flex-1 min-h-0 dot-grid noise overflow-hidden" data-testid="preview-modal-canvas">
            <MouseGradient color={colors.accent_color} intensity={0.18} />
            <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
              <div className="w-full max-w-2xl bg-[#1A202C] border border-white/10 rounded-lg p-8 opacity-90">
                <div className="h-2 w-24 rounded bg-white/10 mb-4"></div>
                <div className="h-10 w-3/4 rounded bg-white/10 mb-6"></div>
                <div className="h-4 w-full rounded bg-white/5 mb-2"></div>
                <div className="h-4 w-5/6 rounded bg-white/5 mb-2"></div>
                <div className="h-4 w-4/6 rounded bg-white/5 mb-6"></div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-32 rounded bg-white/5"></div>
                  <div className="h-32 rounded bg-white/5"></div>
                  <div className="h-32 rounded bg-white/5"></div>
                </div>
              </div>
            </div>
            {previewOpen && <Widget tenant={user} colors={colors} catalog={user.catalog || []}/>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ColorPicker({ label, value, onChange, testId }) {
  const preset = ["#48BB78", "#1A202C", "#F56565", "#4299E1", "#ED8936", "#9F7AEA", "#38B2AC", "#FFFFFF"];
  return (
    <div>
      <Label className="text-[#A0AEC0]">{label}</Label>
      <div className="mt-1.5 flex items-center gap-3">
        <input data-testid={testId} type="color" value={value} onChange={e => onChange(e.target.value)} className="hide-native"/>
        <div className="font-mono text-xs text-white bg-[#2D3748] border border-white/10 px-3 py-2 rounded-md">{value}</div>
        <div className="flex gap-1.5 flex-wrap">
          {preset.map(c => (
            <button key={c} onClick={() => onChange(c)} className={`w-6 h-6 rounded-full border-2 ${value.toLowerCase() === c.toLowerCase() ? "border-[#48BB78] ring-2 ring-[#48BB78] ring-offset-2 ring-offset-[#1A202C]" : "border-white/15"}`} style={{ background: c }} aria-label={c}></button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AvatarGenderPicker({ current, onChange }) {
  const [profiles, setProfiles] = useState({});
  useEffect(() => {
    api.get("/avatar/profiles").then(r => setProfiles(r.data)).catch(() => {});
  }, []);
  return (
    <div>
      <Label className="text-[#A0AEC0]">Avatar profile (voice matched)</Label>
      <p className="text-xs text-[#A0AEC0] mb-2">Choose the on-screen persona. Voice + face are matched automatically.</p>
      <div className="grid grid-cols-3 gap-3" data-testid="avatar-gender-grid">
        {Object.entries(profiles).map(([key, p]) => (
          <button
            key={key}
            data-testid={`avatar-gender-${key}`}
            onClick={() => onChange(key)}
            className={`rounded-md border-2 overflow-hidden text-left transition-colors ${current === key ? "border-[#48BB78] ring-2 ring-[#48BB78] ring-offset-2 ring-offset-[#1A202C]" : "border-white/10 hover:border-white/30"}`}
          >
            <img src={p.image} alt={p.label} className="w-full h-24 object-cover bg-[#2D3748]"/>
            <div className="p-2 bg-[#2D3748]">
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
      <p className="text-xs text-[#A0AEC0] mb-2">Backdrop behind the AI persona in the live widget.</p>
      <div className="grid grid-cols-3 gap-3" data-testid="avatar-bg-grid">
        {BACKGROUNDS.map(b => (
          <button key={b.key} data-testid={`avatar-bg-${b.key}`} onClick={() => onChange(b.key)}
            className={`rounded-md border-2 overflow-hidden text-left transition-colors h-24 flex items-end p-2 ${current === b.key ? "border-[#48BB78] ring-2 ring-[#48BB78] ring-offset-2 ring-offset-[#1A202C]" : "border-white/10 hover:border-white/30"}`}
            style={{ background: b.bg }}>
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
      // Poll status
      const iv = setInterval(async () => {
        const s = await api.get("/google/status");
        if (s.data.connected) { clearInterval(iv); setStatus(s.data); setBusy(false); toast.success("Google Calendar connected"); }
      }, 3000);
      setTimeout(() => { clearInterval(iv); setBusy(false); }, 120000);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Google OAuth not configured");
      setBusy(false);
    }
  };
  const disconnect = async () => { await api.post("/google/oauth/disconnect"); setStatus({ connected: false }); toast.success("Disconnected"); };
  return (
    <div className="bg-[#2D3748] rounded-md p-5 border border-white/5" data-testid="gcal-card">
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

function EmbedScript({ userId }) {
  const [copied, setCopied] = useState(false);
  const backend = process.env.REACT_APP_BACKEND_URL;
  const snippet = `<script async src="${backend}/api/embed/${userId}/loader.js"></script>`;
  const copy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success("Embed script copied");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="bg-[#2D3748] rounded-md border border-[#48BB78]/30 p-5 mt-2">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-[#48BB78]"/>
        <p className="uppercase text-xs tracking-[0.3em] font-bold text-[#48BB78]">Deploy &middot; One-line embed</p>
      </div>
      <p className="text-sm text-[#A0AEC0] mb-3">Paste this into your Shopify theme, WordPress header, or any HTML page. Colors sync live from above.</p>
      <div className="bg-[#1A202C] border border-white/10 rounded-md p-3 font-mono text-xs text-[#48BB78] break-all" data-testid="embed-snippet">{snippet}</div>
      <button data-testid="embed-copy-btn" onClick={copy} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-md bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white">
        {copied ? <Check size={12}/> : <Copy size={12}/>} {copied ? "Copied" : "Copy snippet"}
      </button>
    </div>
  );
}
