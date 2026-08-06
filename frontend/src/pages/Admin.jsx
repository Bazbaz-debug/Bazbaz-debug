import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { KairoMark } from "@/components/KairoLogo";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Shield, UserPlus, KeyRound, PowerOff, Power, Files, LogOut, Edit3, Save, Bot, Activity, MessagesSquare, CalendarCheck, Mic, PhoneCall, Users, Video, FileText, TrendingUp, CheckCircle2, XCircle, Settings, BarChart3, Upload, Sliders, Globe, Mail, Video as VideoIcon, Phone, Eye, ScrollText, Search, Sparkles, Trash2, Clock, Inbox, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import MouseGradient from "@/components/MouseGradient";

const GENDER_LABEL = { male: "Male", female: "Female", neutral: "Neutral" };

export default function Admin() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [users, setUsers] = useState([]);
  const [uploadPolicy, setUploadPolicyState] = useState("client_self_serve");
  const [stats, setStats] = useState({});
  const [health, setHealth] = useState({});
  const [activity, setActivity] = useState({ bookings: [], calls: [] });
  const [creating, setCreating] = useState({ email: "", full_name: "", target_domain: "", industry: "General Website" });
  const [genResult, setGenResult] = useState(null);
  const [instructionEdit, setInstructionEdit] = useState(null);
  const [filesModal, setFilesModal] = useState(null);
  const [metricsModal, setMetricsModal] = useState(null);
  const [manageModal, setManageModal] = useState(null); // full client edit
  const [manageForm, setManageForm] = useState({});
  const [manageSaving, setManageSaving] = useState(false);
  const [manageFiles, setManageFiles] = useState([]);
  const [audit, setAudit] = useState([]);
  const [auditQ, setAuditQ] = useState("");

  const loadAudit = useCallback(async (q = "") => {
    try { const { data } = await api.get(`/admin/audit${q ? `?q=${encodeURIComponent(q)}` : ""}`); setAudit(data.logs || []); } catch {}
  }, []);

  const load = useCallback(async () => {
    const [s, u, st, h, act] = await Promise.all([
      api.get("/settings/public"),
      api.get("/admin/users"),
      api.get("/admin/stats"),
      api.get("/admin/health"),
      api.get("/admin/activity"),
    ]);
    setSignupEnabled(s.data.public_signup_enabled);
    setUploadPolicyState(s.data.upload_policy || "client_self_serve");
    setUsers(u.data);
    setStats(st.data);
    setHealth(h.data);
    setActivity(act.data);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  useEffect(() => { loadAudit(); }, [loadAudit]);

  const viewAs = async (u) => {
    try {
      const { data } = await api.post(`/admin/impersonate/${u.id}`);
      localStorage.setItem("rk_admin_token", localStorage.getItem("rk_token"));
      localStorage.setItem("rk_token", data.token);
      toast.success(`Entering ${u.email}'s workspace`);
      window.location.href = "/dashboard";
    } catch (e) { toast.error(e?.response?.data?.detail || "View As failed"); }
  };

  const toggleSignup = async (v) => { setSignupEnabled(v); await api.put("/admin/settings", { public_signup_enabled: v }); toast.success(`Public signup ${v ? "enabled" : "disabled"}`); };
  const setUploadPolicy = async (v) => { setUploadPolicyState(v); await api.put("/admin/settings", { upload_policy: v }); toast.success(`Upload policy: ${v === "admin_only" ? "Admin only" : "Client self-serve"}`); };

  const createAccount = async () => {
    try {
      const { data } = await api.post("/admin/users/create", creating);
      setGenResult(data);
      setCreating({ email: "", full_name: "", target_domain: "", industry: "General Website" });
      load();
      toast.success("Account created");
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const deactivate = async (id, active) => { active ? await api.post(`/admin/users/${id}/deactivate`) : await api.post(`/admin/users/${id}/activate`); load(); toast.success(active ? "Deactivated - live script broken" : "Re-activated"); };
  const sendForgot = async (id) => { await api.post(`/admin/users/${id}/forgot`); toast.success("Forgot-password email dispatched"); };
  const saveInstruction = async () => { await api.put(`/admin/users/${instructionEdit.id}/instruction`, { user_id: instructionEdit.id, custom_instruction: instructionEdit.custom_instruction }); setInstructionEdit(null); load(); toast.success("Instruction override saved"); };
  const openFiles = async (u) => { const { data } = await api.get(`/admin/users/${u.id}/files`); setFilesModal({ user: u, files: data }); };
  const openMetrics = async (u) => { const { data } = await api.get(`/admin/users/${u.id}/metrics`); setMetricsModal({ user: u, m: data }); };
  const openManage = async (u) => {
    try {
      const [{ data: full }, { data: files }] = await Promise.all([
        api.get(`/admin/users/${u.id}`),
        api.get(`/admin/users/${u.id}/files`),
      ]);
      setManageModal(full);
      setManageForm({
        full_name: full.full_name || "",
        target_domain: full.target_domain || "",
        industry: full.industry || "General Website",
        custom_instruction: full.custom_instruction || "",
        crawled_url: full.crawled_url || "",
        notification_email: full.notification_email || "",
        business_owner_phone: full.business_owner_phone || "",
        google_email: full.google_email || "",
        zoom_meeting_link: full.zoom_meeting_link || "",
        custom_smtp_host: full.custom_smtp_host || "",
        custom_smtp_user: full.custom_smtp_user || "",
        custom_smtp_pass: full.custom_smtp_pass || "",
        custom_smtp_from: full.custom_smtp_from || "",
        resend_api_key: full.resend_api_key || "",
        google_api_key: full.google_api_key || "",
      });
      setManageFiles(files || []);
    } catch (e) { toast.error("Failed to load client"); }
  };
  const saveManage = async () => {
    if (!manageModal) return;
    setManageSaving(true);
    try {
      await api.put(`/admin/users/${manageModal.id}`, manageForm);
      toast.success("Client updated");
      load();
      setManageModal(null);
    } catch (e) { toast.error(e?.response?.data?.detail || "Save failed"); }
    finally { setManageSaving(false); }
  };
  const reloadManageFiles = async () => {
    if (!manageModal) return;
    const { data } = await api.get(`/admin/users/${manageModal.id}/files`);
    setManageFiles(data || []);
  };

  return (
    <div className="min-h-screen bg-[#1A202C] text-white relative">
      <header className="border-b border-white/5 px-6 md:px-10 py-4 flex items-center justify-between sticky top-0 bg-[#1A202C]/95 backdrop-blur z-30">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-[#48BB78] flex items-center justify-center text-[#1A202C]"><KairoMark size={22}/></div>
          <div>
            <p className="font-display font-black text-lg leading-none">Kairo</p>
            <p className="text-xs text-[#48BB78] mt-0.5 uppercase tracking-[0.2em] font-bold flex items-center gap-1"><Shield size={10}/> Admin Control Center</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button data-testid="admin-goto-dashboard" onClick={() => nav("/dashboard")} variant="outline" size="sm" className="border-white/10 bg-transparent text-white hover:bg-white/5">Dashboard</Button>
          <Button data-testid="admin-logout" onClick={() => { logout(); nav("/"); }} variant="outline" size="sm" className="border-white/10 bg-transparent text-white hover:bg-white/5"><LogOut size={14} className="mr-1"/> Logout</Button>
        </div>
      </header>

      <div className="px-6 md:px-10 py-8 space-y-8 relative">
        <MouseGradient color="#48BB78" intensity={0.06}/>
        <div className="relative z-10">
          <p className="uppercase text-xs tracking-[0.3em] font-bold text-[#48BB78] mb-2">Super-User Control Center</p>
          <h1 className="font-display font-black text-4xl tracking-tight">Command &amp; conquer.</h1>
        </div>

        {/* GLOBAL STATS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 relative z-10" data-testid="admin-stats-row">
          <Stat icon={<Users size={14}/>} label="Clients" v={`${stats.active_clients || 0}/${stats.total_clients || 0}`}/>
          <Stat icon={<MessagesSquare size={14}/>} label="Chats" v={stats.total_chats || 0}/>
          <Stat icon={<CalendarCheck size={14}/>} label="Bookings (7d)" v={stats.bookings_week || 0}/>
          <Stat icon={<Mic size={14}/>} label="Voice min" v={stats.voice_minutes || 0}/>
          <Stat icon={<Video size={14}/>} label="Videos" v={stats.videos_generated || 0}/>
          <Stat icon={<PhoneCall size={14}/>} label="Calls" v={`${stats.live_calls || 0}/${stats.total_calls || 0}`}/>
        </div>

        <Tabs defaultValue="overview" className="relative z-10">
          <TabsList className="bg-[#2D3748] border border-white/5 rounded-md p-1 h-11 mb-6 grid grid-cols-5 max-w-2xl">
            <TabsTrigger data-testid="admin-tab-overview" value="overview" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><BarChart3 size={14} className="mr-1.5"/>Overview</TabsTrigger>
            <TabsTrigger data-testid="admin-tab-clients" value="clients" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><Users size={14} className="mr-1.5"/>Clients</TabsTrigger>
            <TabsTrigger data-testid="admin-tab-activity" value="activity" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><Activity size={14} className="mr-1.5"/>Activity</TabsTrigger>
            <TabsTrigger data-testid="admin-tab-audit" value="audit" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><ScrollText size={14} className="mr-1.5"/>Audit</TabsTrigger>
            <TabsTrigger data-testid="admin-tab-waitlist" value="waitlist" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><Inbox size={14} className="mr-1.5"/>Waitlist</TabsTrigger>
            <TabsTrigger data-testid="admin-tab-reservations" value="reservations" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><ClipboardList size={14} className="mr-1.5"/>Reservations</TabsTrigger>
            <TabsTrigger data-testid="admin-tab-settings" value="settings" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><Settings size={14} className="mr-1.5"/>System</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            {/* INTEGRATION HEALTH */}
            <div className="bg-[#2D3748] border border-white/5 rounded-md p-6">
              <h3 className="font-display font-bold text-lg mb-4">Integration Health</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <HealthCard testId="health-llm" ok={health.emergent_llm} label="Emergent LLM (GPT 5.6 Terra)" detail={health.emergent_llm ? "Connected" : "Missing key"}/>
                <HealthCard testId="health-resend" ok={health.resend} label="Resend Emails" detail={health.resend ? "Sending live" : "Missing key"}/>
                <HealthCard testId="health-ses" ok={health.ses} label="Amazon SES" detail={health.ses ? "Preferred sender" : "Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, SES_FROM_EMAIL"}/>
                <HealthCard testId="health-telnyx" ok={health.telnyx_can_call} label="Telnyx Voice + SMS" detail={health.telnyx_can_call ? `From ${health.telnyx_phone}` : health.telnyx_configured ? "Key set - need TELNYX_PHONE_NUMBER" : "Not configured"}/>
                <HealthCard testId="health-twilio" ok={health.twilio_can_call} label="Twilio (fallback)" detail={health.twilio_can_call ? `From ${health.twilio_from}` : health.twilio_configured ? "Need TWILIO_PHONE_NUMBER" : "Not configured"}/>
                <HealthCard testId="health-google" ok={health.google_oauth} label="Google Calendar OAuth" detail={health.google_oauth ? "OAuth ready" : "Set GOOGLE_CLIENT_ID / SECRET"}/>
                <HealthCard testId="health-fal" ok={health.fal_configured} label="Fal.ai Lip-Sync" detail={health.fal_configured ? "Key set (verify balance)" : "Missing FAL_KEY"}/>
                <HealthCard testId="health-storage" ok={health.object_storage} label="Emergent Object Storage" detail={health.object_storage ? "Initialized" : "Init failed"}/>
              </div>
            </div>

            {/* PLATFORM CONFIG */}
            <div className="bg-[#2D3748] rounded-md p-6 border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg mb-1">Toggle Public Signup Page</h3>
                  <p className="text-sm text-[#A0AEC0]">When OFF, landing hides public registration &mdash; access only via manual login.</p>
                </div>
                <Switch data-testid="admin-signup-toggle" checked={signupEnabled} onCheckedChange={toggleSignup}/>
              </div>
              <div className="flex items-center justify-between border-t border-white/5 pt-4">
                <div>
                  <h3 className="font-display font-bold text-lg mb-1">File Upload Policy</h3>
                  <p className="text-sm text-[#A0AEC0]">Who can upload knowledge base files. Admin-Only lets you gatekeep every tenant&apos;s files.</p>
                </div>
                <div className="flex gap-2" data-testid="upload-policy-group">
                  <button data-testid="upload-policy-client" onClick={() => setUploadPolicy("client_self_serve")} className={`px-3 py-2 rounded-md text-xs font-bold ${uploadPolicy === "client_self_serve" ? "bg-[#48BB78] text-[#1A202C]" : "bg-[#1A202C] text-[#A0AEC0] border border-white/10"}`}>Client self-serve</button>
                  <button data-testid="upload-policy-admin" onClick={() => setUploadPolicy("admin_only")} className={`px-3 py-2 rounded-md text-xs font-bold ${uploadPolicy === "admin_only" ? "bg-[#48BB78] text-[#1A202C]" : "bg-[#1A202C] text-[#A0AEC0] border border-white/10"}`}>Admin only</button>
                </div>
              </div>
            </div>

            {/* MANUAL ACCOUNT CREATOR */}
            <div className="bg-[#2D3748] rounded-md p-6 border border-white/5">
              <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2"><UserPlus size={18} className="text-[#48BB78]"/> Manual Account Creator</h3>
              <div className="grid md:grid-cols-4 gap-3">
                <Input data-testid="admin-create-name" placeholder="Full name" value={creating.full_name} onChange={e => setCreating({...creating, full_name: e.target.value})} className="bg-[#1A202C] border-white/10 text-white h-11"/>
                <Input data-testid="admin-create-email" placeholder="client@company.com" value={creating.email} onChange={e => setCreating({...creating, email: e.target.value})} className="bg-[#1A202C] border-white/10 text-white h-11"/>
                <Input data-testid="admin-create-domain" placeholder="https://client.com" value={creating.target_domain} onChange={e => setCreating({...creating, target_domain: e.target.value})} className="bg-[#1A202C] border-white/10 text-white h-11"/>
                <Button data-testid="admin-create-btn" onClick={createAccount} className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold h-11 rounded-md">Generate credentials</Button>
              </div>
              {genResult && (
                <div data-testid="admin-generated-creds" className="mt-4 bg-[#1A202C] border border-[#48BB78]/40 rounded-md p-4">
                  <p className="text-xs uppercase text-[#48BB78] font-bold tracking-[0.2em] mb-2">Credentials generated &mdash; distribute securely</p>
                  <p className="font-mono text-sm">Email: <span className="text-white">{genResult.email}</span></p>
                  <p className="font-mono text-sm">Password: <span className="text-[#48BB78]">{genResult.temporary_password}</span></p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* CLIENTS TABLE */}
          <TabsContent value="clients">
            <div className="bg-[#2D3748] rounded-md border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-display font-bold text-lg">Client Database ({users.length})</h3>
                <p className="text-xs text-[#A0AEC0]">Auto-refreshing every 10s</p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-[#A0AEC0]">Client</TableHead>
                      <TableHead className="text-[#A0AEC0]">Industry</TableHead>
                      <TableHead className="text-[#A0AEC0]">Domain</TableHead>
                      <TableHead className="text-[#A0AEC0]">Avatar</TableHead>
                      <TableHead className="text-[#A0AEC0]">Colors</TableHead>
                      <TableHead className="text-[#A0AEC0]">Status</TableHead>
                      <TableHead className="text-[#A0AEC0] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.id} data-testid={`user-row-${u.email}`} onClick={() => openManage(u)} className="border-white/5 hover:bg-white/5 cursor-pointer">
                        <TableCell>
                          <div className="text-white font-bold hover:text-[#48BB78] transition-colors">{u.full_name}</div>
                          <div className="text-xs text-[#A0AEC0]">{u.email}</div>
                        </TableCell>
                        <TableCell className="text-[#A0AEC0] text-xs">{u.industry || "-"}</TableCell>
                        <TableCell className="text-[#A0AEC0] text-xs max-w-[180px] truncate">{u.target_domain || "-"}</TableCell>
                        <TableCell><span className="text-xs bg-[#1A202C] border border-white/10 rounded px-2 py-0.5 text-[#48BB78]">{GENDER_LABEL[u.avatar_gender] || "Female"}</span></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <span className="w-4 h-4 rounded-full border border-white/20" style={{ background: u.widget_bg }}></span>
                            <span className="w-4 h-4 rounded-full border border-white/20" style={{ background: u.bubble_color }}></span>
                            <span className="w-4 h-4 rounded-full border border-white/20" style={{ background: u.accent_color }}></span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs font-bold px-2 py-1 rounded ${u.active ? "bg-[#48BB78]/15 text-[#48BB78]" : "bg-red-500/15 text-red-400"}`}>{u.active ? "ACTIVE" : "DEACTIVATED"}</span>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="text-right space-x-1 whitespace-nowrap">
                          <Button data-testid={`btn-viewas-${u.email}`} onClick={() => viewAs(u)} size="sm" variant="outline" className="border-[#ED8936]/50 text-[#ED8936] bg-transparent hover:bg-[#ED8936]/10 h-8 px-2" title="View As this client"><Eye size={12}/></Button>
                          <Button data-testid={`btn-manage-${u.email}`} onClick={() => openManage(u)} size="sm" className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold h-8 px-3" title="Manage client"><Sliders size={12} className="mr-1"/>Manage</Button>
                          <Button data-testid={`btn-metrics-${u.email}`} onClick={() => openMetrics(u)} size="sm" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-8 px-2" title="Metrics"><TrendingUp size={12}/></Button>
                          <Button data-testid={`btn-forgot-${u.email}`} onClick={() => sendForgot(u.id)} size="sm" variant="outline" className="border-[#48BB78]/40 text-[#48BB78] bg-transparent hover:bg-[#48BB78]/10 h-8 px-2" title="Send Reset"><KeyRound size={12}/></Button>
                          <Button data-testid={`btn-toggle-${u.email}`} onClick={() => deactivate(u.id, u.active)} size="sm" variant="outline" className={`h-8 px-2 bg-transparent ${u.active ? "border-red-500/40 text-red-400 hover:bg-red-500/10" : "border-[#48BB78]/40 text-[#48BB78] hover:bg-[#48BB78]/10"}`} title={u.active ? "Deactivate" : "Activate"}>
                            {u.active ? <PowerOff size={12}/> : <Power size={12}/>}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </TabsContent>

          {/* ACTIVITY */}
          <TabsContent value="activity" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-[#2D3748] rounded-md border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center gap-2"><CalendarCheck size={16} className="text-[#48BB78]"/><h3 className="font-display font-bold">Recent Bookings</h3></div>
                <ul data-testid="activity-bookings" className="divide-y divide-white/5">
                  {activity.bookings.length === 0 && <li className="p-4 text-sm text-[#A0AEC0]">No bookings yet.</li>}
                  {activity.bookings.map(b => (
                    <li key={b.id} className="p-4 flex items-start justify-between">
                      <div>
                        <p className="text-white text-sm font-bold">{b.slot}</p>
                        <p className="text-xs text-[#A0AEC0]">Tenant: {b.tenant_email} &middot; Customer: {b.customer_email}</p>
                      </div>
                      <span className="text-xs text-[#48BB78] font-mono">{new Date(b.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#2D3748] rounded-md border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5 flex items-center gap-2"><PhoneCall size={16} className="text-[#48BB78]"/><h3 className="font-display font-bold">Escalation Calls</h3></div>
                <ul data-testid="activity-calls" className="divide-y divide-white/5">
                  {activity.calls.length === 0 && <li className="p-4 text-sm text-[#A0AEC0]">No escalations yet.</li>}
                  {activity.calls.map(c => (
                    <li key={c.id} className="p-4 flex items-start justify-between">
                      <div>
                        <p className="text-white text-sm font-bold">{c.target || "-"}</p>
                        <p className="text-xs text-[#A0AEC0]">Tenant: {c.tenant_email} &middot; Status: <span className={c.status === "live_call_placed" ? "text-[#48BB78]" : "text-yellow-400"}>{c.status}</span></p>
                        {c.sid && <p className="text-[10px] font-mono text-[#A0AEC0]">SID: {c.sid.slice(0,20)}...</p>}
                      </div>
                      <span className="text-xs text-[#48BB78] font-mono">{new Date(c.created_at).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </TabsContent>

          {/* AUDIT */}
          <TabsContent value="audit" className="space-y-6">
            <div className="bg-[#2D3748] rounded-md border border-white/5 overflow-hidden">
              <div className="p-4 border-b border-white/5 flex items-center justify-between gap-3">
                <h3 className="font-display font-bold text-lg">Audit Log</h3>
                <div className="flex items-center gap-2 flex-1 max-w-sm">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A0AEC0]"/>
                    <Input data-testid="audit-search-input" value={auditQ} onChange={e => setAuditQ(e.target.value)} onKeyDown={e => e.key === "Enter" && loadAudit(auditQ)} placeholder="Search actor, action, target…" className="bg-[#1A202C] border-white/10 text-white h-9 pl-9 text-sm"/>
                  </div>
                  <Button data-testid="audit-search-btn" onClick={() => loadAudit(auditQ)} size="sm" className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold h-9">Search</Button>
                </div>
              </div>
              <div className="max-h-[560px] overflow-y-auto" data-testid="audit-list">
                {audit.length === 0 ? (
                  <p className="p-6 text-sm text-[#A0AEC0] text-center">No audit events found.</p>
                ) : (
                  <ul className="divide-y divide-white/5">
                    {audit.map(a => (
                      <li key={a.id} className="px-4 py-3 flex items-center gap-3" data-testid={`audit-row-${a.id}`}>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-[#48BB78]/15 text-[#48BB78] flex-shrink-0">{a.action}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm truncate">
                            <span className="font-bold">{a.actor_email || "system"}</span>
                            {a.impersonated_by && <span className="text-[#ED8936] text-xs ml-1">(impersonation)</span>}
                            {a.target && <span className="text-[#A0AEC0]"> → {a.target}</span>}
                          </p>
                          {a.meta && Object.keys(a.meta).length > 0 && <p className="text-[11px] text-[#A0AEC0] truncate">{JSON.stringify(a.meta)}</p>}
                        </div>
                        <span className="text-[11px] text-white/40 flex-shrink-0">{a.created_at ? new Date(a.created_at).toLocaleString() : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </TabsContent>

          {/* SYSTEM */}
          <TabsContent value="waitlist" className="space-y-6">
            <WaitlistTab />
          </TabsContent>

          <TabsContent value="reservations" className="space-y-6">
            <ReservationsTab />
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <PlatformKeysCard onSaved={load} />
            <div className="bg-[#2D3748] rounded-md p-6 border border-white/5">
              <h3 className="font-display font-bold text-lg mb-4">Env / Credentials Reference</h3>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                <EnvRow k="EMERGENT_LLM_KEY" ok={health.emergent_llm}/>
                <EnvRow k="RESEND_API_KEY" ok={health.resend}/>
                <EnvRow k="TWILIO_ACCOUNT_SID + AUTH_TOKEN" ok={health.twilio_configured}/>
                <EnvRow k="TWILIO_PHONE_NUMBER" ok={!!health.twilio_from} hint="Needed to place real calls"/>
                <EnvRow k="ESCALATION_TARGET_PHONE" ok={!!health.escalation_target}/>
                <EnvRow k="FAL_KEY" ok={health.fal_configured} hint="Top up balance at fal.ai/dashboard/billing"/>
              </div>
              <p className="text-xs text-[#A0AEC0] mt-4">Edit these in <code className="bg-[#1A202C] px-1.5 py-0.5 rounded text-[#48BB78]">/app/backend/.env</code> then restart the backend.</p>
            </div>
            <div className="bg-[#2D3748] rounded-md p-6 border border-white/5">
              <h3 className="font-display font-bold text-lg mb-1">Aggregate Storage</h3>
              <p className="text-sm text-[#A0AEC0] mb-3">Files uploaded across all tenants via Emergent Object Storage.</p>
              <p className="text-3xl font-display font-black">{stats.total_files || 0} <span className="text-[#48BB78] text-base">files</span></p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* INSTRUCTION EDIT MODAL */}
      <Dialog open={!!instructionEdit} onOpenChange={(v) => !v && setInstructionEdit(null)}>
        <DialogContent className="bg-[#1A202C] border-white/10 text-white">
          <DialogHeader><DialogTitle>Override Instruction &mdash; {instructionEdit?.email}</DialogTitle></DialogHeader>
          <Textarea data-testid="admin-instruction-textarea" value={instructionEdit?.custom_instruction || ""} onChange={e => setInstructionEdit({...instructionEdit, custom_instruction: e.target.value})} className="min-h-[160px] bg-[#2D3748] border-white/10 text-white"/>
          <DialogFooter>
            <Button data-testid="admin-instruction-save" onClick={saveInstruction} className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md"><Save size={14} className="mr-1.5"/> Save override</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FILES MODAL */}
      <Dialog open={!!filesModal} onOpenChange={(v) => !v && setFilesModal(null)}>
        <DialogContent className="bg-[#1A202C] border-white/10 text-white max-w-lg">
          <DialogHeader><DialogTitle>Files &mdash; {filesModal?.user?.email}</DialogTitle></DialogHeader>
          <label className="border-2 border-dashed border-white/10 hover:border-[#48BB78]/50 rounded-md p-4 flex items-center justify-center cursor-pointer transition-colors bg-[#2D3748]/50 mb-3" data-testid="admin-files-upload-zone">
            <input data-testid="admin-files-upload-input" type="file" accept=".pdf" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file || !filesModal) return;
              const fd = new FormData(); fd.append("file", file);
              try {
                await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/users/${filesModal.user.id}/files/upload`, {
                  method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("rk_token")}` }, body: fd,
                });
                const { data } = await api.get(`/admin/users/${filesModal.user.id}/files`);
                setFilesModal({ ...filesModal, files: data });
                toast.success("File uploaded for tenant");
              } catch { toast.error("Upload failed"); }
            }}/>
            <span className="text-sm text-[#A0AEC0] inline-flex items-center gap-2"><Upload size={14} className="text-[#48BB78]"/> Upload PDF on behalf of tenant</span>
          </label>
          {filesModal?.files?.length ? (
            <ul className="space-y-2 max-h-64 overflow-y-auto">
              {filesModal.files.map(f => (
                <li key={f.id} className="bg-[#2D3748] px-3 py-2 rounded-md border border-white/5 text-sm flex justify-between items-center">
                  <span className="inline-flex items-center gap-2"><FileText size={14} className="text-[#48BB78]"/>{f.original_filename}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[#A0AEC0] text-xs">{(f.size/1024).toFixed(1)} KB</span>
                    <button data-testid={`admin-file-delete-${f.id}`} onClick={async () => {
                      await api.delete(`/admin/files/${f.id}`);
                      const { data } = await api.get(`/admin/users/${filesModal.user.id}/files`);
                      setFilesModal({ ...filesModal, files: data });
                      toast.success("File deleted");
                    }} className="text-red-400 hover:text-red-300 text-xs font-bold">Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="text-[#A0AEC0] text-sm">No files uploaded.</p>}
        </DialogContent>
      </Dialog>

      {/* MANAGE CLIENT MODAL (comprehensive) */}
      <Dialog open={!!manageModal} onOpenChange={(v) => !v && setManageModal(null)}>
        <DialogContent className="bg-[#1A202C] border-white/10 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sliders size={18} className="text-[#48BB78]"/>
              Manage &mdash; {manageModal?.full_name}
              <span className="text-xs text-[#A0AEC0] font-normal ml-1">{manageModal?.email}</span>
            </DialogTitle>
          </DialogHeader>
          {manageModal && (
            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="bg-[#2D3748] border border-white/5 rounded-md p-1 h-10 grid grid-cols-4 mb-4">
                <TabsTrigger data-testid="mg-tab-profile" value="profile" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] text-[#A0AEC0] text-xs"><Bot size={12} className="mr-1"/>Profile</TabsTrigger>
                <TabsTrigger data-testid="mg-tab-content" value="content" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] text-[#A0AEC0] text-xs"><Globe size={12} className="mr-1"/>Website &amp; Files</TabsTrigger>
                <TabsTrigger data-testid="mg-tab-integrations" value="integrations" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] text-[#A0AEC0] text-xs"><KeyRound size={12} className="mr-1"/>Integrations</TabsTrigger>
                <TabsTrigger data-testid="mg-tab-metrics" value="metrics" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] text-[#A0AEC0] text-xs"><TrendingUp size={12} className="mr-1"/>Metrics</TabsTrigger>
              </TabsList>

              {/* PROFILE */}
              <TabsContent value="profile" className="space-y-4">
                <FieldRow label="Full Name">
                  <Input data-testid="mg-full_name" value={manageForm.full_name} onChange={e => setManageForm({...manageForm, full_name: e.target.value})} className="bg-[#2D3748] border-white/10 text-white"/>
                </FieldRow>
                <FieldRow label="Industry">
                  <Input data-testid="mg-industry" value={manageForm.industry} onChange={e => setManageForm({...manageForm, industry: e.target.value})} className="bg-[#2D3748] border-white/10 text-white" placeholder="e.g. E-Commerce, SaaS, Local Service"/>
                </FieldRow>
                <FieldRow label="Custom AI Instruction" hint="Overrides the AI concierge's business context.">
                  <Textarea data-testid="mg-custom_instruction" value={manageForm.custom_instruction} onChange={e => setManageForm({...manageForm, custom_instruction: e.target.value})} className="min-h-[110px] bg-[#2D3748] border-white/10 text-white"/>
                </FieldRow>
              </TabsContent>

              {/* CONTENT & FILES */}
              <TabsContent value="content" className="space-y-4">
                <FieldRow label="Target Website / Domain" hint="The URL where the widget is embedded.">
                  <Input data-testid="mg-target_domain" value={manageForm.target_domain} onChange={e => setManageForm({...manageForm, target_domain: e.target.value})} className="bg-[#2D3748] border-white/10 text-white" placeholder="https://client-site.com"/>
                </FieldRow>
                <FieldRow label="Crawled Catalog URL" hint="Used by the AI to reference real products/services.">
                  <Input data-testid="mg-crawled_url" value={manageForm.crawled_url} onChange={e => setManageForm({...manageForm, crawled_url: e.target.value})} className="bg-[#2D3748] border-white/10 text-white" placeholder="https://client-site.com/products"/>
                </FieldRow>
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-[#48BB78] font-bold mb-2">Knowledge Files (PDF)</p>
                  <label className="border-2 border-dashed border-white/10 hover:border-[#48BB78]/50 rounded-md p-4 flex items-center justify-center cursor-pointer transition-colors bg-[#2D3748]/50 mb-3" data-testid="mg-upload-zone">
                    <input data-testid="mg-upload-input" type="file" accept=".pdf" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file || !manageModal) return;
                      const fd = new FormData(); fd.append("file", file);
                      try {
                        const r = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/admin/users/${manageModal.id}/files/upload`, {
                          method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("rk_token")}` }, body: fd,
                        });
                        if (!r.ok) throw new Error();
                        await reloadManageFiles();
                        toast.success("File uploaded");
                      } catch { toast.error("Upload failed"); }
                    }}/>
                    <span className="text-sm text-[#A0AEC0] inline-flex items-center gap-2"><Upload size={14} className="text-[#48BB78]"/> Click to upload a PDF for this client</span>
                  </label>
                  {manageFiles.length ? (
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {manageFiles.map(f => (
                        <li key={f.id} className="bg-[#2D3748] px-3 py-2 rounded-md border border-white/5 text-sm flex justify-between items-center">
                          <span className="inline-flex items-center gap-2 truncate"><FileText size={14} className="text-[#48BB78] flex-shrink-0"/><span className="truncate">{f.original_filename}</span></span>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[#A0AEC0] text-xs">{(f.size/1024).toFixed(1)} KB</span>
                            <button data-testid={`mg-file-delete-${f.id}`} onClick={async () => { await api.delete(`/admin/files/${f.id}`); await reloadManageFiles(); toast.success("Deleted"); }} className="text-red-400 hover:text-red-300 text-xs font-bold">Delete</button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-[#A0AEC0] text-sm">No files uploaded yet.</p>}
                </div>
              </TabsContent>

              {/* INTEGRATIONS */}
              <TabsContent value="integrations" className="space-y-4">
                <SectionHeader icon={<Mail size={14}/>} title="Email & Notifications"/>
                <FieldRow label="Notification Email" hint="CC address for new bookings & escalations.">
                  <Input data-testid="mg-notification_email" value={manageForm.notification_email} onChange={e => setManageForm({...manageForm, notification_email: e.target.value})} className="bg-[#2D3748] border-white/10 text-white" placeholder="ops@client.com"/>
                </FieldRow>
                <FieldRow label="Resend API Key (per-client override)" hint="Overrides the platform key for this client's emails.">
                  <Input data-testid="mg-resend_api_key" type="password" value={manageForm.resend_api_key} onChange={e => setManageForm({...manageForm, resend_api_key: e.target.value})} className="bg-[#2D3748] border-white/10 text-white font-mono" placeholder="re_..."/>
                </FieldRow>
                <FieldRow label="Custom SMTP (From)" hint="Optional: send from client's own domain">
                  <Input data-testid="mg-smtp_from" value={manageForm.custom_smtp_from} onChange={e => setManageForm({...manageForm, custom_smtp_from: e.target.value})} className="bg-[#2D3748] border-white/10 text-white" placeholder="hello@client.com"/>
                </FieldRow>
                <div className="grid grid-cols-3 gap-2">
                  <Input data-testid="mg-smtp_host" value={manageForm.custom_smtp_host} onChange={e => setManageForm({...manageForm, custom_smtp_host: e.target.value})} className="bg-[#2D3748] border-white/10 text-white" placeholder="SMTP host"/>
                  <Input data-testid="mg-smtp_user" value={manageForm.custom_smtp_user} onChange={e => setManageForm({...manageForm, custom_smtp_user: e.target.value})} className="bg-[#2D3748] border-white/10 text-white" placeholder="SMTP user"/>
                  <Input data-testid="mg-smtp_pass" type="password" value={manageForm.custom_smtp_pass} onChange={e => setManageForm({...manageForm, custom_smtp_pass: e.target.value})} className="bg-[#2D3748] border-white/10 text-white" placeholder="SMTP password"/>
                </div>

                <SectionHeader icon={<CalendarCheck size={14}/>} title="Google Calendar"/>
                <FieldRow label="Google Email" hint="The Google account tied to the calendar OAuth link.">
                  <Input data-testid="mg-google_email" value={manageForm.google_email} onChange={e => setManageForm({...manageForm, google_email: e.target.value})} className="bg-[#2D3748] border-white/10 text-white" placeholder="client@gmail.com"/>
                </FieldRow>
                <FieldRow label="Google API Key (optional)">
                  <Input data-testid="mg-google_api_key" type="password" value={manageForm.google_api_key} onChange={e => setManageForm({...manageForm, google_api_key: e.target.value})} className="bg-[#2D3748] border-white/10 text-white font-mono" placeholder="AIza..."/>
                </FieldRow>

                <SectionHeader icon={<VideoIcon size={14}/>} title="Video Meeting"/>
                <FieldRow label="Zoom Meeting Link" hint="Shared by the AI when confirming a booking / video call.">
                  <Input data-testid="mg-zoom_meeting_link" value={manageForm.zoom_meeting_link} onChange={e => setManageForm({...manageForm, zoom_meeting_link: e.target.value})} className="bg-[#2D3748] border-white/10 text-white" placeholder="https://zoom.us/j/1234567890"/>
                </FieldRow>

                <SectionHeader icon={<Phone size={14}/>} title="Voice / SMS"/>
                <FieldRow label="Business Owner Phone" hint="Where escalation calls & SMS lead alerts are sent.">
                  <Input data-testid="mg-business_owner_phone" value={manageForm.business_owner_phone} onChange={e => setManageForm({...manageForm, business_owner_phone: e.target.value})} className="bg-[#2D3748] border-white/10 text-white" placeholder="+15551234567"/>
                </FieldRow>
              </TabsContent>

              {/* METRICS */}
              <TabsContent value="metrics" className="space-y-4">
                <ClientMetrics userId={manageModal.id}/>
              </TabsContent>
            </Tabs>
          )}
          <DialogFooter className="mt-4 gap-2 sm:gap-2">
            <Button data-testid="mg-cancel" onClick={() => setManageModal(null)} variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5">Cancel</Button>
            <Button data-testid="mg-save" onClick={saveManage} disabled={manageSaving} className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold">
              <Save size={14} className="mr-1.5"/>{manageSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* METRICS MODAL */}
      <Dialog open={!!metricsModal} onOpenChange={(v) => !v && setMetricsModal(null)}>
        <DialogContent className="bg-[#1A202C] border-white/10 text-white">
          <DialogHeader><DialogTitle>Metrics &mdash; {metricsModal?.user?.email}</DialogTitle></DialogHeader>
          {metricsModal && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Stat icon={<MessagesSquare size={14}/>} label="Chats" v={metricsModal.m.chats}/>
              <Stat icon={<CalendarCheck size={14}/>} label="Bookings" v={metricsModal.m.bookings}/>
              <Stat icon={<PhoneCall size={14}/>} label="Escalations" v={metricsModal.m.escalations}/>
              <Stat icon={<Mic size={14}/>} label="Voice sec" v={metricsModal.m.voice_seconds}/>
              <Stat icon={<Video size={14}/>} label="Videos" v={metricsModal.m.videos}/>
              <Stat icon={<PhoneCall size={14}/>} label="Calls" v={metricsModal.m.calls}/>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon, label, v }) {
  return (
    <div className="bg-[#2D3748] border border-white/5 rounded-md p-3">
      <div className="flex items-center gap-1.5 text-[#48BB78] text-[10px] uppercase font-bold tracking-[0.15em] mb-1">{icon}<span>{label}</span></div>
      <div className="font-display font-black text-2xl tracking-tighter">{v}</div>
    </div>
  );
}

const CAT_ICONS = { mail: Mail, calendar: CalendarCheck, "message-square": MessagesSquare, phone: Phone, sparkles: Sparkles };

function PlatformKeysCard({ onSaved }) {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({});          // fieldKey -> input value
  const [configured, setConfigured] = useState({}); // fieldKey -> bool
  const [saving, setSaving] = useState(false);
  const hydrate = useCallback(async () => {
    try {
      const r = await api.get("/admin/platform-keys");
      const cats = r.data.categories || [];
      setCategories(cats);
      const f = {}; const c = {};
      cats.forEach(cat => cat.fields.forEach(fl => {
        // plain fields prefilled with actual value; secrets start empty (masked shown as placeholder)
        f[fl.key] = fl.secret ? "" : (fl.value || "");
        c[fl.key] = fl.configured;
      }));
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
        if (fl.secret) { if (v) values[fl.key] = v; }   // only send secrets when typed
        else { values[fl.key] = v; }                     // always send plain (allows clearing)
      }));
      await api.put("/admin/platform-keys", { values });
      toast.success("Platform keys saved");
      await hydrate();
      onSaved && onSaved();
    } catch { toast.error("Could not save keys"); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-[#2D3748] rounded-md p-6 border border-white/5" data-testid="platform-keys-card">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-display font-bold text-lg flex items-center gap-2"><KeyRound size={16} className="text-[#48BB78]"/> Platform Keys</h3>
      </div>
      <p className="text-sm text-[#A0AEC0] mb-5">All your integration keys in one place — email, calendar, messaging, voice & chat. Secrets are encrypted before storage and shown masked. Leave a secret blank to keep the current value.</p>
      <div className="space-y-6">
        {categories.map(cat => {
          const Icon = CAT_ICONS[cat.icon] || KeyRound;
          return (
            <div key={cat.category} data-testid={`pk-cat-${cat.category}`}>
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/5">
                <Icon size={15} className="text-[#48BB78]"/>
                <h4 className="font-display font-bold text-sm text-white">{cat.label}</h4>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                {cat.fields.map(fl => (
                  <div key={fl.key}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] text-[#A0AEC0] font-bold uppercase tracking-widest">{fl.label}</label>
                      {fl.secret && configured[fl.key] && (
                        <span data-testid={`pk-configured-${fl.key}`} className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-[#48BB78] text-[#0D1117]"><CheckCircle2 size={9} strokeWidth={3}/> {fl.value || "Set"}</span>
                      )}
                    </div>
                    <Input
                      data-testid={`pk-input-${fl.key}`}
                      type={fl.secret ? "password" : "text"}
                      value={form[fl.key] ?? ""}
                      onChange={e => setForm(s => ({ ...s, [fl.key]: e.target.value }))}
                      placeholder={fl.secret && configured[fl.key] ? "•••• enter new to replace" : fl.placeholder}
                      className={`bg-[#1A202C] border-white/10 text-white h-10 mt-0.5 text-sm ${fl.secret ? "font-mono text-xs" : ""}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <Button data-testid="platform-keys-save" onClick={save} disabled={saving} className="mt-6 bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">
        {saving ? "Saving…" : "Save all keys"}
      </Button>
      <p className="text-[11px] text-[#A0AEC0] mt-3">Get a free Resend key at <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-[#48BB78] link-underline">resend.com/api-keys</a>. Once the Resend key + verified sender are saved, signup & booking emails send live.</p>
    </div>
  );
}

function WaitlistTab() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get("/admin/waitlist"); setEntries(r.data.entries || []); }
    catch { setEntries([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const remove = async (id) => { try { await api.delete(`/admin/waitlist/${id}`); toast.success("Removed"); await load(); } catch { toast.error("Could not remove"); } };
  const exportCsv = () => {
    const rows = [["email", "name", "source", "created_at"], ...entries.map(e => [e.email, e.name, e.source, e.created_at])];
    const csv = rows.map(r => r.map(c => `"${(c || "").toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url; a.download = "kairo-waitlist.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <div className="bg-[#2D3748] rounded-md p-6 border border-white/5" data-testid="waitlist-tab">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-lg flex items-center gap-2"><Inbox size={16} className="text-[#48BB78]"/> Launch Waitlist</h3>
          <p className="text-sm text-[#A0AEC0]">Emails captured from the landing page.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-display font-black" data-testid="waitlist-count">{entries.length}</span>
          <Button data-testid="waitlist-export" onClick={exportCsv} disabled={!entries.length} size="sm" variant="outline" className="border-white/15 text-white/80 rounded-md">Export CSV</Button>
        </div>
      </div>
      {loading ? <p className="text-sm text-[#A0AEC0]">Loading…</p> : entries.length === 0 ? (
        <p className="text-sm text-[#A0AEC0]">No signups yet. Visitors who join from the landing page appear here.</p>
      ) : (
        <ul className="space-y-2" data-testid="waitlist-list">
          {entries.map(e => (
            <li key={e.id} className="flex items-center justify-between gap-3 bg-[#1A202C] border border-white/5 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm text-white truncate">{e.email}{e.name ? <span className="text-white/40"> · {e.name}</span> : null}</p>
                <p className="text-[11px] text-white/35">{e.source} · {new Date(e.created_at).toLocaleString()}</p>
              </div>
              <button data-testid={`waitlist-remove-${e.id}`} onClick={() => remove(e.id)} className="text-red-400 hover:text-red-300 flex-shrink-0"><Trash2 size={14}/></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReservationsTab() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get("/admin/reservations").then(r => setItems(r.data.reservations || [])).catch(() => setItems([])).finally(() => setLoading(false));
  }, []);
  return (
    <div className="bg-[#2D3748] rounded-md p-6 border border-white/5" data-testid="reservations-tab">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-lg flex items-center gap-2"><Clock size={16} className="text-[#48BB78]"/> Slot Reservations</h3>
          <p className="text-sm text-[#A0AEC0]">Time slots visitors picked on the landing calendar before heading to Upwork.</p>
        </div>
        <span className="text-2xl font-display font-black" data-testid="reservations-count">{items.length}</span>
      </div>
      {loading ? <p className="text-sm text-[#A0AEC0]">Loading…</p> : items.length === 0 ? (
        <p className="text-sm text-[#A0AEC0]">No reservations yet.</p>
      ) : (
        <ul className="space-y-2" data-testid="reservations-list">
          {items.map(r => (
            <li key={r.id} className="bg-[#1A202C] border border-white/5 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white truncate">{r.email}{r.name ? <span className="text-white/40"> · {r.name}</span> : null}</p>
                <span className="text-[10px] uppercase tracking-widest font-bold text-[#48BB78] flex-shrink-0">{r.status}</span>
              </div>
              <p className="text-[12px] text-white/60 mt-0.5">{r.slot_label || r.slot_iso}</p>
              <p className="text-[11px] text-white/30">{new Date(r.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function HealthCard({ ok, label, detail, testId }) {
  return (
    <div data-testid={testId} className={`rounded-md p-3 border flex items-start gap-2 ${ok ? "bg-[#48BB78]/5 border-[#48BB78]/30" : "bg-red-500/5 border-red-500/30"}`}>
      {ok ? <CheckCircle2 className="text-[#48BB78] mt-0.5 flex-shrink-0" size={16}/> : <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16}/>}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white text-sm font-bold">{label}</p>
          {ok && (
            <span data-testid={`${testId}-connected-badge`} className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#48BB78] text-[#0D1117] shadow-[0_0_12px_rgba(72,187,120,0.5)]">
              <CheckCircle2 size={10} strokeWidth={3}/> Connected
            </span>
          )}
        </div>
        <p className="text-xs text-[#A0AEC0] mt-0.5">{detail}</p>
      </div>
    </div>
  );
}

function EnvRow({ k, ok, hint }) {
  return (
    <div className="flex items-center gap-3 bg-[#1A202C] px-3 py-2 rounded border border-white/5">
      {ok ? <CheckCircle2 className="text-[#48BB78]" size={14}/> : <XCircle className="text-red-400" size={14}/>}
      <div className="flex-1 min-w-0">
        <code className="text-xs text-white font-mono block truncate">{k}</code>
        {hint && <p className="text-[10px] text-[#A0AEC0] mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function FieldRow({ label, hint, children }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-[0.15em] text-[#48BB78] font-bold mb-1.5 block">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-[#A0AEC0] mt-1">{hint}</p>}
    </div>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 pt-2 border-t border-white/5 -mx-1 px-1">
      <span className="text-[#48BB78]">{icon}</span>
      <h4 className="font-display font-bold text-sm text-white">{title}</h4>
    </div>
  );
}

function ClientMetrics({ userId }) {
  const [m, setM] = useState(null);
  useEffect(() => { api.get(`/admin/users/${userId}/metrics`).then(r => setM(r.data)).catch(() => setM({})); }, [userId]);
  if (!m) return <p className="text-sm text-[#A0AEC0]">Loading...</p>;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      <Stat icon={<MessagesSquare size={14}/>} label="Chats" v={m.chats || 0}/>
      <Stat icon={<CalendarCheck size={14}/>} label="Bookings" v={m.bookings || 0}/>
      <Stat icon={<PhoneCall size={14}/>} label="Escalations" v={m.escalations || 0}/>
      <Stat icon={<Mic size={14}/>} label="Voice sec" v={m.voice_seconds || 0}/>
      <Stat icon={<Video size={14}/>} label="Videos" v={m.videos || 0}/>
      <Stat icon={<PhoneCall size={14}/>} label="Calls" v={m.calls || 0}/>
    </div>
  );
}
