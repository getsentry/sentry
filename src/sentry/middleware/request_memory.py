"""
Reports requests that grow the worker's resident memory by a lot.

granian replaces a web worker once its RSS stays over `workers_max_rss`. A
worker's RSS rarely goes back down, because the allocator keeps freed memory,
so one request that briefly allocates hundreds of megabytes can end the
worker. This middleware names those requests.

It reads the process RSS before and after each request. When the request grew
it by at least the threshold, it logs `request.rss_growth` and emits
`middleware.request_rss_growth` (megabytes), tagged with the URL name and, for
internal RPC calls, the RPC method.

The log line adds context for finding what made the request large: duration,
status, request and response sizes, user agent, webhook event type, the
organization from the URL, and the values of a few paging and dataset query
parameters (`_LOGGED_QUERY_PARAMS`; for others, such as a search query, only
the length). It also records how many requests the worker had served and its
uptime, since a new worker's first requests grow RSS while it warms up;
requests in a worker's first `_WARMUP_REQUESTS` requests or `_WARMUP_SECONDS`
seconds are tagged `warmup`, on the metric and the log line.

RSS belongs to the whole process, so a request that overlaps others on the
same worker can be blamed for their allocations too. The `concurrent` tag and
the `overlapping_requests` log field mark those.

This is off by default. Set `SENTRY_REQUEST_RSS_METRICS=1` (or true/yes/on) in
a web process's environment to turn it on, and optionally
`SENTRY_REQUEST_RSS_THRESHOLD_MB` (default 100). Both are read when the
middleware is created, at worker start. When off, Django drops the middleware
from the stack, so it costs nothing per request. When on, it costs two short
reads of /proc/self/statm and two clock reads per request.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from collections.abc import Callable
from typing import Any

from django.core.exceptions import MiddlewareNotUsed
from django.http.request import HttpRequest
from django.http.response import HttpResponse, HttpResponseBase

from sentry.utils import metrics

logger = logging.getLogger(__name__)

ENABLE_ENV_VAR = "SENTRY_REQUEST_RSS_METRICS"
THRESHOLD_ENV_VAR = "SENTRY_REQUEST_RSS_THRESHOLD_MB"
DEFAULT_THRESHOLD_MB = 100
# The true spellings of sentry.utils.types.Bool.
_ENABLED_VALUES = frozenset(("1", "true", "t", "yes", "y", "on"))
_STATM_PATH = "/proc/self/statm"
_MB = 1024 * 1024
# Query parameters whose values are logged. Anything else, such as a search
# query, could hold user input, so only its presence or length is logged.
_LOGGED_QUERY_PARAMS = (
    "per_page",
    "limit",
    "full",
    "dataset",
    "sort",
    "expand",
    "collapse",
    "statsPeriod",
    "referrer",
)
_MAX_LOGGED_VALUE_LENGTH = 200
# A worker's first requests grow RSS while it imports modules and fills
# caches. Requests within either limit are tagged `warmup` so they can be
# told apart from real offenders.
_WARMUP_REQUESTS = 10
_WARMUP_SECONDS = 60
# Headers that name the event type of an incoming integration webhook.
_WEBHOOK_EVENT_HEADERS = ("X-GitHub-Event", "X-Gitlab-Event", "X-Event-Key")


def is_enabled() -> bool:
    return os.environ.get(ENABLE_ENV_VAR, "").strip().lower() in _ENABLED_VALUES


def threshold_bytes() -> int:
    raw = os.environ.get(THRESHOLD_ENV_VAR, "").strip()
    try:
        megabytes = int(raw) if raw else DEFAULT_THRESHOLD_MB
    except ValueError:
        megabytes = DEFAULT_THRESHOLD_MB
    return max(megabytes, 1) * _MB


def read_rss_bytes() -> int:
    # The second field of statm is resident pages.
    with open(_STATM_PATH, "rb") as f:
        resident_pages = int(f.read().split()[1])
    return resident_pages * os.sysconf("SC_PAGE_SIZE")


def _query_context(request: HttpRequest) -> dict[str, Any]:
    # Flat keys, so each one is a queryable log attribute.
    params = request.GET
    context: dict[str, Any] = {
        f"param_{name}": params.get(name, "")[:_MAX_LOGGED_VALUE_LENGTH]
        for name in _LOGGED_QUERY_PARAMS
        if name in params
    }
    if "field" in params:
        context["field_count"] = len(params.getlist("field"))
    if "query" in params:
        context["query_length"] = len(params.get("query", ""))
    return context


def _webhook_event(request: HttpRequest) -> str | None:
    for header in _WEBHOOK_EVENT_HEADERS:
        value = request.headers.get(header)
        if value:
            return value[:_MAX_LOGGED_VALUE_LENGTH]
    return None


def _request_bytes(request: HttpRequest) -> int | None:
    try:
        return int(request.META.get("CONTENT_LENGTH") or "")
    except ValueError:
        return None


def _response_bytes(response: HttpResponseBase | None) -> int | None:
    # Streaming responses haven't produced their body yet.
    if isinstance(response, HttpResponse):
        return len(response.content)
    return None


def _rpc_method(request: HttpRequest) -> str | None:
    match = request.resolver_match
    if match is None:
        return None
    service_name = match.kwargs.get("service_name")
    method_name = match.kwargs.get("method_name")
    if not service_name or not method_name:
        return None
    return f"{service_name}.{method_name}"


class RequestMemoryMiddleware:
    def __init__(
        self,
        get_response: Callable[[HttpRequest], HttpResponseBase],
        read_rss: Callable[[], int] = read_rss_bytes,
    ) -> None:
        if not is_enabled():
            raise MiddlewareNotUsed
        try:
            read_rss()
        except (OSError, ValueError, IndexError):
            # No /proc on this platform, e.g. macOS.
            raise MiddlewareNotUsed
        self.get_response = get_response
        self.read_rss = read_rss
        self.threshold = threshold_bytes()
        self._lock = threading.Lock()
        self._inflight = 0
        self._started = 0
        self._created_at = time.monotonic()

    def _try_read_rss(self) -> int | None:
        # A failed read must never fail the request or mask its exception.
        try:
            return self.read_rss()
        except (OSError, ValueError, IndexError):
            return None

    def __call__(self, request: HttpRequest) -> HttpResponseBase:
        with self._lock:
            self._inflight += 1
            self._started += 1
            inflight_at_start = self._inflight
            started_at_start = self._started
        before = self._try_read_rss()
        start = time.monotonic()
        response: HttpResponseBase | None = None
        try:
            response = self.get_response(request)
            return response
        finally:
            duration = time.monotonic() - start
            after = self._try_read_rss()
            with self._lock:
                self._inflight -= 1
                # Requests already running when this one started, plus any
                # that started while it ran.
                overlapping = inflight_at_start - 1 + self._started - started_at_start
            if before is not None and after is not None and after - before >= self.threshold:
                # Reporting runs in `finally`, so it must never fail the
                # request or mask the view's exception.
                try:
                    self._report(
                        request,
                        response,
                        before,
                        after,
                        overlapping,
                        duration=duration,
                        worker_request_number=started_at_start,
                        worker_uptime=time.monotonic() - self._created_at,
                    )
                except Exception:
                    logger.exception("request.rss_growth.report_failed")

    def _report(
        self,
        request: HttpRequest,
        response: HttpResponseBase | None,
        before: int,
        after: int,
        overlapping: int,
        *,
        duration: float,
        worker_request_number: int,
        worker_uptime: float,
    ) -> None:
        match = request.resolver_match
        url_name = (match.url_name if match else None) or "unknown"
        rpc_method = _rpc_method(request)
        growth_mb = (after - before) // _MB
        warmup = worker_request_number <= _WARMUP_REQUESTS or worker_uptime < _WARMUP_SECONDS
        tags = {
            "url_name": url_name,
            "rpc_method": rpc_method or "none",
            "concurrent": "true" if overlapping > 0 else "false",
            "warmup": "true" if warmup else "false",
        }
        # These are rare, so record every one instead of the default sample rate.
        metrics.distribution(
            "middleware.request_rss_growth",
            growth_mb,
            tags=tags,
            sample_rate=1.0,
            unit="megabyte",
        )
        organization = match.kwargs.get("organization_id_or_slug") if match else None
        logger.info(
            "request.rss_growth",
            extra={
                "url_name": url_name,
                "rpc_method": rpc_method,
                "method": request.method,
                "rss_before_mb": before // _MB,
                "rss_after_mb": after // _MB,
                "growth_mb": growth_mb,
                "overlapping_requests": overlapping,
                "duration_ms": int(duration * 1000),
                "status_code": response.status_code if response is not None else None,
                "request_bytes": _request_bytes(request),
                "response_bytes": _response_bytes(response),
                "user_agent": request.headers.get("User-Agent", "")[:_MAX_LOGGED_VALUE_LENGTH],
                "webhook_event": _webhook_event(request),
                "organization": organization,
                **_query_context(request),
                "worker_request_number": worker_request_number,
                "worker_uptime_s": int(worker_uptime),
                "warmup": warmup,
            },
        )
