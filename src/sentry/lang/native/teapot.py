"""HTTP client for the teapot GPU crash dump symbolication service.

Teapot is a sibling to Symbolicator that decodes NVIDIA Aftermath `.nv-gpudmp`
dumps. It's synchronous (one request/response, no polling) with a bounded retry
on transient 5xx.

Attachments are always passed by reference: the dump and each shader-debug
`.nvdbg` live in objectstore, and we hand teapot a short-lived presigned GET URL
per attachment. Teapot fetches the bytes directly from objectstore; they never
pass through the Sentry worker, and no bearer token is exchanged (the presigned
URL is self-authenticating).
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

# teapot keys each shader debug attachment by its 32-hex `shader_debug_info_uid`
# — the value Aftermath asks for via `shaderDebugInfoLookupCb` at decode time.
# Relay preserves the SDK filename, which carries the uid in one of two shapes:
#   * `<32-hex-uid>.nvdbg`      — production SDKs ship the full uid.
#   * `<16-hex>-<16-hex>.nvdbg` — the NVIDIA D3D12HelloNsightAftermath sample
#                                 splits id[0]/id[1] with a dash; concatenate.
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
    """The ``CachedAttachment`` surface the client needs, as a structural type.

    Lets callers pass a real ``CachedAttachment`` or a test double. ``name`` is
    the attachment filename — for a shader-debug ``.nvdbg`` it carries the
    ``shader_debug_info_uid`` teapot looks the bytes back up by. ``stored_id`` is
    the objectstore key we presign; every GPU-crash attachment must be stored.
    """

    name: str
    stored_id: str | None


# Presigned GET URLs handed to teapot are valid just long enough to cover the
# request window (timeout x attempts + backoff), then expire.
_PRESIGNED_URL_TTL = timedelta(seconds=60)

# Fallbacks; live values come from the `teapot.timeout-seconds` /
# `teapot.max-attempts` options (see `_timeout` / `_max_attempts`). The decode is
# sub-second in practice, so the timeout is deliberately tight — a slow teapot
# should fail fast rather than hold a worker (and the circuit breaker takes over).
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
    # SENTRY_TEAPOT_URL (sourced from the TEAPOT env var) is the endpoint,
    # mirroring SENTRY_TEMPEST_URL / SENTRY_VROOM. The automator-modifiable
    # `teapot.options` url is a fallback for installs that don't set the env var.
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
            # event_id as idempotency key → teapot replays a cached 200 for a
            # retried task instead of re-decoding.
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
        """Short-lived, self-authenticating GET URL for the attachment in objectstore.

        This mirrors the internal-caller branch of
        ``objectstore.get_download_redirect_url`` (the recommended presigned-download
        path, already used for debug-file downloads). Teapot is an internal service
        like Symbolicator, so it reads straight from Objectstore's internal URL. We
        inline the branch rather than call the helper because it needs the
        ``HttpRequest`` it's redirecting to choose internal-vs-cell-proxy, and we're
        in a background task with no request. Presigned means teapot issues a plain
        GET with no auth header — unlike Symbolicator today, which still passes
        ``object_url`` + a minted bearer token.
        """
        if not att.stored_id:
            # GPU-crash attachments are always uploaded to objectstore; if one
            # isn't, we can't build a presigned URL, so skip rather than inline.
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
