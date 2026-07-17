"""HTTP client for the teapot GPU crash dump symbolication service.

Teapot is a sibling to Symbolicator that decodes NVIDIA Aftermath `.nv-gpudmp`
dumps. It's synchronous (one request/response, no polling) with a bounded retry
on transient 5xx. Two wire formats, picked per request:

* JSON + storage_url + token when every attachment is in objectstore (bytes
  stay in objectstore, mirroring Symbolicator's minidump path).
* multipart raw bytes otherwise (legacy V1 storage / self-hosted).
"""

from __future__ import annotations

import logging
import time
from collections.abc import Iterable, Sequence
from typing import Any, Protocol

import orjson
import requests
import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.objectstore import get_attachments_session, get_symbolicator_url

logger = logging.getLogger(__name__)


class TeapotAttachment(Protocol):
    """The ``CachedAttachment`` surface the client needs, as a structural type.

    Lets callers pass a real ``CachedAttachment``, the ``EventAttachment``
    adapter from the async task, or a test double. ``name`` is the attachment
    filename — for a shader-debug ``.nvdbg`` it carries the
    ``shader_debug_info_uid`` teapot looks the bytes back up by.
    """

    name: str
    stored_id: str | None

    def load_data(self, project: Any) -> bytes: ...


def _require_stored_id(att: TeapotAttachment) -> str:
    # Only the JSON path calls this, gated on `_all_stored`; narrows str | None.
    assert att.stored_id is not None
    return att.stored_id


# Fallbacks; live values come from the `teapot.timeout-seconds` /
# `teapot.max-attempts` options (see `_timeout` / `_max_attempts`).
DEFAULT_TIMEOUT = 25
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


def _all_stored(dump: TeapotAttachment, shader_debug_info: Iterable[TeapotAttachment]) -> bool:
    # JSON path requires every attachment in objectstore; else fall to multipart.
    if not dump.stored_id:
        return False
    return all(att.stored_id for att in shader_debug_info)


class TeapotClient:
    """Synchronous HTTP client for POST /symbolicate.

    `shader_debug_info` is the list of shader-debug `.nvdbg` attachments (one per
    shader; an empty list is fine) — teapot recovers each shader's uid from the
    attachment filename. Raises `TeapotUnavailable` on network errors or
    exhausted 5xx retries — callers treat that as "skip", never fatal.
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
            # event_id as idempotency key → teapot replays a cached 200 for a
            # retried task instead of re-decoding.
            "Idempotency-Key": self.event_id,
        }

        if _all_stored(dump, shader_debug_info):
            return self._post_json(url, headers, dump, shader_debug_info)
        return self._post_multipart(url, headers, dump, shader_debug_info)

    def _post_json(
        self,
        url: str,
        headers: dict[str, str],
        dump: TeapotAttachment,
        shader_debug_info: Sequence[TeapotAttachment],
    ) -> dict[str, Any]:
        """Pass attachments to teapot by reference — bytes stay in objectstore."""

        session = get_attachments_session(self.project.organization_id, self.project.id)
        dump_url = get_symbolicator_url(session, _require_stored_id(dump))
        body: dict[str, Any] = {
            "event_id": self.event_id,
            "project_id": str(self.project.id),
            "organization_id": str(self.project.organization_id),
            "dump": {
                "storage_url": dump_url,
                "storage_token": session.mint_token(),
            },
            "shader_debug_info": [
                {
                    "filename": att.name,
                    "storage_url": get_symbolicator_url(session, _require_stored_id(att)),
                    "storage_token": session.mint_token(),
                }
                for att in shader_debug_info
            ],
        }
        return self._send(
            url, headers={**headers, "Content-Type": "application/json"}, data=orjson.dumps(body)
        )

    def _post_multipart(
        self,
        url: str,
        headers: dict[str, str],
        dump: TeapotAttachment,
        shader_debug_info: Sequence[TeapotAttachment],
    ) -> dict[str, Any]:
        """Fallback: load bytes and POST them inline when not all in objectstore."""

        data: dict[str, str] = {
            "event_id": self.event_id,
            "project_id": str(self.project.id),
            "organization_id": str(self.project.organization_id),
        }
        # A repeated `nv_shader_debug` field per shader; the part filename carries
        # the uid teapot decodes it by. A list-of-tuples lets the field repeat.
        files: list[tuple[str, tuple[str, bytes, str]]] = [
            (
                "upload_file",
                ("dump.nv-gpudmp", dump.load_data(self.project), "application/octet-stream"),
            ),
        ]
        for att in shader_debug_info:
            files.append(
                (
                    "nv_shader_debug",
                    (
                        att.name,
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
        timeout = _timeout()
        attempts = _max_attempts()
        for attempt in range(attempts):
            try:
                resp = requests.post(
                    url,
                    data=data,
                    files=files,
                    headers=headers,
                    timeout=timeout,
                )
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
