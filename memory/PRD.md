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
- Landing page with hero + bento features + trust bar + CTA + footer
- Public signup toggle (Admin panel) → gates /register page
- Auth: login, register (with mock verification email), forgot password (real Resend email + password rotation)
- Client Dashboard split-screen (52% config / 48% sandbox) with 3 tabs
  - Knowledge: industry dropdown, dynamic instruction textarea, PDF drag-and-drop → Emergent Object Storage, URL crawl mock (products + delivery windows)
  - Branding: 3 color pickers (widget_bg, bubble, accent) with preset swatches
  - Matrix: shadcn calendar multi-select slots, spending points card + increment
- Sandbox Widget: floating chat with AI-avatar video header, live-color-sync to Branding tab, SSE streaming from GPT 5.6 Terra with auto multi-language, product cards for e-commerce, "Talk to Live Human" escalation with Resend transcript email + phone fallback text, "Book slot" with Resend confirmation emails
- Admin `/admin`: signup toggle, Manual Account Creator (returns generated password), client database table with color swatches, per-row actions (Files modal, Instruction override dialog, Send forgot-password email, Deactivate/Activate)
- Test credentials file at /app/memory/test_credentials.md

## Backlog / Next
- P1: Real web crawler (currently mocked to 3 products)
- P1: Replace placeholder AI avatar image with actual live video (fal.ai talking head or D-ID)
- P2: Shopify/WordPress embed script generator + copy-to-clipboard
- P2: RAG over uploaded PDFs (currently PDFs stored but not fed to LLM)
- P2: Real phone-fallback via Twilio
- P2: Team seats / multi-user per tenant
