import { useEffect, useState } from "react";
import axios from "axios";
import Widget from "@/components/Widget";
import { Bot } from "lucide-react";

const BACKEND = process.env.REACT_APP_BACKEND_URL;

/**
 * Standalone route rendered inside the iframe injected by /api/embed/:id/loader.js
 * Loads tenant config from the PUBLIC endpoint (no auth) and mounts <Widget /> full-frame.
 * Never renders the app's navigation, landing, or auth chrome.
 */
export default function EmbedWidget() {
  const [tenant, setTenant] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tenantId = params.get("tenant") || params.get("id");
    if (!tenantId) {
      setError("Missing tenant id");
      return;
    }
    axios
      .get(`${BACKEND}/api/public/tenant/${tenantId}`)
      .then((r) => setTenant(r.data))
      .catch(() => setError("This chat widget is disabled or unavailable"));
  }, []);

  const closeIframe = () => {
    try { window.parent.postMessage({ type: "rk:close" }, "*"); } catch (_e) { /* iframe origin isolation */ }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#1A202C] text-white flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Bot size={40} className="text-[#48BB78] mx-auto mb-3"/>
          <p className="font-bold mb-1">Chat unavailable</p>
          <p className="text-sm text-[#A0AEC0]">{error}</p>
        </div>
      </div>
    );
  }
  if (!tenant) {
    return (
      <div className="min-h-screen bg-[#1A202C] text-white flex items-center justify-center">
        <div className="animate-pulse text-[#48BB78] text-sm uppercase tracking-widest font-bold">Loading concierge...</div>
      </div>
    );
  }

  const colors = {
    widget_bg: tenant.widget_bg,
    bubble_color: tenant.bubble_color,
    accent_color: tenant.accent_color,
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden"
      style={{ background: tenant.widget_bg }}
    >
      {/* Ambient glow so the widget doesn't sit on a flat bg */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 70% 20%, ${tenant.accent_color}22 0%, transparent 60%), radial-gradient(circle at 20% 90%, ${tenant.accent_color}18 0%, transparent 55%)`,
        }}
      ></div>
      <Widget
        tenant={tenant}
        colors={colors}
        catalog={tenant.catalog || []}
        embedded
        onClose={closeIframe}
      />
    </div>
  );
}
