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

## What's been implemented — 05 Aug 2026 (Kairo rebrand + 5 features)
- ✅ **Rebrand → Kairo** — new SVG logo (`components/KairoLogo.jsx`), all "Rozio-Killer" text replaced across frontend + backend (emails, loader.js, SMS, voice), index.html title/description
- ✅ **Landing redesign** (`pages/Landing.jsx`) — centered gradient hero, "IN DEMO MODE · UPWORK CLIENTS ONLY" badge, platform marquee, use-case bento (Shopify / ads / SMB), 8-feature grid, "It's not open yet — reserve your spot" Book-on-Upwork block, testimonials, big footer. Design blueprint in `/app/design_guidelines.json`
- ✅ **Admin Platform Keys** — `GET/PUT /api/admin/platform-keys`; master admin adds a **Resend** API key + sender email in the System tab (Fernet-encrypted, masked readback). `send_email_sync` prefers the admin-configured key → live emails without touching .env
- ✅ **Approved-Answer Analytics** — `GET /api/me/training/analytics`; `used_count`/`last_used_at` incremented in `chat_stream` only for corrections whose keywords match the visitor's question. Training tab shows totals + ranked "which answers pay off" list
- ✅ **RAG chunking** — PDFs split into overlapping chunks on upload (`_chunk_text`); chat retrieves top-6 by keyword overlap (`_rank_chunks`) instead of dumping the first 6KB; legacy files chunked on the fly
- ✅ **Live inbox (SSE)** — `GET /api/messages/stream?token=` pushes conversation updates; `MessagesInbox` uses `EventSource` (pulsing Live indicator) instead of 8s polling; disconnect-aware, auth via token query param
- ✅ Tested: backend 11/11 pytest, frontend 7/7 Playwright flows, zero console errors (`iteration_15.json`)

## Notes / follow-ups (05 Aug)
- `UPWORK_URL` in `Landing.jsx` is a placeholder (`https://www.upwork.com/`) — swap for Baazi's real profile link
- A test Resend key (`re_UI_TEST_...`) was persisted by the test suite; overwrite it in Admin → System → Email Delivery with a real key to send live emails
- Widget takeover (human replies shown to the visitor live) already works via `/chat/session/{sid}/pending` polling
- Tech debt (from review, non-blocking): split `server.py` (~2345 lines) & `Dashboard.jsx` (~1136 lines) into routers/modules; consider a one-shot SSE ticket instead of JWT-in-URL

## Prioritised backlog
- **P2** Split `server.py` / `Dashboard.jsx` into routers/modules
- **P2** SSE stream-ticket (avoid primary JWT in query string / logs)
- **P2** Redesign Admin panel with the dashboard sidebar layout
- **P3** UI presets (Minimal / Bold / Luxury) + "Copy widget mockup image"
- **P3** Inbound email intake for the unified inbox

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

## What's been implemented — 06 Aug 2026 (env recovery + 4 features)
- ⚠️ **Env recovery** — after a fresh GitHub re-import both `backend/.env` and `frontend/.env` were MISSING and Mongo was empty. Recreated both (new JWT_SECRET + FERNET_KEY, MONGO_URL, DB_NAME=kairo, EMERGENT_LLM_KEY, ADMIN baazisufi23@gmail.com / Kairo@Admin2025). App restored & healthy.
- ✅ **Live Resend wiring (demo mode)** — send_email already prefers admin-configured Resend key; kept. Key not set → stays in demo mode until a real `re_...` key is saved in Admin → System → Platform Keys.
- ✅ **Centralized Platform Keys** — GET/PUT /api/admin/platform-keys rewritten to a generic multi-category store (email / calendar / messaging / voice / chat); secrets Fernet-encrypted + masked, plain values editable. New Admin UI renders all categories.
- ✅ **Waitlist capture** — POST /api/waitlist (public, dedupe), GET/DELETE /api/admin/waitlist. Landing has a Join-the-launch-list form; Admin has a Waitlist tab (list + CSV export + delete).
- ✅ **Answer Suggestions** — GET /api/me/training/suggestions scores weak replies + LLM (gpt-4o) drafts improved answers; Training tab "Scan for weak replies" → one-click Approve (creates a correction).
- ✅ **Booking calendar** — GET /api/public/kairo-availability + POST /api/public/reserve + GET /api/admin/reservations. Landing reservation block has a mini day/slot calendar → reserve → Continue to Upwork (booking_url from platform calendar key); Admin has a Reservations tab.
- ✅ Backend tested: 18/18 pass. Frontend visually verified (landing, admin keys, training). Automated frontend test pending user approval.

## What's been implemented — 06 Aug 2026 (Admin panel redesign + password change)
- ✅ **Admin password** changed to `Bigbaaz23` (ADMIN_PASSWORD in .env; startup keeps it in sync). Old password rejected (401), new returns admin JWT.
- ✅ **Admin panel redesigned** (`pages/Admin.jsx`) from top-tabs to a **left main-menu sidebar** (AdminSidebar): Dashboard / Clients / Activity / Waitlist / Reservations / Audit / Settings, with live count badges (clients, waitlist, reservations). Master Admin user card + logout at bottom.
- ✅ **Context switcher** in the top bar (`ContextSwitcher` dropdown): shows "Admin · your workspace" (current, ticked) and a "View as a client" list of every client → selecting one impersonates them (existing /admin/impersonate flow) and opens their dashboard. Lets the admin flip between the admin workspace and any client.
- ✅ **Reorganised content:** Dashboard is the default landing with the hero, 6 KPI stats, 3 at-a-glance cards (active clients / waitlist / reservations, each clickable), recent-bookings preview and a system-health snapshot. **Manual Account Creator moved into Clients**; **Integration Health + signup toggle + upload policy moved into Settings** (alongside Platform Keys, env reference, storage).
- ✅ Verified visually: login (new pw) → sidebar + dashboard, context switcher dropdown, Clients (creator + table), Settings (health + keys) all render, section switching works. Automated frontend UI test pending user approval.

## What's been implemented — 06 Aug 2026 (per-client keys)
- ✅ **Per-client keys** — each client manages their OWN encrypted keys (isolated per account) via `GET/PUT /api/me/platform-keys`, stored on the user doc under `client_keys.<field>` (Fernet secrets, masked readback). Categories: Email (Resend + sender), Calendar & Booking (Calendly/Zoom/Google), Messaging/SMS (Telnyx), Voice, Chat/LLM.
- ✅ **Client dashboard "My Keys" tab** — new Settings tab renders those categories (client-scoped), styled to match. Admin keeps full control (own platform keys + per-client Manage modal + "View as" to edit any client's keys); clients only see their own.
- ✅ Uploads/knowledge base & embed code remain per-tenant (personalized: a file added updates only that client's bot; embed works on Shopify/WooCommerce/any site).
- ✅ Backend tested 7/7 (save+mask, idempotent masked re-PUT, auth 401, isolation between two clients). Frontend visually verified (demo client My Keys shows its own masked Resend + Calendly). Automated frontend UI test pending user approval.

## What's been implemented — 06 Aug 2026 (Landing + Login premium redesign)
- ✅ **Animated backgrounds** — scroll-reactive aurora layer (fixed, -z-10, isolate root) with hue-rotate + parallax on scroll; Login left panel gets the same aurora glow.
- ✅ **Flipping hero word** — RotatingWord component cycles gradient words (convert./book the call./answer 24/7./upsell./close it.) on Landing; Login headline "Log in to convert./book./automate./grow./ship."
- ✅ **Upgraded UI** — glass pill chips for the platform marquee, premium images in img-frame cards (e-commerce, marketing analytics, cleaning service), new service-business use-case card.
- ✅ **Reviews = Fresh N Clean LLC** — featured testimonial rewritten to their story (prior freelancer's basic AI vs Kairo booking cleaning jobs), section retitled "They tried a basic bot. Then they tried Kairo."
- ✅ **"Why this matters" footer** — persuasive sell copy (even for a simple Upwork booking) + 4 value cards (Never miss a lead / Browsers→bookings / Sounds like you / Live in minutes) + gradient "Let's talk".
- ✅ Frontend testing agent: 11/11 pass (flip word animates, images load naturalWidth>0, Fresh N Clean present, why-grid present, wrong creds show inline error, correct admin creds route to /admin). No console errors.

## What's been implemented — 06 Aug 2026 (chatbot widget + conversation upgrade)
- ✅ **Removed the green logo & "Powered by AI"** — widget header/message avatars are now a subtle MessageCircle icon (no bright green block); the "Powered by Kairo AI" footer is gone.
- ✅ **Closed launcher = message icon** (was a robot face) in Widget.jsx.
- ✅ **30s proactive nudge** — Widget closed-state + embed loader.js now show "👋 Talk to us here — in any language." at 30s with a bouncing arrow pointing to the message launcher (loader teaser retimed 1.8s→30s, hides at 46s).
- ✅ **Full-screen Live Preview** — the preview Dialog now covers the whole viewport edge-to-edge (forced with !important overrides). Verified 1920×1011.
- ✅ **Smart, human conversation (text + voice)** — rewrote /api/chat/stream system prompt: warm greetings/small-talk ("Hey there! How's your day going?") instead of robotic "Here to help you with anything"; matches energy, stays concise, keeps [[LANG:xx]] + [[ACTION]] markers. Voice call reuses the same pipeline.
- ✅ **Multi-turn MEMORY fix** — chat_stream now injects the last 12 messages of the session into the prompt, so it remembers names/sizes/context across turns (was previously stateless).
- ✅ Tested: backend chat 5/5 (memory, warmth, language, escalation), frontend widget 10/10 (full-screen preview, message launcher, 30s nudge "any language", no Powered-by, warm "hi" reply). No console errors.

## What's been implemented — 06 Aug 2026 (typing personality)
- ✅ **Lifelike typing pauses** — Widget now buffers the streamed reply and reveals it word-by-word via a typewriter effect (initial ~350ms "composing" pause with typing dots, then per-word delays with longer pauses after . ! ? and commas; auto-speeds for long replies). Skipped during live voice calls so speech isn't delayed.
- ✅ **Occasional emoji** — chat_stream prompt now encourages one tasteful emoji now and then on light/positive replies (never on serious topics). Verified live: "Hey! How's your day going? 😊".
- ✅ **Emoji stripped from voice/TTS** — spoken text has emoji removed so they aren't read aloud (text + lipsync paths).

## What's been implemented — 06 Aug 2026 (chatbot message color settings)
- ✅ **Message color customization** — Settings → Branding now has a "Message colors" card with 3 pickers: Bot message text color (`bot_text_color`), Bot message bubble color (`bot_bubble_color`), Your message text color (`user_text_color`). Backend `ProfileUpdate`/tenant models + `PUT /api/me/profile` persist them; Widget.jsx applies them live to chat bubbles. Verified persistence via API + pickers render (data-testids color-bot-text / color-bot-bubble / color-user-text). Live AI chat NOT tested — LLM key budget exhausted (user chose to skip top-up).

## What's been implemented — 06 Aug 2026 (faster + smarter chat + voice greeting)
- ✅ **Faster replies** — reverted the slow buffer-then-typewriter; widget now LIVE-streams tokens (throttled ~40ms) so text appears instantly and still reads like natural typing. Fixed the "hi is delayed" issue.
- ✅ **Smarter answers** — prompt now: (5b) EXPLAIN don't link — explains what a product/service is + the benefit in plain language, NEVER pastes raw URLs / reads web addresses; (5c) always-be-closing — after answering, invites the next step (book/quote/order) with one friendly question. Verified: "stripping and waxing?" → explains it + "Would you like a quote?" (no URL).
- ✅ **Voice greeting** — face-to-face call now opens with a warm spoken hello the instant it connects (uses tenant's configured greeting or a personalized default with business name); shown on-screen + spoken via TTS (emoji stripped from speech).
- ✅ Verified live via /api/chat/stream: "hi" → "Hey there! How's your day going? 😊" (warm, fast); service question → explain + book, no link.
