# Rozio-Killer SaaS — PRD

## Problem statement (latest)
Fix the widget preview bugs (voice call not working, uploaded logo not showing) and redesign the client dashboard + landing page in a Rozio-AI style (left sidebar with Dashboard / Messages / Knowledge Base / Settings; landing with moving pills, reviews, and trust marquee).

## User personas
- **Client (business owner)** — signs up, uploads catalog / PDFs, customises the widget, embeds one line of JS on their site, monitors chats in the Messages inbox, takes over conversations when needed.
- **Admin** — manages tenants, views platform-wide metrics.

## Core requirements (implemented so far)
- Multi-tenant SaaS with JWT auth + Emergent-managed Google OAuth
- Client dashboard with **Rozio-AI-style left sidebar** (Dashboard, Messages, Knowledge Base, Settings)
- Chat widget embeddable via a single `<script>` tag (loader.js → iframe → /embed-widget)
- Widget capabilities: streamed AI chat, photo-to-product search (planned), 95+ language auto-reply, voice call with photorealistic avatar, human takeover holding message
- Live Sandbox with backend proxy to preview widget on any real site
- Uploaded logos served publicly via `/api/public/logo/{tenant_id}` (proxied through backend so no X-Storage-Key needed by browsers)
- Persisted conversations + Messages inbox with human takeover — visitor messages hitting a conversation flagged `status='human'` return a holding message instead of an AI reply
- Landing page with animated marquee pills, 4 testimonials, integrations marquee, trust marquee

## What's been implemented — 04 Aug 2026
- ✅ **BUG-1** Logo now shows in widget: new `GET /api/public/logo/{tenant_id}` proxy + `resolveLogoUrl()` helper in Widget
- ✅ **BUG-2** Voice call button now requests mic permission first + graceful fallback if SpeechRecognition unavailable
- ✅ **Voice overlay scoped to widget** — call face now occupies only the chat box, not the whole page
- ✅ **Sidebar layout** on `/dashboard` (Dashboard, Messages, Knowledge Base, Settings) via new `components/DashboardSidebar.jsx`
- ✅ **Messages inbox** — chats persisted to `db.conversations` + `db.messages`; owner can view threads, send human replies, human-takeover enforced end-to-end in `/api/chat/stream`
- ✅ **Landing revamp** — dev banner ("In development · Not publicly available"), Book-Baazi-on-Upwork CTAs replacing Start-Trial/View-Demo, featured CEO review from Fresh N Clean Services LLC + one supporting review, marquee pills, integrations marquee
- ✅ Backend tests: 8/8 pass · Frontend E2E: 100% (iteration_12.json)

## Prioritised backlog
- **P1** WebSocket / SSE push for the Messages inbox (currently polls every 8s)
- **P1** Order tracking with visual package journey (Shopify Order Status API integration)
- **P1** Photo-to-product search (GPT 5.6 Terra vision → catalog matcher)
- **P2** Split `Dashboard.jsx` (now ~880 lines) into per-section files
- **P2** Redesign Admin panel with the same sidebar layout
- **P2** Widget must display `human_agent` messages so visitors see the human takeover in real-time (currently only visible in the owner's inbox)
- **P2** k-NN retrieval / RAG chunking over PDFs (currently dumps first 6KB per file)
- **P2** Twilio call recording + voicemail-to-transcript
- **P3** UI presets (Minimal / Bold / Luxury) + "Copy widget mockup image" button
- **P3** Email intake for the unified inbox (SendGrid or Resend inbound)

## Key architecture
- Frontend: React 19 + TailwindCSS + Sonner + Lucide icons + shadcn/ui
- Backend: FastAPI + Uvicorn + httpx (site proxy for the sandbox) + emergentintegrations (LlmChat, gpt-4o)
- DB: MongoDB — `users`, `metrics`, `bookings`, `files`, `conversations`, `messages`
- Storage: Emergent Object Storage (logos, avatars, PDF uploads) — served publicly through backend proxies

## Key endpoints added in this session
- `GET /api/public/logo/{tenant_id}` — public logo bytes
- `GET /api/messages/conversations` — inbox list
- `GET /api/messages/conversations/{session_id}` — thread detail
- `POST /api/messages/conversations/{session_id}/reply` — human takeover
- `POST /api/messages/conversations/{session_id}/mark?status=` — read / closed / ai / human

## Test credentials
See `/app/memory/test_credentials.md`
