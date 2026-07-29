"""HTTP client for teapot, the NVIDIA Aftermath ``.nv-gpudmp`` decode service.

Synchronous request/response with a bounded retry on transient 5xx. Attachments
are passed by reference: we hand teapot a short-lived presigned GET URL per
attachment and it fetches the bytes from objectstore itself (self-authenticating
URL, no bearer token, bytes never pass through the worker).
"""

from __future__ import annotations

import logging
import re
import time
from collections.abc import Sequence
from datetime import timedelta
from typing import Any, Protocol

import orjson
import requests
import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.objectstore import get_attachments_session, maybe_rewrite_url_for_symbolicator

logger = logging.getLogger(__name__)

# teapot keys each shader by its 32-hex `shader_debug_info_uid`, which the SDK
# encodes in the `.nvdbg` filename as either `<32-hex>.nvdbg` or (the NVIDIA
# sample's) dash-split `<16-hex>-<16-hex>.nvdbg`.
_NVDBG_UID_RE = re.compile(r"([0-9a-fA-F]{32})\.nvdbg$")
_NVDBG_SPLIT_UID_RE = re.compile(r"([0-9a-fA-F]{16})-([0-9a-fA-F]{16})\.nvdbg$")


def _uid_from_nvdbg_filename(name: str) -> str | None:
    """Recover the 32-hex `shader_debug_info_uid` from a `.nvdbg` filename, or None."""
    m = _NVDBG_UID_RE.search(name)
    if m is not None:
        return m.group(1).lower()
    m = _NVDBG_SPLIT_UID_RE.search(name)
    if m is not None:
        return (m.group(1) + m.group(2)).lower()
    return None


class TeapotAttachment(Protocol):
    """The ``CachedAttachment`` surface the client needs (real or test double):
    ``name`` (the filename, carrying the uid for a ``.nvdbg``) and ``stored_id``
    (the objectstore key we presign)."""

    name: str
    stored_id: str | None


# Presigned URLs live just long enough to cover the request window, then expire.
_PRESIGNED_URL_TTL = timedelta(seconds=60)

# Fallbacks for the `teapot.timeout-seconds` / `teapot.max-attempts` options.
# The timeout is tight on purpose: decode is sub-second, so a slow teapot should
# fail fast (the circuit breaker then takes over) rather than hold a worker.
DEFAULT_TIMEOUT = 5
DEFAULT_MAX_ATTEMPTS = 2

RETRYABLE_STATUS = (502, 503, 504)

# Bounded exponential backoff between transient retries.
RETRY_BACKOFF_SECONDS = 0.5
RETRY_BACKOFF_MAX_SECONDS = 4.0


def _sleep_before_retry(attempt: int, attempts: int) -> None:
    """Back off before the next attempt; no-op after the final one."""
    if attempt + 1 >= attempts:
        return
    time.sleep(min(RETRY_BACKOFF_SECONDS * (2**attempt), RETRY_BACKOFF_MAX_SECONDS))


def _timeout() -> int:
    try:
        return int(options.get("teapot.timeout-seconds")) or DEFAULT_TIMEOUT
    except Exception:
        return DEFAULT_TIMEOUT


def _max_attempts() -> int:
    try:
        return max(1, int(options.get("teapot.max-attempts")))
    except Exception:
        return DEFAULT_MAX_ATTEMPTS


class TeapotUnavailable(Exception):
    """Teapot is down or returned a non-retryable error. Caller should swallow."""


def _resolve_url() -> str | None:
    base = getattr(settings, "SENTRY_TEAPOT_URL", None)
    if base:
        return base.rstrip("/")
    configured = options.get("teapot.options") or {}
    url = configured.get("url") if isinstance(configured, dict) else None
    return url.rstrip("/") if url else None


class TeapotClient:
    """Synchronous HTTP client for POST /symbolicate.

    Every attachment (the `.nv-gpudmp` and each shader-debug `.nvdbg`) must be in
    objectstore; teapot fetches them by presigned URL. Raises `TeapotUnavailable`
    on network errors, exhausted 5xx retries, or an attachment missing from
    objectstore — callers treat that as "skip", never fatal.
    """

    def __init__(self, project: Any, event_id: str) -> None:
        base_url = _resolve_url()
        if not base_url:
            raise TeapotUnavailable("SENTRY_TEAPOT_URL not configured")
        self.base_url = base_url
        self.project = project
        self.event_id = event_id

    def symbolicate(
        self,
        dump: TeapotAttachment,
        shader_debug_info: Sequence[TeapotAttachment] | None = None,
    ) -> dict[str, Any]:
        shader_debug_info = shader_debug_info or []
        url = f"{self.base_url}/symbolicate"
        headers = {
            "X-Teapot-Version": "1",
            "X-Request-Id": self.event_id,
            "Content-Type": "application/json",
            "Idempotency-Key": self.event_id,
        }

        session = get_attachments_session(self.project.organization_id, self.project.id)
        body: dict[str, Any] = {
            "event_id": self.event_id,
            "project_id": str(self.project.id),
            "organization_id": str(self.project.organization_id),
            "dump": {"storage_url": self._presigned_url(session, dump)},
            "shader_debug_info": [
                {
                    "uid": _uid_from_nvdbg_filename(att.name) or att.name,
                    "storage_url": self._presigned_url(session, att),
                }
                for att in shader_debug_info
            ],
        }
        return self._send(url, headers=headers, data=orjson.dumps(body))

    def _presigned_url(self, session: Any, att: TeapotAttachment) -> str:
        """Short-lived self-authenticating GET URL for the attachment in objectstore.

        Mirrors the internal-caller branch of
        ``objectstore.get_download_redirect_url``, inlined because that helper
        needs an ``HttpRequest`` and we're in a background task.
        """
        if not att.stored_id:
            raise TeapotUnavailable(f"attachment {att.name!r} is not in objectstore")
        return maybe_rewrite_url_for_symbolicator(
            session.presigned_object_url("GET", att.stored_id, duration=_PRESIGNED_URL_TTL)
        )

    def _send(self, url: str, headers: dict[str, str], data: bytes) -> dict[str, Any]:
        last_exc: Exception | None = None
        timeout = _timeout()
        attempts = _max_attempts()
        for attempt in range(attempts):
            try:
                resp = requests.post(url, data=data, headers=headers, timeout=timeout)
            except requests.RequestException as e:
                last_exc = e
                logger.info(
                    "teapot.request_exception",
                    extra={"attempt": attempt, "event_id": self.event_id, "error": str(e)},
                )
                _sleep_before_retry(attempt, attempts)
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
                _sleep_before_retry(attempt, attempts)
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
    dump: TeapotAttachment,
    shader_debug_info: Sequence[TeapotAttachment] | None = None,
) -> dict[str, Any] | None:
    """Best-effort teapot invocation. Returns None on any failure."""

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
