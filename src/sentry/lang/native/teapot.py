"""HTTP client for the teapot GPU crash dump symbolication service.

Teapot is a sibling to Symbolicator: it decodes vendor-specific GPU crash
dumps (NVIDIA Aftermath `.nv-gpudmp` first, PIX / AMD RGP later) and returns
a structured JSON result that Sentry folds into the event.

Unlike Symbolicator, teapot is synchronous — one request, one response, no
polling. The client therefore skips the task-id / worker-id state that
`Symbolicator` carries and just runs a bounded retry on transient 5xx.
"""

from __future__ import annotations

import logging
from typing import Any

import orjson
import requests
import sentry_sdk
from django.conf import settings

from sentry import options
from sentry.lang.native.sources import sources_for_symbolication

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


class TeapotClient:
    """Synchronous HTTP client for POST /symbolicate.

    Usage:
        client = TeapotClient(project=project, event_id=event_id)
        response = client.symbolicate(dump_bytes)

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

    def symbolicate(self, dump_bytes: bytes) -> dict[str, Any]:
        sources, process_response = sources_for_symbolication(self.project)

        data = {
            "event_id": self.event_id,
            "project_id": str(self.project.id),
            "organization_id": str(self.project.organization_id),
            "sources": orjson.dumps(sources).decode(),
        }
        files = {
            "upload_file": (
                "dump.nv-gpudmp",
                dump_bytes,
                "application/octet-stream",
            ),
        }
        headers = {
            "X-Teapot-Version": "1",
            "X-Request-Id": self.event_id,
        }

        url = f"{self.base_url}/symbolicate"

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
                # Non-retryable error. Surface it via the warning log, then
                # capture the raw body for debugging and bail.
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
                payload = resp.json()
            except ValueError as e:
                raise TeapotUnavailable(f"teapot returned non-JSON body: {e}") from e

            return process_response(payload)

        msg = "teapot exhausted retries"
        if last_exc is not None:
            raise TeapotUnavailable(msg) from last_exc
        raise TeapotUnavailable(msg)


def submit_to_teapot(project: Any, event_id: str, dump_bytes: bytes) -> dict[str, Any] | None:
    """Best-effort teapot invocation. Returns None on any failure.

    Callers must treat a `None` return as "no enrichment available" and
    proceed as if the dump were never processed. Teapot failures never fail
    the primary event.
    """

    try:
        client = TeapotClient(project=project, event_id=event_id)
        return client.symbolicate(dump_bytes)
    except TeapotUnavailable as e:
        logger.info("teapot.unavailable", extra={"event_id": event_id, "error": str(e)})
        return None
    except Exception as e:
        sentry_sdk.capture_exception(e)
        logger.warning("teapot.unexpected_error", extra={"event_id": event_id, "error": str(e)})
        return None
