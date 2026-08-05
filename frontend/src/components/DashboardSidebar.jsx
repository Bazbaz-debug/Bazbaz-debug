import { LayoutDashboard, MessagesSquare, BookOpen, Settings as SettingsIcon, Shield, LogOut, Bot, Sparkles, Code2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { KairoMark } from "./KairoLogo";

export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "messages", label: "Messages", icon: MessagesSquare, badge: "Live" },
  { key: "knowledge", label: "Knowledge Base", icon: BookOpen },
  { key: "settings", label: "Settings", icon: SettingsIcon },
];

export default function DashboardSidebar({ active, onSelect, user, onLogout }) {
  const nav = useNavigate();
  return (
    <aside className="hidden md:flex flex-col w-64 shrink-0 h-screen sticky top-0 border-r border-white/5 bg-[#0F141B]">
      {/* Brand */}
      <div className="px-5 pt-5 pb-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#48BB78] to-[#38A169] flex items-center justify-center text-[#0D1117] shadow-lg shadow-[#48BB78]/20"><KairoMark size={22}/></div>
          <div>
            <p className="font-display font-black text-[15px] leading-none">Kairo</p>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#48BB78] font-bold mt-1">AI Concierge</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/30 px-3 mb-2">Workspace</p>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              data-testid={`sidebar-nav-${item.key}`}
              onClick={() => onSelect(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all group ${isActive ? "bg-[#48BB78]/10 text-[#48BB78] border border-[#48BB78]/25 shadow-inner" : "text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent"}`}
            >
              <Icon size={16} className={isActive ? "text-[#48BB78]" : "text-white/50 group-hover:text-white"}/>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && (
                <span className="text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded bg-[#48BB78]/20 text-[#48BB78] border border-[#48BB78]/40">{item.badge}</span>
              )}
            </button>
          );
        })}

        <div className="mt-6 space-y-1">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/30 px-3 mb-2">Deploy</p>
          <button data-testid="sidebar-install-guides" onClick={() => nav("/setup")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors">
            <Code2 size={16}/><span>Install Guides</span>
          </button>
          {user?.role === "admin" && (
            <button data-testid="sidebar-admin-link" onClick={() => nav("/admin")} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] text-[#48BB78] hover:bg-[#48BB78]/10 transition-colors">
              <Shield size={16}/><span>Admin Panel</span>
            </button>
          )}
        </div>
      </nav>

      {/* User card */}
      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-white/[0.03]">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg,#48BB78,#38A169)" }}>
            <Sparkles size={14} className="text-[#0D1117]"/>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-[12px] font-bold truncate">{user?.full_name || "Client"}</p>
            <p className="text-white/40 text-[10px] truncate">{user?.email}</p>
          </div>
          <button data-testid="sidebar-logout-btn" onClick={onLogout} title="Log out" className="w-8 h-8 rounded-md text-white/50 hover:text-white hover:bg-white/5 flex items-center justify-center">
            <LogOut size={14}/>
          </button>
        </div>
      </div>
    </aside>
  );
}
