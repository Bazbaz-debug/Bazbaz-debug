import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Shield, UserPlus, KeyRound, PowerOff, Power, Files, LogOut, Edit3, Save, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export default function Admin() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [signupEnabled, setSignupEnabled] = useState(true);
  const [users, setUsers] = useState([]);
  const [creating, setCreating] = useState({ email: "", full_name: "", target_domain: "", industry: "General Website" });
  const [genResult, setGenResult] = useState(null);
  const [instructionEdit, setInstructionEdit] = useState(null);
  const [filesModal, setFilesModal] = useState(null);

  const load = useCallback(async () => {
    const [s, u] = await Promise.all([api.get("/settings/public"), api.get("/admin/users")]);
    setSignupEnabled(s.data.public_signup_enabled);
    setUsers(u.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleSignup = async (v) => {
    setSignupEnabled(v);
    await api.put("/admin/settings", { public_signup_enabled: v });
    toast.success(`Public signup ${v ? "enabled" : "disabled"}`);
  };

  const createAccount = async () => {
    try {
      const { data } = await api.post("/admin/users/create", creating);
      setGenResult(data);
      setCreating({ email: "", full_name: "", target_domain: "", industry: "General Website" });
      load();
      toast.success("Account created");
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const deactivate = async (id, currentlyActive) => {
    if (currentlyActive) await api.post(`/admin/users/${id}/deactivate`);
    else await api.post(`/admin/users/${id}/activate`);
    load();
    toast.success(currentlyActive ? "Account deactivated - live script broken" : "Account re-activated");
  };

  const sendForgot = async (id) => {
    await api.post(`/admin/users/${id}/forgot`);
    toast.success("Forgot-password email dispatched");
  };

  const saveInstruction = async () => {
    await api.put(`/admin/users/${instructionEdit.id}/instruction`, { user_id: instructionEdit.id, custom_instruction: instructionEdit.custom_instruction });
    setInstructionEdit(null);
    load();
    toast.success("Instruction override saved");
  };

  const openFiles = async (u) => {
    const { data } = await api.get(`/admin/users/${u.id}/files`);
    setFilesModal({ user: u, files: data });
  };

  return (
    <div className="min-h-screen bg-[#1A202C] text-white">
      <header className="border-b border-white/5 px-6 md:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-[#48BB78] flex items-center justify-center text-[#1A202C]"><Bot size={20} strokeWidth={2.5}/></div>
          <div>
            <p className="font-display font-black text-lg leading-none">Rozio-Killer</p>
            <p className="text-xs text-[#48BB78] mt-0.5 uppercase tracking-[0.2em] font-bold flex items-center gap-1"><Shield size={10}/> Admin</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button data-testid="admin-goto-dashboard" onClick={() => nav("/dashboard")} variant="outline" size="sm" className="border-white/10 bg-transparent text-white hover:bg-white/5">Dashboard</Button>
          <Button data-testid="admin-logout" onClick={() => { logout(); nav("/"); }} variant="outline" size="sm" className="border-white/10 bg-transparent text-white hover:bg-white/5"><LogOut size={14} className="mr-1"/> Logout</Button>
        </div>
      </header>

      <div className="px-6 md:px-10 py-8 space-y-8">
        <div>
          <p className="uppercase text-xs tracking-[0.3em] font-bold text-[#48BB78] mb-2">Super-User Control Center</p>
          <h1 className="font-display font-black text-4xl tracking-tight">Command &amp; conquer.</h1>
        </div>

        {/* PUBLIC SIGNUP TOGGLE */}
        <div className="bg-[#2D3748] rounded-md p-6 border border-white/5 flex items-center justify-between">
          <div>
            <h3 className="font-display font-bold text-lg mb-1">Toggle Public Signup Page</h3>
            <p className="text-sm text-[#A0AEC0]">When OFF, the landing page hides public registration &mdash; access only via manual login.</p>
          </div>
          <Switch data-testid="admin-signup-toggle" checked={signupEnabled} onCheckedChange={toggleSignup}/>
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

        {/* USERS TABLE */}
        <div className="bg-[#2D3748] rounded-md border border-white/5 overflow-hidden">
          <div className="p-4 border-b border-white/5"><h3 className="font-display font-bold text-lg">Client Database ({users.length})</h3></div>
          <Table>
            <TableHeader>
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="text-[#A0AEC0]">Client</TableHead>
                <TableHead className="text-[#A0AEC0]">Industry</TableHead>
                <TableHead className="text-[#A0AEC0]">Domain</TableHead>
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
                  <TableCell className="text-[#A0AEC0]">{u.industry || "-"}</TableCell>
                  <TableCell className="text-[#A0AEC0] text-xs">{u.target_domain || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <span className="w-4 h-4 rounded-full border border-white/20" style={{ background: u.widget_bg }} title="bg"></span>
                      <span className="w-4 h-4 rounded-full border border-white/20" style={{ background: u.bubble_color }} title="bubble"></span>
                      <span className="w-4 h-4 rounded-full border border-white/20" style={{ background: u.accent_color }} title="accent"></span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${u.active ? "bg-[#48BB78]/15 text-[#48BB78]" : "bg-red-500/15 text-red-400"}`}>{u.active ? "ACTIVE" : "DEACTIVATED"}</span>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button data-testid={`btn-files-${u.email}`} onClick={() => openFiles(u)} size="sm" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-8 px-2"><Files size={12}/></Button>
                    <Button data-testid={`btn-instr-${u.email}`} onClick={() => setInstructionEdit(u)} size="sm" variant="outline" className="border-white/10 bg-transparent text-white hover:bg-white/5 h-8 px-2"><Edit3 size={12}/></Button>
                    <Button data-testid={`btn-forgot-${u.email}`} onClick={() => sendForgot(u.id)} size="sm" variant="outline" className="border-[#48BB78]/40 text-[#48BB78] bg-transparent hover:bg-[#48BB78]/10 h-8 px-2"><KeyRound size={12}/></Button>
                    <Button data-testid={`btn-toggle-${u.email}`} onClick={() => deactivate(u.id, u.active)} size="sm" variant="outline" className={`h-8 px-2 bg-transparent ${u.active ? "border-red-500/40 text-red-400 hover:bg-red-500/10" : "border-[#48BB78]/40 text-[#48BB78] hover:bg-[#48BB78]/10"}`}>
                      {u.active ? <PowerOff size={12}/> : <Power size={12}/>}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
        <DialogContent className="bg-[#1A202C] border-white/10 text-white">
          <DialogHeader><DialogTitle>Files &mdash; {filesModal?.user?.email}</DialogTitle></DialogHeader>
          {filesModal?.files?.length ? (
            <ul className="space-y-2">
              {filesModal.files.map(f => (
                <li key={f.id} className="bg-[#2D3748] px-3 py-2 rounded-md border border-white/5 text-sm flex justify-between">
                  <span>{f.original_filename}</span><span className="text-[#A0AEC0] text-xs">{(f.size/1024).toFixed(1)} KB</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-[#A0AEC0] text-sm">No files uploaded.</p>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
