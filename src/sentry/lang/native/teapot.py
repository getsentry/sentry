"""HTTP client for the teapot GPU crash dump symbolication service.

Teapot is a sibling to Symbolicator: it decodes vendor-specific GPU crash
dumps (NVIDIA Aftermath `.nv-gpudmp` first, PIX / AMD RGP later) and returns
a structured JSON result that Sentry folds into the event.

Two wire formats, picked per-request based on attachment storage:

* **JSON + storage_url + token** (preferred): when every attachment has a
  `stored_id` set, we mint a short-lived objectstore token per attachment
  and POST a JSON body with `storage_url` + `storage_token` references.
  Teapot fetches the bytes from objectstore directly. No bytes pass
  through Sentry workers. Mirrors `Symbolicator.process_minidump`'s
  objectstore path at `sentry/lang/native/symbolicator.py:201-221`.

* **multipart with raw bytes** (fallback): when objectstore isn't in the
  loop (self-hosted Sentry installs without the objectstore service, or
  attachments still on the legacy V1 path) we load bytes via
  `CachedAttachment.load_data` and POST them as multipart fields.

Unlike Symbolicator, teapot is synchronous — one request, one response, no
polling. The client therefore skips the task-id / worker-id state that
`Symbolicator` carries and just runs a bounded retry on transient 5xx.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable
from typing import Any

import orjson
import requests
import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.attachments import CachedAttachment
from sentry.objectstore import get_attachments_session, get_symbolicator_url

logger = logging.getLogger(__name__)

# Total request budget: teapot's own decode budget is 30s; we add 5s of slack.
DEFAULT_TIMEOUT = 35

# Retry only on transient / bounded failures. Everything else surfaces.
RETRYABLE_STATUS = (502, 503, 504)
MAX_ATTEMPTS = 3


class TeapotUnavailable(Exception):
    """Teapot is down or returned a non-retryable error. Caller should swallow."""


def _resolve_url() -> str | None:
    base = getattr(settings, "TEAPOT_URL", None)
    if base:
        return base.rstrip("/")
    configured = options.get("teapot.options") or {}
    url = configured.get("url") if isinstance(configured, dict) else None
    return url.rstrip("/") if url else None


def _all_stored(
    dump: CachedAttachment, shader_debug_info: Iterable[tuple[str, CachedAttachment]]
) -> bool:
    """True iff every input attachment is already in objectstore.

    We can only take the JSON+storage_url path when ALL attachments have
    a `stored_id` — teapot can't mix-and-match wire formats per
    attachment. Mixed state is rare in practice (Sentry's attachment
    ingest writes everything to the same backend per project) but if
    it happens we fall through to multipart for safety.
    """

    if not dump.stored_id:
        return False
    return all(att.stored_id for _, att in shader_debug_info)


class TeapotClient:
    """Synchronous HTTP client for POST /symbolicate.

    Usage:
        client = TeapotClient(project=project, event_id=event_id)
        response = client.symbolicate(dump_attachment, shader_debug_info)

    `shader_debug_info` is a list of (uid, attachment) pairs — typically
    one per active shader involved in the crash, sourced via
    `find_all_shader_debug_attachments(data)`. Passing an empty list is
    fine for crashes where the customer's SDK didn't (or couldn't) ship
    `.nvdbg` bytes; teapot decodes the dump without source mapping.

    Raises `TeapotUnavailable` on network errors or exhausted 5xx retries.
    Callers should treat that as "skip enrichment" — never fatal to the
    primary event.
    """

    def __init__(self, project: Any, event_id: str) -> None:
        base_url = _resolve_url()
        if not base_url:
            raise TeapotUnavailable("TEAPOT_URL not configured")
        self.base_url = base_url
        self.project = project
        self.event_id = event_id

    def symbolicate(
        self,
        dump: CachedAttachment,
        shader_debug_info: list[tuple[str, CachedAttachment]] | None = None,
    ) -> dict[str, Any]:
        shader_debug_info = shader_debug_info or []
        url = f"{self.base_url}/symbolicate"
        headers = {
            "X-Teapot-Version": "1",
            "X-Request-Id": self.event_id,
        }

        if _all_stored(dump, shader_debug_info):
            return self._post_json(url, headers, dump, shader_debug_info)
        return self._post_multipart(url, headers, dump, shader_debug_info)

    def _post_json(
        self,
        url: str,
        headers: dict[str, str],
        dump: CachedAttachment,
        shader_debug_info: list[tuple[str, CachedAttachment]],
    ) -> dict[str, Any]:
        """Pass attachments to teapot by reference — bytes stay in objectstore.

        Same shape Symbolicator uses on `POST /symbolicate-any`: a single
        per-attachment token minted from a single objectstore session, so
        all GETs share the same auth window. Token lifetime is short
        (objectstore enforces it server-side); we mint within the same
        request as the POST.
        """

        session = get_attachments_session(self.project.organization_id, self.project.id)
        dump_url = get_symbolicator_url(session, dump.stored_id)
        body: dict[str, Any] = {
            "event_id": self.event_id,
            "project_id": str(self.project.id),
            "organization_id": str(self.project.organization_id),
            "dump": {
                "storage_url": dump_url,
                # Token minted just before the request so its lifetime
                # window covers teapot's fetch round-trip.
                "storage_token": session.mint_token(),
            },
            "shader_debug_info": [
                {
                    "uid": uid,
                    "storage_url": get_symbolicator_url(session, att.stored_id),
                    "storage_token": session.mint_token(),
                }
                for uid, att in shader_debug_info
            ],
        }
        return self._send(
            url, headers={**headers, "Content-Type": "application/json"}, data=orjson.dumps(body)
        )

    def _post_multipart(
        self,
        url: str,
        headers: dict[str, str],
        dump: CachedAttachment,
        shader_debug_info: list[tuple[str, CachedAttachment]],
    ) -> dict[str, Any]:
        """Fallback: load bytes via the attachment cache and POST them inline.

        Used when any attachment lacks `stored_id` (legacy V1 storage,
        self-hosted Sentry without objectstore, or pre-rollout). Worker
        memory pressure is real here — one big crash can carry several
        hundred KB of `.nvdbg` payloads — but it's the only correct
        wire format until everything's on objectstore.
        """

        data: dict[str, str] = {
            "event_id": self.event_id,
            "project_id": str(self.project.id),
            "organization_id": str(self.project.organization_id),
        }
        # `requests` accepts a list-of-tuples for `files` to allow multiple
        # entries with different field names; that's the only way to send
        # N `nv_shader_debug.<uid>` fields per request.
        files: list[tuple[str, tuple[str, bytes, str]]] = [
            (
                "upload_file",
                ("dump.nv-gpudmp", dump.load_data(self.project), "application/octet-stream"),
            ),
        ]
        for uid, att in shader_debug_info:
            files.append(
                (
                    f"nv_shader_debug.{uid}",
                    (
                        f"{uid}.nvdbg",
                        att.load_data(self.project),
                        "application/octet-stream",
                    ),
                )
            )
        return self._send(url, headers=headers, data=data, files=files)

    def _send(
        self,
        url: str,
        headers: dict[str, str],
        data: Any = None,
        files: Any = None,
    ) -> dict[str, Any]:
        last_exc: Exception | None = None
        for attempt in range(MAX_ATTEMPTS):
            try:
                resp = requests.post(
                    url,
                    data=data,
                    files=files,
                    headers=headers,
                    timeout=DEFAULT_TIMEOUT,
                )
            except requests.RequestException as e:
                last_exc = e
                logger.info(
                    "teapot.request_exception",
                    extra={"attempt": attempt, "event_id": self.event_id, "error": str(e)},
                )
                continue

            if resp.status_code in RETRYABLE_STATUS:
                logger.info(
                    "teapot.retryable_status",
                    extra={
                        "attempt": attempt,
                        "event_id": self.event_id,
                        "status": resp.status_code,
                    },
                )
                continue

            if resp.status_code >= 400:
                logger.warning(
                    "teapot.request_failed",
                    extra={
                        "event_id": self.event_id,
                        "status": resp.status_code,
                        "body": resp.text[:512],
                    },
                )
                raise TeapotUnavailable(f"teapot returned {resp.status_code}: {resp.text[:256]}")

            try:
                return resp.json()
            except ValueError as e:
                raise TeapotUnavailable(f"teapot returned non-JSON body: {e}") from e

        msg = "teapot exhausted retries"
        if last_exc is not None:
            raise TeapotUnavailable(msg) from last_exc
        raise TeapotUnavailable(msg)


def submit_to_teapot(
    project: Any,
    event_id: str,
    dump: CachedAttachment,
    shader_debug_info: list[tuple[str, CachedAttachment]] | None = None,
) -> dict[str, Any] | None:
    """Best-effort teapot invocation. Returns None on any failure.

    Callers must treat a `None` return as "no enrichment available" and
    proceed as if the dump were never processed. Teapot failures never fail
    the primary event.
    """

    try:
        client = TeapotClient(project=project, event_id=event_id)
        return client.symbolicate(dump, shader_debug_info or [])
    except TeapotUnavailable as e:
        logger.info("teapot.unavailable", extra={"event_id": event_id, "error": str(e)})
        return None
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.warning("teapot.unexpected_error", extra={"event_id": event_id, "error": str(e)})
        return None
