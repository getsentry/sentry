"""
Adapter implementations for taskbroker-client interfaces.

This module contains Sentry's concrete implementations of the abstract
interfaces defined by the taskbroker-client library.
"""

from __future__ import annotations

import contextlib
import logging
import threading
from collections.abc import MutableMapping
from typing import Any

import orjson
from arroyo.backends.kafka import KafkaProducer
from django.conf import settings
from django.core.cache.backends.base import BaseCache
from sentry_sdk import capture_exception
from taskbroker_client.metrics import DatadogMetrics, MetricsBackend, NoOpMetricsBackend
from taskbroker_client.router import TaskRouter as LibraryRouter
from taskbroker_client.types import AtMostOnceStore

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.silo.base import SiloMode
from sentry.utils import json
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.viewer_context import (
    ViewerContext,
    get_viewer_context,
    observe_viewer_context_propagation,
    viewer_context_scope,
)

logger = logging.getLogger(__name__)

# Map from namespaces to topics that ONLY applies to the current process (no global options)
_route_overrides: dict[str, str] = {}


#
def set_route_overrides(overrides: dict[str, str]) -> None:
    """
    Replace route overrides (`_route_overrides`) with the provided map.
    This change is local to the running application and does not impact global options.
    """
    _route_overrides.clear()
    _route_overrides.update(overrides)


class DjangoCacheAtMostOnceStore(AtMostOnceStore):
    """
    AtMostOnceStore implementation backed by Django's cache framework.

    Uses cache.add() which provides atomic set-if-not-exists semantics,
    returning True when the key was added and False when it already existed.
    """

    def __init__(self, cache_backend: BaseCache) -> None:
        self._cache = cache_backend

    def add(self, key: str, value: str, timeout: int) -> bool:
        return self._cache.add(key, value, timeout)


class SentryRouter(LibraryRouter):
    """Router that uses django settings and options to select topics at runtime."""

    def __init__(self) -> None:
        routes = {}
        if settings.TASKWORKER_ROUTES:
            try:
                routes = json.loads(settings.TASKWORKER_ROUTES)
            except Exception as err:
                capture_exception(err)
        self._route_map = routes
        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            # Control silos always use the control topic; the region default
            # topic override never applies to them.
            self._default_topic = Topic.TASKWORKER_CONTROL
        elif settings.TASKWORKER_DEFAULT_TOPIC:
            self._default_topic = Topic(settings.TASKWORKER_DEFAULT_TOPIC)
        else:
            self._default_topic = Topic.TASKWORKER

    def route_namespace(self, name: str) -> str:
        # Check local overrides
        if name in _route_overrides:
            return Topic(_route_overrides[name]).value

        # Check global overrides
        overrides = options.get("taskworker.route.overrides")

        if name in overrides:
            return Topic(overrides[name]).value

        # Check for configured mapping
        if name in self._route_map:
            return Topic(self._route_map[name]).value

        # Fall back onto the default topic
        return self._default_topic.value


class ViewerContextHook:
    """
    ContextHook that propagates ViewerContext through task headers.

    Uses a single JSON header, matching the RPC layer's serialization
    via ViewerContext.serialize() / ViewerContext.deserialize().
    """

    HEADER = "sentry-viewer-context"

    def on_dispatch(self, headers: MutableMapping[str, Any]) -> None:
        ctx = get_viewer_context()
        if ctx is None:
            return
        headers[self.HEADER] = orjson.dumps(ctx.serialize()).decode()

    def on_execute(self, headers: dict[str, str]) -> contextlib.AbstractContextManager[None]:
        raw = headers.get(self.HEADER)
        ctx: ViewerContext | None = None
        if raw:
            try:
                ctx = ViewerContext.deserialize(orjson.loads(raw))
            except (orjson.JSONDecodeError, TypeError, KeyError, AttributeError):
                logger.exception("Failed to deserialize viewer context header")
        # Only `expected=True` when dispatch actually sent the header. That distinguishes
        # the noise case (system task with no VC, header genuinely absent) from the bug
        # case (header sent but deserialization failed → ctx is None).
        observe_viewer_context_propagation(
            "task_execute",
            ctx=ctx,
            expected=bool(raw),
        )
        if ctx is None:
            return contextlib.nullcontext()
        return viewer_context_scope(ctx)


_producer_local = threading.local()


def make_producer(topic: str) -> SingletonProducer:
    """
    Producer factory for taskbroker-client.

    Returns a thread-local KafkaProducer for the given topic, creating one
    on first access.
    """
    if not hasattr(_producer_local, "producers"):
        _producer_local.producers = {}

    if topic not in _producer_local.producers:

        def factory() -> KafkaProducer:
            return get_arroyo_producer(f"sentry.taskworker.{topic}", Topic(topic))

        _producer_local.producers[topic] = SingletonProducer(
            factory, max_futures=options.get("taskworker.producer.max_futures")
        )
    return _producer_local.producers[topic]


def _extract_metrics_config() -> tuple[str | None, int | None]:
    host, port = None, None
    metric_options = settings.SENTRY_METRICS_OPTIONS
    try:
        if settings.SENTRY_METRICS_BACKEND == "sentry.metrics.dummy.DummyMetricsBackend":
            return host, port

        # For non-dummy implementations
        # Use the metrics settings options to infer the host/port.
        # The metrics options have different structures depending on which backend is used.
        if settings.SENTRY_METRICS_BACKEND == "sentry.metrics.dualwrite.DualWriteMetricsBackend":
            metric_options = settings.SENTRY_METRICS_OPTIONS["primary_backend_args"]

        # statsd backend uses `host` while datadog use `statsd_host`
        host = metric_options.get("statsd_host", None) or metric_options.get("host", None)
        raw_port = metric_options.get("statsd_port", None) or metric_options.get("port", None)
        if isinstance(raw_port, (str, int)):
            port = int(raw_port)
    except Exception as e:
        logger.warning("Could not extract metrics settings", extra={"error": str(e)})
    return host, port


def make_metrics() -> MetricsBackend:
    host, port = _extract_metrics_config()
    if host and port:
        # Metrics created by this interface will not
        # have `sentry.` prefix, and will not have
        # K8S_LABEL applied.
        return DatadogMetrics(
            application="sentry",
            statsd_host=host,
            statsd_port=port,
            sample_rate=settings.SENTRY_METRICS_SAMPLE_RATE,
        )
    return NoOpMetricsBackend()
