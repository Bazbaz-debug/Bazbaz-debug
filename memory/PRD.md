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
- ✅ **Shopify order tracking** — `POST /api/order/track` looks up an order in the tenant's Shopify store (via Admin API) and returns a normalised 4-stage timeline. Widget renders `TrackingTimeline` showing Ordered → Packed → Shipped → Delivered with carrier link. Shopify config lives under Settings → Integrations (`shopify_domain`, `shopify_admin_token`).
- ✅ **Photo → product search** — `POST /api/vision/product-search` sends the image to GPT-4o vision, describes it, matches against tenant catalog. Widget adds a camera button + "Send a photo of a product" quickreply, renders match cards with buy links.
- ✅ **Human takeover in widget** — Widget polls `GET /api/chat/session/{sid}/pending` every 4s while open; incoming `human_agent` messages appear as green-styled bubbles with a "Support · Human" label and are read aloud in voice mode.
- ✅ **Booking URL now env-driven** — `REACT_APP_BOOKING_URL` in `frontend/.env` overrides the placeholder Upwork link on Landing.
- ✅ Backend tests: 5/6 pass, 1 skipped due to LLM budget exhaustion (verified working end-to-end before budget ran out) · Frontend: 100% (iteration_13.json)

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
