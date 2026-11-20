"""A fake Slack Web API for SENTRY_USE_FAKE_SLACK. It accepts every call and validates nothing.

Standard library only, so the devserver can start it without loading Sentry.
"""

from __future__ import annotations

import copy
import hashlib
import itertools
import json  # noqa: S003
import sys
import threading
import time
from collections.abc import Mapping
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

TEAM = {"id": "T0FAKE", "name": "Fake Slack", "domain": "fake-slack"}
DEFAULT_CHANNELS = {
    "C0ALERTS": "alerts",
    "C0SEER": "seer",
}
VIEWER = Path(__file__).with_name("viewer.html")
MAX_UNSUPPORTED_CALLS = 100

Response = dict[str, Any]


def _maybe_json(value: Any) -> Any:
    if isinstance(value, str):
        try:
            return json.loads(value)
        except ValueError:
            return value
    return value


class FakeSlack:
    def __init__(self, state_file: Path | None, public_url: str) -> None:
        self.state_file = state_file
        self.public_url = public_url.rstrip("/")
        self.lock = threading.Lock()
        self.state: dict[str, Any] = self._load()
        self.scheduled: dict[str, str] = {}
        self._scheduled_ids = itertools.count(1)

    def _load(self) -> dict[str, Any]:
        if self.state_file and self.state_file.exists():
            return {**self._empty(), **json.loads(self.state_file.read_text())}
        return self._empty()

    @staticmethod
    def _empty() -> dict[str, Any]:
        return {"channels": dict(DEFAULT_CHANNELS), "messages": [], "unsupported": []}

    def _save(self) -> None:
        if self.state_file:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            self.state_file.write_text(json.dumps(self.state, indent=1))

    def reset(self) -> None:
        with self.lock:
            self.state = self._empty()
            self._save()

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            return {"team": TEAM, **copy.deepcopy(self.state)}

    def _existing_channel_id(self, channel: str) -> str | None:
        channel = channel.lstrip("#")
        channels: dict[str, str] = self.state["channels"]
        if channel in channels:
            return channel
        return next((cid for cid, name in channels.items() if name == channel), None)

    def _channel_id(self, channel: str) -> str:
        if channel_id := self._existing_channel_id(channel):
            return channel_id
        name = channel.lstrip("#")
        channel_id = "C" + hashlib.sha1(name.encode()).hexdigest()[:9].upper()
        self.state["channels"][channel_id] = name
        return channel_id

    def _next_ts(self) -> str:
        messages = self.state["messages"]
        last = float(messages[-1]["ts"]) if messages else 0
        return f"{max(time.time(), last + 0.000001):.6f}"

    def _find(self, channel: str, ts: str) -> dict[str, Any] | None:
        return next(
            (m for m in self.state["messages"] if m["channel"] == channel and m["ts"] == ts),
            None,
        )

    def call(self, method: str, args: Mapping[str, Any]) -> Response:
        with self.lock:
            handler = getattr(self, "_" + method.replace(".", "_"), None)
            if handler is None:
                self._record_unsupported(method, args)
                return {"ok": True, "fake_slack": f"{method} is not simulated"}
            result: Response = handler(args)
            return result

    def _record_unsupported(self, method: str, args: Mapping[str, Any]) -> None:
        channel = self._existing_channel_id(args.get("channel") or "")
        ts = args.get("ts") or args.get("timestamp") or args.get("thread_ts") or ""
        message = self._find(channel, ts) if channel else None
        calls = self.state["unsupported"]
        calls.append(
            {
                "method": method,
                "at": time.time(),
                "channel": channel if message else None,
                "ts": ts if message else None,
            }
        )
        del calls[:-MAX_UNSUPPORTED_CALLS]
        self._save()

    def _chat_postMessage(self, args: Mapping[str, Any], ephemeral: bool = False) -> Response:
        channel = self._channel_id(args.get("channel") or "general")
        message = {
            "channel": channel,
            "ts": self._next_ts(),
            "thread_ts": args.get("thread_ts"),
            "text": args.get("text") or "",
            "blocks": _maybe_json(args.get("blocks")) or [],
            "attachments": _maybe_json(args.get("attachments")) or [],
            "reply_broadcast": bool(args.get("reply_broadcast")),
            "ephemeral_user": args.get("user") if ephemeral else None,
            "edited": None,
        }
        self.state["messages"].append(message)
        self._save()
        if ephemeral:
            return {"ok": True, "message_ts": message["ts"]}
        return {"ok": True, "channel": channel, "ts": message["ts"], "message": message}

    def _chat_postEphemeral(self, args: Mapping[str, Any]) -> Response:
        return self._chat_postMessage(args, ephemeral=True)

    def _chat_scheduleMessage(self, args: Mapping[str, Any]) -> Response:
        channel = self._channel_id(args.get("channel") or "general")
        scheduled_message_id = f"Q{next(self._scheduled_ids):09d}"
        self.scheduled[scheduled_message_id] = channel
        self._save()
        return {
            "ok": True,
            "channel": channel,
            "scheduled_message_id": scheduled_message_id,
            "post_at": args.get("post_at"),
        }

    def _chat_deleteScheduledMessage(self, args: Mapping[str, Any]) -> Response:
        channel = self._channel_id(args.get("channel") or "")
        scheduled_message_id = args.get("scheduled_message_id") or ""
        if self.scheduled.get(scheduled_message_id) != channel:
            return {"ok": False, "error": "invalid_scheduled_message_id"}
        del self.scheduled[scheduled_message_id]
        return {"ok": True}

    def _chat_update(self, args: Mapping[str, Any]) -> Response:
        channel = self._channel_id(args.get("channel") or "")
        message = self._find(channel, args.get("ts") or "")
        if message is None:
            return {"ok": False, "error": "message_not_found"}
        for key in ("text", "blocks", "attachments"):
            if args.get(key) is not None:
                message[key] = _maybe_json(args[key])
        message["edited"] = time.time()
        self._save()
        return {"ok": True, "channel": channel, "ts": message["ts"], "text": message["text"]}

    def _chat_delete(self, args: Mapping[str, Any]) -> Response:
        channel = self._channel_id(args.get("channel") or "")
        ts = args.get("ts")
        self.state["messages"] = [
            m for m in self.state["messages"] if not (m["channel"] == channel and m["ts"] == ts)
        ]
        self._save()
        return {"ok": True, "channel": channel, "ts": ts}

    def _chat_getPermalink(self, args: Mapping[str, Any]) -> Response:
        channel = self._channel_id(args.get("channel") or "")
        ts = args.get("message_ts") or ""
        message = self._find(channel, ts)
        thread = (message or {}).get("thread_ts") or ts
        return {
            "ok": True,
            "channel": channel,
            "permalink": f"{self.public_url}/#{channel}/{thread}/{ts}",
        }

    def _conversations_list(self, args: Mapping[str, Any]) -> Response:
        channels = [
            {"id": cid, "name": name, "is_channel": True, "is_private": False, "is_member": True}
            for cid, name in self.state["channels"].items()
        ]
        return {"ok": True, "channels": channels, "response_metadata": {"next_cursor": ""}}

    def _users_conversations(self, args: Mapping[str, Any]) -> Response:
        return self._conversations_list(args)

    def _conversations_info(self, args: Mapping[str, Any]) -> Response:
        channel = self._channel_id(args.get("channel") or "")
        return {
            "ok": True,
            "channel": {"id": channel, "name": self.state["channels"][channel], "is_member": True},
        }

    def _conversations_history(self, args: Mapping[str, Any]) -> Response:
        channel = self._channel_id(args.get("channel") or "")
        messages = [m for m in self.state["messages"] if m["channel"] == channel]
        if latest := args.get("latest"):
            messages = [m for m in messages if m["ts"] == latest]
        return {"ok": True, "messages": messages, "has_more": False}

    def _conversations_replies(self, args: Mapping[str, Any]) -> Response:
        channel = self._channel_id(args.get("channel") or "")
        ts = args.get("ts")
        messages = [
            m
            for m in self.state["messages"]
            if m["channel"] == channel and (m["ts"] == ts or m["thread_ts"] == ts)
        ]
        return {"ok": True, "messages": messages, "has_more": False}

    def _auth_test(self, args: Mapping[str, Any]) -> Response:
        return {
            "ok": True,
            "team": TEAM["name"],
            "team_id": TEAM["id"],
            "user_id": "U0SENTRY",
            "bot_id": "B0SENTRY",
        }

    def _team_info(self, args: Mapping[str, Any]) -> Response:
        return {"ok": True, "team": TEAM}

    def _users_info(self, args: Mapping[str, Any]) -> Response:
        user = args.get("user") or "U0FAKE"
        return {
            "ok": True,
            "user": {
                "id": user,
                "name": user,
                "real_name": user,
                "profile": {"display_name": user},
            },
        }

    def _users_list(self, args: Mapping[str, Any]) -> Response:
        return {"ok": True, "members": [], "response_metadata": {"next_cursor": ""}}


def _flatten(params: Mapping[str, list[str]]) -> dict[str, Any]:
    return {key: values[0] if len(values) == 1 else values for key, values in params.items()}


def make_server(host: str, port: int, slack: FakeSlack) -> ThreadingHTTPServer:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:
            pass

        def _send(self, status: int, body: bytes, content_type: str) -> None:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def _send_json(self, data: Mapping[str, Any]) -> None:
            self._send(200, json.dumps(data).encode(), "application/json")

        def do_GET(self) -> None:
            url = urlsplit(self.path)
            if url.path == "/state.json":
                self._send_json(slack.snapshot())
            elif url.path.startswith("/api/"):
                self._api(url.path, _flatten(parse_qs(url.query)))
            else:
                self._send(200, VIEWER.read_bytes(), "text/html; charset=utf-8")

        def do_POST(self) -> None:
            url = urlsplit(self.path)
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length).decode() if length else ""
            if url.path == "/reset":
                slack.reset()
                self._send_json({"ok": True})
                return
            if "json" in self.headers.get("Content-Type", ""):
                args = json.loads(raw or "{}")
            else:
                args = _flatten(parse_qs(raw))
            self._api(url.path, {**_flatten(parse_qs(url.query)), **args})

        def _api(self, path: str, args: dict[str, Any]) -> None:
            method = path.removeprefix("/api/")
            result = slack.call(method, args)
            channel = args.get("channel") or ""
            sys.stdout.write(f"{method} {channel} -> ok={result.get('ok')}\n")
            sys.stdout.flush()
            self._send_json(result)

    return ThreadingHTTPServer((host, port), Handler)
