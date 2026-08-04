"""Regression tests for /api/chat/stream — verify no re-greeting, session memory, no repetition."""
import os
import json
import re
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://config-dashboard-30.preview.emergentagent.com").rstrip("/")
TENANT_ID = "59d01823-0f99-4ee3-a24a-6d162645771e"

GREETING_PATTERNS = [
    r"^\s*hi\b", r"^\s*hello\b", r"^\s*hey\b", r"^\s*good (morning|afternoon|evening)\b",
    r"^\s*how can i (help|assist)", r"^\s*how are you", r"^\s*good to see you",
    r"^\s*welcome\b", r"^\s*greetings\b",
]

LANG_RE = re.compile(r"^\s*\[\[LANG:([a-z]{2})\]\]\s*", re.IGNORECASE)


def _stream_chat(session_id: str, message: str, timeout: int = 60) -> str:
    """POST to /api/chat/stream and reconstruct the full reply from SSE deltas."""
    url = f"{BASE_URL}/api/chat/stream"
    payload = {"session_id": session_id, "message": message, "user_id": TENANT_ID}
    full = ""
    with requests.post(url, json=payload, stream=True, timeout=timeout) as r:
        assert r.status_code == 200, f"chat_stream returned {r.status_code}: {r.text[:300]}"
        for raw in r.iter_lines(decode_unicode=True):
            if not raw or not raw.startswith("data:"):
                continue
            data = raw[len("data:"):].strip()
            try:
                evt = json.loads(data)
            except Exception:
                continue
            if "delta" in evt:
                full += evt["delta"]
            if evt.get("done") or evt.get("error"):
                if evt.get("error"):
                    pytest.fail(f"stream error: {evt['error']}")
                break
    return full


def _strip_lang(reply: str):
    m = LANG_RE.match(reply)
    if not m:
        return None, reply
    return m.group(1).lower(), LANG_RE.sub("", reply, count=1).lstrip()


def _has_greeting(text: str) -> bool:
    low = text.lower().lstrip()
    return any(re.search(p, low) for p in GREETING_PATTERNS)


# ---------- Bug 1: first-message must NOT re-greet ----------
class TestNoRegreeting:
    def test_first_message_no_greeting(self):
        sid = f"TEST_nogreet_{uuid.uuid4()}"
        reply = _stream_chat(sid, "What products do you sell?")
        assert reply, "empty reply"
        lang, body = _strip_lang(reply)
        assert lang is not None, f"missing [[LANG:xx]] marker. Reply: {reply[:200]}"
        assert lang == "en", f"expected en, got {lang}"
        assert not _has_greeting(body), f"FIRST REPLY STARTED WITH GREETING: {body[:200]}"

    def test_hello_input_still_no_regreet(self):
        # even if user says "hi", the bot must not lead with "Hi back"
        sid = f"TEST_hello_{uuid.uuid4()}"
        reply = _stream_chat(sid, "hi")
        _, body = _strip_lang(reply)
        assert not _has_greeting(body), f"Bot re-greeted after user said hi: {body[:200]}"


# ---------- Bug 2: session memory across turns ----------
class TestSessionMemory:
    def test_remembers_iphone_context(self):
        sid = f"TEST_mem_{uuid.uuid4()}"
        r1 = _stream_chat(sid, "What products do you sell?")
        _, b1 = _strip_lang(r1)
        assert "iphone" in b1.lower() or "apple" in b1.lower() or "macbook" in b1.lower(), \
            f"catalog not mentioned in first reply: {b1[:300]}"

        r2 = _stream_chat(sid, "How much is the iPhone?")
        lang2, b2 = _strip_lang(r2)
        assert not _has_greeting(b2), f"turn2 started with greeting: {b2[:200]}"
        # Should mention price 1099 or reference the iphone specifically, not ask "which iphone"
        bad = ["what iphone", "which iphone", "could you clarify which"]
        low2 = b2.lower()
        assert not any(x in low2 for x in bad), f"bot forgot context: {b2[:300]}"
        assert "1099" in b2 or "iphone" in low2, f"reply doesn't reference iPhone: {b2[:300]}"


# ---------- Bug 3: no self-repetition across 4 turns ----------
class TestNoRepetition:
    def test_four_turn_no_repeat(self):
        sid = f"TEST_rep_{uuid.uuid4()}"
        turns = [
            "What products do you sell?",
            "Tell me more about the MacBook.",
            "Does it come with a warranty?",
            "How long is shipping to the US?",
        ]
        replies = []
        for t in turns:
            r = _stream_chat(sid, t)
            _, b = _strip_lang(r)
            assert not _has_greeting(b), f"greeting on turn '{t}': {b[:200]}"
            replies.append(b.strip())

        # no exact-duplicate replies
        assert len(set(replies)) == len(replies), "Assistant emitted a duplicate reply"

        # no reply should verbatim-echo the user's question
        for t, r in zip(turns, replies):
            assert t.lower().rstrip("?.! ") not in r.lower(), \
                f"reply echoes user question verbatim. Q='{t}' A='{r[:200]}'"


# ---------- Bug 4: concise voice-friendly length ----------
class TestConciseLength:
    def test_reply_is_short(self):
        sid = f"TEST_short_{uuid.uuid4()}"
        reply = _stream_chat(sid, "Do you sell iPads?")
        _, body = _strip_lang(reply)
        # 1-3 short sentences by default; allow 4 to be lenient. Word count guard.
        words = len(body.split())
        sentences = len([s for s in re.split(r"[.!?]+", body) if s.strip()])
        assert words <= 90, f"reply too long ({words} words): {body[:300]}"
        assert sentences <= 5, f"too many sentences ({sentences}): {body[:300]}"


# ---------- Bug 5: multi-language, still no greeting ----------
class TestSpanish:
    def test_spanish_reply_with_lang_marker_and_no_greeting(self):
        sid = f"TEST_es_{uuid.uuid4()}"
        reply = _stream_chat(sid, "Hola, ¿cuánto cuesta el iPhone?")
        lang, body = _strip_lang(reply)
        assert lang == "es", f"expected es marker, got {lang}. Reply: {reply[:200]}"
        assert not _has_greeting(body), f"Spanish reply started with greeting: {body[:200]}"
        # spanish greetings guard
        low = body.lower().lstrip()
        for g in ("hola", "buenos días", "buenas tardes", "buenas noches", "¿cómo estás", "como estas"):
            assert not low.startswith(g), f"Spanish greeting present: {body[:200]}"
        # Should reference iPhone / price
        assert "iphone" in low or "1099" in body, f"reply doesn't answer iPhone price: {body[:300]}"
