import { useEffect, useState } from "react";
import api from "@/lib/api";
import { MessagesSquare, CalendarCheck, Mic, TrendingUp } from "lucide-react";

export default function MetricsBar() {
  const [m, setM] = useState({ chats_today: 0, bookings_week: 0, voice_minutes: 0, conversion_rate: 0 });
  useEffect(() => {
    const load = () => api.get("/me/metrics").then(r => setM(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      <MetricCard testId="metric-chats" icon={<MessagesSquare size={16}/>} label="Chats today" value={m.chats_today} suffix=""/>
      <MetricCard testId="metric-bookings" icon={<CalendarCheck size={16}/>} label="Bookings this week" value={m.bookings_week} suffix=""/>
      <MetricCard testId="metric-voice" icon={<Mic size={16}/>} label="Voice minutes" value={m.voice_minutes} suffix="m"/>
      <MetricCard testId="metric-conversion" icon={<TrendingUp size={16}/>} label="Conversion rate" value={m.conversion_rate} suffix="%"/>
    </div>
  );
}

function MetricCard({ icon, label, value, suffix, testId }) {
  return (
    <div data-testid={testId} className="bg-[#2D3748] border border-white/5 hover:border-[#48BB78]/40 rounded-md p-4 transition-colors">
      <div className="flex items-center gap-2 text-[#48BB78] mb-2 text-xs uppercase font-bold tracking-[0.15em]">{icon}<span>{label}</span></div>
      <div className="font-display font-black text-3xl tracking-tighter">{value}<span className="text-[#48BB78] text-lg ml-0.5">{suffix}</span></div>
    </div>
  );
}
