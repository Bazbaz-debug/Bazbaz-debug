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
