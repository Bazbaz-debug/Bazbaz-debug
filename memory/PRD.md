# Rozio-Killer SaaS — Product Requirements

## Original Problem Statement
Build a responsive full-stack multi-tenant SaaS app that outperforms Rozio AI. Cross-platform support (Shopify, WordPress, Custom HTML). Dark charcoal #1A202C + neon green #48BB78 theme. Includes: public landing with invite-only toggle, secure login + forgot password, tabbed client dashboard (Knowledge Ingestion / Widget Branding / Operational Matrix), permanent split-screen sandbox with live AI-avatar chat widget, and super-user admin panel at /admin.

## User Choices (locked)
- LLM: **GPT 5.6 Terra** via Emergent Universal Key
- Admin creds: admin@rozio-killer.com / Admin@12345
- Emails: **Resend** (real API) — key configured
- File uploads: **Emergent Object Storage**
- Multi-language: auto-detect + reply in same language

## Architecture
- Backend: FastAPI, all routes prefixed `/api`, JWT auth (HS256), bcrypt passwords, MongoDB. Startup seeds admin + demo client.
- Frontend: React 19 + React Router + Tailwind + shadcn UI. Fontshare Cabinet Grotesk / Satoshi.
- Streaming chat via SSE (fetch reader, not EventSource), token-buffering disabled.
- Storage: Emergent Object Storage via `EMERGENT_LLM_KEY`, init at startup.

## Implemented (2026-02-03)
Phase 1:
- Landing + invite toggle + auth (login/register/forgot with Resend emails)
- Dashboard split-screen + 3 tabs (Knowledge/Branding/Matrix) with PDF upload → Emergent Object Storage + URL crawl mock
- Sandbox widget with GPT 5.6 Terra streaming (multi-language), Talk-to-Live-Human + Book slot
- Admin panel with signup toggle, manual account creator, client table, per-row actions

Phase 6 (2026-02-03) — Bug fixes from user feedback:
- **Removed** the "Talk to Live Human" and "Book slot" buttons from the widget UI
- **Natural language triggers**: LLM system prompt now emits `[[ACTION:escalate]]` and `[[ACTION:book:<slot>]]` markers when user requests those in chat or voice. Frontend strips markers and auto-calls the correct endpoint
- **Google Calendar link**: `/api/booking/confirm` now returns `google_calendar_url` (Google Calendar TEMPLATE link) and parses simple time cues from the slot text ("tomorrow 3pm", "today 10:30 am"). Widget auto-opens the link in a new tab; confirmation email also includes "Add to Google Calendar" button
- **Real website crawl**: `/api/knowledge/crawl` now fetches the URL, parses HTML with BeautifulSoup, and asks GPT 5.6 Terra to extract 3-6 real products/services with prices, descriptions, images. Verified on vercel.com, stripe.com — no more Aurora Runner mock data
- **AI-generated avatar faces**: on startup, fal.ai flux/schnell generates 3 photorealistic AI portraits for male/female/neutral (falls back to dicebear personas SVG when fal wallet is empty). Served via `/api/public/avatar/{gender}.jpg`
- **Voice Call mode**: green phone icon in the widget starts hands-free continuous voice mode using browser SpeechRecognition — user speaks in any language, AI replies, mic re-arms automatically. Red phone button ends the call
- Testing agent iteration 3: 11/11 backend + all frontend tests pass

Phase 5 (2026-02-03) — Admin Overhaul:
- **6-stat global row**: Clients, Chats, Bookings(7d), Voice Min, Videos, Calls (auto-refresh 10s)
- **4 admin tabs**: Overview / Clients / Activity / System
- **Overview tab**: 6-card Integration Health panel (Emergent LLM, Resend, Twilio Voice, Fal Lip-Sync, Object Storage, Escalation Target — each shows connected/needs-attention), Public Signup Toggle, Manual Account Creator
- **Clients tab**: extended table with Avatar gender column, color swatches, industry, domain, per-row Metrics/Files/Instruction-Edit/Send-Reset/Deactivate action buttons
- **Activity tab**: real-time Recent Bookings and Escalation Calls feeds with tenant + customer emails, Twilio SID, timestamps
- **System tab**: Env credential status reference + aggregate storage stat
- **Per-client Metrics modal**: chats, bookings, escalations, voice seconds, videos, calls
- Backend adds `/api/admin/stats`, `/api/admin/activity`, `/api/admin/health`, `/api/admin/users/{id}/metrics`

Phase 4 (2026-02-03):
- **Fal.ai talking-head avatar (veed/lipsync)**: FAL_KEY wired, endpoint `POST /api/avatar/lipsync` generates TTS → uploads audio → submits to `veed/lipsync` → returns lip-synced video URL. Widget swaps `<img>` to `<video>` when ready with a "Generating lip-synced video..." overlay
- **Voice matching**: per-tenant `avatar_gender` (male/female/neutral). Voices are matched automatically: male→onyx, female→nova, neutral→sage. Widget's still image + generated video both use the matched persona
- **Gender selector** in Branding tab shows 3 cards with headshot + voice label, live-syncs to sandbox widget
- **Widget toggles**: `STILL` (audio-reactive image) vs `VIDEO` (fal lipsync) + `VOICE ON/OFF`
- **Note**: fal.ai account currently has $0 balance so lip-sync gracefully falls back to still-image + TTS audio. Once balance is added, VIDEO toggle produces real lip-synced clips.

Phase 3 (2026-02-03):
- **Dynamic mouse-reactive background**: Radial gradient follows cursor + static organic mesh gradient blobs. Applied to landing hero + sandbox pane + preview modal.
- **Live Preview Modal**: "Open Live Preview" button opens full-screen dialog with mock site + working widget (chat, avatar, voice, booking) for testing before publishing embed.
- **Metrics Bar**: Top-of-dashboard row with 4 KPIs — Chats Today, Bookings This Week, Voice Minutes, Conversion Rate — auto-refreshes every 8s from /api/me/metrics; server increments counters on chat/stream, booking/confirm, chat/escalate, voice/tts.

Phase 2 (2026-02-03):
- **Live voice chat**: hold-to-talk mic → OpenAI Whisper STT → GPT 5.6 Terra → OpenAI TTS auto-plays reply. Full auto multi-language.
- **Audio-reactive avatar**: static portrait scales + glows in accent color while TTS speaks (fal.ai talking-head deferred - no FAL_KEY yet)
- **PDF Brain (RAG)**: pypdf extracts text on upload, top files injected into chat system prompt
- **Embed script**: `/api/embed/{tenant_id}/loader.js` serves a self-executing script + iframe launcher; branding tab shows one-line snippet with Copy button
- **Twilio phone fallback**: /api/chat/escalate triggers a real Twilio call when TWILIO_PHONE_NUMBER is set; falls back to mocked call log otherwise; every escalation stored in db.calls

## Backlog / Next
- P1: Add FAL_KEY → wire real talking-head video via fal.ai
- P1: Set TWILIO_PHONE_NUMBER → real outbound calls
- P2: `/embed-widget` iframe route (the loader references it; currently opens iframe to the same URL which shows the full app)
- P2: k-NN retrieval over PDF chunks instead of dumping full content
- P2: Twilio call recording + voicemail-to-transcript
