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

## What's been implemented — 05 Aug 2026 (11-item SaaS roadmap)
Phase 1 (UI polish):
- ✅ **Crawl Sync feedback** — Sync button shows spinner + green success / red error toasts
- ✅ **Dynamic branding** — closed launcher uses a generic message icon; widget header renders the client logo; Logo upload lives in Settings → Bot Identity
- ✅ **Realistic dashboard** — `/api/me/metrics` returns lively sample numbers for fresh workspaces (is_sample flag); new `RecentActivity` feed via `/api/me/activity`
- ✅ **Locked/centered layout** — main workspace wrapped in `max-w-[1200px] mx-auto w-full`, sidebar stays fixed
- ✅ **Connected badge** — Admin Integration Health cards show a bold green "Connected" pill
- ✅ **Full-screen preview** — Live Preview dialog expands edge-to-edge (w-screen/h-screen)
Phase 2 (SaaS backend):
- ✅ **Master admin** — baazisufi23@gmail.com (hashed, synced from .env each startup); admin@rozio.ai removed; login trims+lowercases email (trailing spaces OK) & preserves password spaces via `LoginReq` field_validator
- ✅ **Client-specific embed** — snippet injects `data-workspace-id`; Install Guides shows the Workspace ID + isolation note
- ✅ **Integrations Hub** — `/api/me/integrations` GET/PUT/DELETE with Fernet-encrypted secrets (FERNET_KEY in .env), values masked (••••last4), never returned in plaintext. Providers: Zoom/Calendly/Slack/Stripe/HubSpot
- ✅ **RBAC View As** — `POST /api/admin/impersonate/{id}` mints a 2h token carrying `impersonated_by`; frontend swaps tokens, shows orange banner + Exit View As
- ✅ **Audit log** — `log_audit()` on settings/client/integration/impersonation/training mutations; `GET /api/admin/audit?q=` searchable; new Admin "Audit" tab
- ✅ **Training Center** — `/api/me/training/transcripts|corrections|correct`; approved answers injected into the chat system prompt as highest-priority responses; new Settings "Training" tab
- ✅ Tested: backend 16/16 pytest, frontend 11/11 Playwright flows (iteration_14.json)

## Key endpoints added (05 Aug)
- `GET /api/me/activity` · `GET/PUT/DELETE /api/me/integrations` · `POST /api/admin/impersonate/{user_id}`
- `GET /api/admin/audit?q=` · `GET /api/me/training/transcripts` · `GET/POST/DELETE /api/me/training/corrections|correct`

## Prioritised backlog
- **P1** WebSocket / SSE push for the Messages inbox (currently polls every 8s)
- **P2** Split `Dashboard.jsx` (~1073 lines) & `server.py` (~2199 lines) into per-section files/routers
- **P2** Widget shows `human_agent` messages live (visitor-side takeover)
- **P2** k-NN / RAG chunking over PDFs (currently dumps first 6KB per file)
- **P2** Redesign Admin panel with the dashboard sidebar layout
- **P3** UI presets (Minimal / Bold / Luxury) + "Copy widget mockup image"
- **P3** Email intake for the unified inbox (SendGrid / Resend inbound)

## Old (04 Aug) backlog — superseded items removed above

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
