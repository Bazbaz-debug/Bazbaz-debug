import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Shield, UserPlus, KeyRound, PowerOff, Power, Files, LogOut, Edit3, Save, Bot, Activity, MessagesSquare, CalendarCheck, Mic, PhoneCall, Users, Video, FileText, TrendingUp, CheckCircle2, XCircle, Settings, BarChart3, Upload } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-[#1A202C] text-white relative">
      <header className="border-b border-white/5 px-6 md:px-10 py-4 flex items-center justify-between sticky top-0 bg-[#1A202C]/95 backdrop-blur z-30">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-[#48BB78] flex items-center justify-center text-[#1A202C]"><Bot size={20} strokeWidth={2.5}/></div>
          <div>
            <p className="font-display font-black text-lg leading-none">Rozio-Killer</p>
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
          <TabsList className="bg-[#2D3748] border border-white/5 rounded-md p-1 h-11 mb-6 grid grid-cols-4 max-w-xl">
            <TabsTrigger data-testid="admin-tab-overview" value="overview" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><BarChart3 size={14} className="mr-1.5"/>Overview</TabsTrigger>
            <TabsTrigger data-testid="admin-tab-clients" value="clients" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><Users size={14} className="mr-1.5"/>Clients</TabsTrigger>
            <TabsTrigger data-testid="admin-tab-activity" value="activity" className="data-[state=active]:bg-[#1A202C] data-[state=active]:text-[#48BB78] data-[state=active]:shadow-none text-[#A0AEC0]"><Activity size={14} className="mr-1.5"/>Activity</TabsTrigger>
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
                      <TableRow key={u.id} data-testid={`user-row-${u.email}`} className="border-white/5 hover:bg-white/5">
                        <TableCell>
                          <div className="text-white font-bold">{u.full_name}</div>
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
                        <TableCell className="text-right space-x-1 whitespace-nowrap">
                          <Button data-testid={`btn-metrics-${u.email}`} onClick={() => openMetrics(u)} size="sm" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-8 px-2" title="Metrics"><TrendingUp size={12}/></Button>
                          <Button data-testid={`btn-files-${u.email}`} onClick={() => openFiles(u)} size="sm" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-8 px-2" title="Files"><Files size={12}/></Button>
                          <Button data-testid={`btn-instr-${u.email}`} onClick={() => setInstructionEdit(u)} size="sm" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-8 px-2" title="Edit Instruction"><Edit3 size={12}/></Button>
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

          {/* SYSTEM */}
          <TabsContent value="settings" className="space-y-6">
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

function HealthCard({ ok, label, detail, testId }) {
  return (
    <div data-testid={testId} className={`rounded-md p-3 border flex items-start gap-2 ${ok ? "bg-[#48BB78]/5 border-[#48BB78]/30" : "bg-red-500/5 border-red-500/30"}`}>
      {ok ? <CheckCircle2 className="text-[#48BB78] mt-0.5 flex-shrink-0" size={16}/> : <XCircle className="text-red-400 mt-0.5 flex-shrink-0" size={16}/>}
      <div>
        <p className="text-white text-sm font-bold">{label}</p>
        <p className="text-xs text-[#A0AEC0]">{detail}</p>
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
