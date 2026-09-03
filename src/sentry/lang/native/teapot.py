"""HTTP client for teapot, the NVIDIA Aftermath ``.nv-gpudmp`` decode service.

Synchronous request/response with a bounded retry on transient 5xx. Attachments
are passed by reference: we hand teapot a short-lived self-authenticating
(presigned) GET URL per attachment — the read-only token is embedded in the URL's
query string, so teapot fetches the bytes from objectstore itself with no bearer
token, and the bytes never pass through the worker.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import re
from collections.abc import Sequence
from typing import Any, Protocol

import orjson
import requests
import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.objectstore import UsecaseId, get_internal_download_url, get_session
from sentry.utils import metrics
from sentry.utils.retries import ConditionalRetryPolicy

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


# Fallbacks for the `teapot.timeout-seconds` / `teapot.max-attempts` options.
# The timeout is tight on purpose: decode is sub-second, so a slow teapot should
# fail fast (the circuit breaker then takes over) rather than hold a worker.
DEFAULT_TIMEOUT = 5
DEFAULT_MAX_ATTEMPTS = 2

RETRYABLE_STATUS = (502, 503, 504)

# Bounded exponential backoff between transient retries.
RETRY_BACKOFF_SECONDS = 0.5
RETRY_BACKOFF_MAX_SECONDS = 4.0


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
    """Teapot is unreachable or erroring (network, timeout, exhausted 5xx retries,
    malformed body) — a genuine outage. The caller trips the circuit breaker."""


class TeapotRequestError(Exception):
    """This request can't succeed regardless of teapot's health: the URL isn't
    configured, an attachment is missing from objectstore, or teapot rejected the
    request (4xx). NOT an outage — the caller skips without tripping the breaker."""


class _RetryableTeapotError(TeapotUnavailable):
    """Internal marker for a transient failure (network error or retryable 5xx).
    The retry policy retries on it; once attempts are exhausted it surfaces to the
    caller as its ``TeapotUnavailable`` base — an outage that trips the breaker."""


# Presigned objectstore URLs carry a short-lived read token in their query string.
# teapot may echo our request body back in an error response, so strip query strings
# from any URL before it reaches the logs (log retention can outlive the token TTL).
_URL_QUERY_RE = re.compile(r"(https?://[^\s\"']+?)\?[^\s\"']*")


def _redact_urls(text: str) -> str:
    return _URL_QUERY_RE.sub(r"\1?<redacted>", text)


def _resolve_url() -> str | None:
    base = getattr(settings, "SENTRY_TEAPOT_URL", None)
    return base.rstrip("/") if base else None


def _auth_headers(body: bytes) -> dict[str, str]:
    """HMAC-sign the request body with the shared secret"""
    secret = getattr(settings, "SENTRY_TEAPOT_SHARED_SECRET", "")
    if not secret:
        metrics.incr("tasks.gpu_crash.teapot_unsigned_request")
        return {}
    signature = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return {"Authorization": f"Rpcsignature rpc0:{signature}"}


class TeapotClient:
    """Synchronous HTTP client for POST /symbolicate."""

    def __init__(self, project: Any, event_id: str) -> None:
        base_url = _resolve_url()
        if not base_url:
            raise TeapotRequestError("teapot url not configured")
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

        session = get_session(UsecaseId.ATTACHMENTS, self.project)
        body: dict[str, Any] = {
            "event_id": self.event_id,
            "project_id": str(self.project.id),
            "organization_id": str(self.project.organization_id),
            "dump": {"storage_url": self._storage_url(session, dump)},
            "shader_debug_info": [
                {
                    "uid": _uid_from_nvdbg_filename(att.name) or att.name,
                    "storage_url": self._storage_url(session, att),
                }
                for att in shader_debug_info
            ],
        }
        data = orjson.dumps(body)
        headers = {
            "X-Teapot-Version": "1",
            "X-Request-Id": self.event_id,
            "Content-Type": "application/json",
            "Idempotency-Key": self.event_id,
            **_auth_headers(data),
        }
        return self._send(url, headers=headers, data=data)

    def _storage_url(self, session: Any, att: TeapotAttachment) -> str:
        """Short-lived self-authenticating (presigned) GET URL for the attachment —
        the shared internal objectstore helper (direct link, no auth header)."""
        if not att.stored_id:
            raise TeapotRequestError(f"attachment {att.name!r} is not in objectstore")
        return get_internal_download_url(session, att.stored_id)

    def _send(self, url: str, headers: dict[str, str], data: bytes) -> dict[str, Any]:
        def attempt() -> dict[str, Any]:
            try:
                resp = requests.post(url, data=data, headers=headers, timeout=_timeout())
            except requests.RequestException as e:
                raise _RetryableTeapotError(f"teapot request failed: {e}") from e

            if resp.status_code in RETRYABLE_STATUS:
                raise _RetryableTeapotError(f"teapot returned {resp.status_code}")

            if resp.status_code >= 400:
                safe_body = _redact_urls(resp.text[:512])
                logger.warning(
                    "teapot.request_failed",
                    extra={
                        "event_id": self.event_id,
                        "status": resp.status_code,
                        "body": safe_body,
                    },
                )
                # A 4xx means teapot rejected this request but is itself healthy;
                # only a 5xx (retryable ones are handled above) is an outage.
                detail = f"teapot returned {resp.status_code}: {safe_body[:256]}"
                if resp.status_code < 500:
                    raise TeapotRequestError(detail)
                raise TeapotUnavailable(detail)

            try:
                return resp.json()
            except ValueError as e:
                raise TeapotUnavailable(f"teapot returned non-JSON body: {e}") from e

        attempts = _max_attempts()

        def should_retry(i: int, exc: Exception) -> bool:
            return i < attempts and isinstance(exc, _RetryableTeapotError)

        def backoff(i: int) -> float:
            return min(RETRY_BACKOFF_SECONDS * 2 ** (i - 1), RETRY_BACKOFF_MAX_SECONDS)

        try:
            return ConditionalRetryPolicy(should_retry, backoff)(attempt)
        except _RetryableTeapotError as e:
            raise TeapotUnavailable("teapot exhausted retries") from e


def submit_to_teapot(
    project: Any,
    event_id: str,
    dump: TeapotAttachment,
    shader_debug_info: Sequence[TeapotAttachment] | None = None,
) -> dict[str, Any] | None:
    """Best-effort teapot invocation.

    Returns the decode on success, or None on a request/data error (unconfigured
    URL, missing attachment, 4xx) — teapot is healthy, so the caller should not
    trip the circuit breaker. Raises ``TeapotUnavailable`` on a genuine outage
    (network, timeout, 5xx) so the caller can.
    """

    try:
        client = TeapotClient(project=project, event_id=event_id)
        return client.symbolicate(dump, shader_debug_info or [])
    except TeapotRequestError as e:
        logger.info("teapot.request_error", extra={"event_id": event_id, "error": str(e)})
        return None
    except TeapotUnavailable:
        raise  # a real outage — let the caller trip the breaker
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.warning("teapot.unexpected_error", extra={"event_id": event_id, "error": str(e)})
        return None
