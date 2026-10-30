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

RSS belongs to the whole process, so a request that overlaps others on the
same worker can be blamed for their allocations too. The `concurrent` tag and
the `overlapping_requests` log field mark those.

This is off by default. Set `SENTRY_REQUEST_RSS_METRICS=1` (or true/yes/on) in
a web process's environment to turn it on, and optionally
`SENTRY_REQUEST_RSS_THRESHOLD_MB` (default 100). Both are read when the
middleware is created, at worker start. When off, Django drops the middleware
from the stack, so it costs nothing per request. When on, it costs two short
reads of /proc/self/statm per request.
"""

from __future__ import annotations

import logging
import os
import threading
from collections.abc import Callable

from django.core.exceptions import MiddlewareNotUsed
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry.utils import metrics

logger = logging.getLogger(__name__)

ENABLE_ENV_VAR = "SENTRY_REQUEST_RSS_METRICS"
THRESHOLD_ENV_VAR = "SENTRY_REQUEST_RSS_THRESHOLD_MB"
DEFAULT_THRESHOLD_MB = 100
# The true spellings of sentry.utils.types.Bool.
_ENABLED_VALUES = frozenset(("1", "true", "t", "yes", "y", "on"))
_STATM_PATH = "/proc/self/statm"
_MB = 1024 * 1024


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
        try:
            return self.get_response(request)
        finally:
            after = self._try_read_rss()
            with self._lock:
                self._inflight -= 1
                # Requests already running when this one started, plus any
                # that started while it ran.
                overlapping = inflight_at_start - 1 + self._started - started_at_start
            if before is not None and after is not None and after - before >= self.threshold:
                self._report(request, before, after, overlapping)

    def _report(self, request: HttpRequest, before: int, after: int, overlapping: int) -> None:
        match = request.resolver_match
        url_name = (match.url_name if match else None) or "unknown"
        rpc_method = _rpc_method(request)
        growth_mb = (after - before) // _MB
        tags = {
            "url_name": url_name,
            "rpc_method": rpc_method or "none",
            "concurrent": "true" if overlapping > 0 else "false",
        }
        metrics.distribution("middleware.request_rss_growth", growth_mb, tags=tags, unit="megabyte")
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
            },
        )
