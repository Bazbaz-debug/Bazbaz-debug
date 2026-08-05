import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Copy, Check, ShoppingBag, Globe, Code2, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export default function SetupGuides() {
  const { user } = useAuth();
  const nav = useNavigate();
  const backend = process.env.REACT_APP_BACKEND_URL;
  const clientId = user?.id || "YOUR_CLIENT_ID";
  const snippet = `<script async src="${backend}/api/embed/${clientId}/loader.js" data-workspace-id="${clientId}"></script>`;
  const [copiedKey, setCopiedKey] = useState(null);
  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="min-h-screen bg-[#1A202C] text-white">
      <header className="border-b border-white/5 px-6 md:px-10 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-[#48BB78] flex items-center justify-center text-[#1A202C]"><Bot size={20} strokeWidth={2.5}/></div>
          <span className="font-display font-black text-lg">Rozio-Killer &middot; Install Guides</span>
        </div>
        <Button data-testid="guides-back-btn" onClick={() => nav("/dashboard")} variant="outline" size="sm" className="border-white/10 bg-transparent text-white hover:bg-white/5"><ArrowLeft size={14} className="mr-1"/> Back to dashboard</Button>
      </header>
      <div className="px-6 md:px-10 py-10 max-w-4xl">
        <p className="uppercase text-xs tracking-[0.3em] font-bold text-[#48BB78] mb-2">4-minute install</p>
        <h1 className="font-display font-black text-4xl tracking-tight mb-6">Drop-in setup guides.</h1>
        <p className="text-[#A0AEC0] mb-8">One universal snippet. Three platforms. Copy, paste, ship.</p>

        <div className="bg-[#2D3748] border border-[#48BB78]/30 rounded-md p-5 mb-10">
          <p className="uppercase text-xs tracking-[0.3em] font-bold text-[#48BB78] mb-2">Your universal embed snippet</p>
          <div className="bg-[#1A202C] border border-white/10 rounded-md p-3 font-mono text-xs text-[#48BB78] break-all mb-3" data-testid="universal-snippet">{snippet}</div>
          <p className="text-[11px] text-[#A0AEC0] mb-3" data-testid="workspace-id-note">Workspace ID: <span className="font-mono text-white">{clientId}</span> — this snippet loads only <b>your</b> concierge, knowledge base &amp; settings, fully isolated from other accounts.</p>
          <Button data-testid="copy-universal-snippet" onClick={() => copy(snippet, "universal")} className="bg-[#48BB78] hover:bg-[#38A169] text-[#1A202C] hover:text-white font-bold rounded-md">
            {copiedKey === "universal" ? <Check size={14} className="mr-1.5"/> : <Copy size={14} className="mr-1.5"/>}
            {copiedKey === "universal" ? "Copied" : "Copy snippet"}
          </Button>
        </div>

        <Guide testId="guide-shopify" icon={<ShoppingBag size={20}/>} platform="Shopify" steps={[
          "In your Shopify admin, go to Online Store → Themes → Actions → Edit code",
          "Open the theme.liquid file under Layouts",
          "Paste the snippet immediately before the closing </body> tag",
          "Save. The widget will appear on every storefront page.",
        ]}/>
        <Guide testId="guide-wordpress" icon={<Globe size={20}/>} platform="WordPress / WooCommerce" steps={[
          "In WordPress admin, install 'Insert Headers and Footers' plugin (or use your theme's header option)",
          "Go to Settings → Insert Headers and Footers",
          "Paste the snippet into the Footer section",
          "Save. The widget loads on every page automatically.",
        ]}/>
        <Guide testId="guide-html" icon={<Code2 size={20}/>} platform="Custom HTML / Static Site" steps={[
          "Open your site's main HTML template (index.html or _document.js in Next.js, base.html in Django, etc.)",
          "Paste the snippet just before the closing </body> tag",
          "Redeploy your site",
          "Test: reload any page and the neon-green launcher appears in the bottom-right corner.",
        ]}/>
      </div>
    </div>
  );
}

function Guide({ icon, platform, steps, testId }) {
  return (
    <div data-testid={testId} className="bg-[#2D3748] border border-white/5 rounded-md p-6 mb-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-md bg-[#48BB78]/10 border border-[#48BB78]/30 text-[#48BB78] flex items-center justify-center">{icon}</div>
        <h3 className="font-display font-black text-2xl">{platform}</h3>
      </div>
      <ol className="space-y-2.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 items-start">
            <span className="w-6 h-6 rounded-full bg-[#48BB78] text-[#1A202C] font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
            <p className="text-[#A0AEC0] text-sm leading-relaxed pt-0.5">{s}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
