"""
Adapter implementations for taskbroker-client interfaces.

This module contains Sentry's concrete implementations of the abstract
interfaces defined by the taskbroker-client library.
"""

from __future__ import annotations

import contextlib
import logging
import signal
import threading
from collections.abc import Iterator, MutableMapping
from typing import Any

import orjson
from arroyo.backends.kafka import KafkaProducer
from django.conf import settings
from django.core.cache.backends.base import BaseCache
from django.db import connections
from django.db.backends.base.base import BaseDatabaseWrapper
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

        self._route_map: dict[str, str] = routes
        self._default_topic: str = Topic.TASKWORKER.value

        if SiloMode.get_current_mode() == SiloMode.CONTROL:
            # Control silos always use the control topic
            # The region default topic override never applies to them
            self._default_topic = Topic.TASKWORKER_CONTROL.value
        elif settings.TASKWORKER_DEFAULT_TOPIC:
            self._default_topic = settings.TASKWORKER_DEFAULT_TOPIC

    def route_namespace(self, name: str) -> str:
        # Check local overrides
        if name in _route_overrides:
            return _route_overrides[name]

        # Check global overrides
        overrides = options.get("taskworker.route.overrides")

        if name in overrides:
            return overrides[name]

        # Check for configured mapping
        if name in self._route_map:
            return self._route_map[name]

        # Fall back onto the default topic
        return self._default_topic


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
            except (ValueError, TypeError, KeyError, AttributeError):
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


class LocalCacheClearHook:
    """
    ContextHook that clears process-local caches when a task finishes, so a
    later task in the same worker doesn't read options cached by an earlier one.
    """

    def on_dispatch(self, headers: MutableMapping[str, Any]) -> None:
        return None

    @contextlib.contextmanager
    def on_execute(self, headers: dict[str, str]) -> Iterator[None]:
        try:
            yield
        finally:
            clear_local_caches()


def clear_local_caches() -> None:
    """Clear the process-local option and group meta caches."""
    # Imported here because models can't be imported while the task app is set up.
    from sentry.models.groupmeta import GroupMeta
    from sentry.models.options.organization_option import OrganizationOption

    try:
        # Every OptionManager shares one process-local dict, so this clears the
        # organization, project and user option caches together.
        OrganizationOption.objects.clear_local_cache()
        GroupMeta.objects.clear_local_cache()
    except Exception:
        logger.exception("taskworker.clear_local_caches.failed")


class DatabaseConnectionResetHook:
    """
    Workers re-use database connections
    However, if a processing deadline is hit, it could happen in the middle of Django's transaction cleanup
    This leaves a connection mid-transaction and with auto-commit off, causing later tasks that
    re-use the connection to fail until the worker is recycled

    This hook makes it so that after every task, whether it failed or not, any connection left in a
    broken transaction state is closed, so the next task reconnects from a clean state

    Healthy connections are kept, even when the task failed. Closing them would make the next task
    reconnect, and when pgbouncer is at max_client_conn that reconnect is refused, fails the task,
    and would close everything again
    """

    def on_dispatch(self, headers: MutableMapping[str, Any]) -> None:
        return None

    @contextlib.contextmanager
    def on_execute(self, headers: dict[str, str]) -> Iterator[None]:
        try:
            yield
        finally:
            # A task can also catch the error a deadline leaves behind and still succeed
            reset_broken_database_connections()


def is_broken(connection: BaseDatabaseWrapper) -> bool:
    # No atomic block can legitimately be open, or owe commit hooks, once the task has exited
    if (
        connection.in_atomic_block
        or connection.needs_rollback
        or connection.closed_in_transaction
        or connection.run_on_commit
    ):
        return True

    # Read the attribute rather than get_autocommit(), which would open a connection
    return connection.connection is not None and not connection.autocommit


def reset_broken_database_connections() -> None:
    broken_connections = [
        connection for connection in connections.all(initialized_only=True) if is_broken(connection)
    ]

    if not broken_connections:
        return

    # It is possible for this step to get SIGALRM'd too, so delay it to the end of the function
    alarm_signal_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGALRM})

    try:
        for connection in broken_connections:
            reset_database_connection(connection)
    finally:
        # Immediately trigger a SIGALRM if one was pending
        signal.pthread_sigmask(signal.SIG_SETMASK, alarm_signal_mask)


def reset_database_connection(connection: BaseDatabaseWrapper) -> None:
    # Since we may have interrupted Django's transaction cleanup we
    # need to reset these flags
    # The test cases showcase why this is necessary
    connection.in_atomic_block = False
    connection.run_on_commit = []
    # Otherwise the closed connection still looks broken, and every later task resets it again
    connection.needs_rollback = False
    # close() is a no-op for a connection already closed inside an atomic block
    connection.closed_in_transaction = False

    connection.close()


_producers: dict[str, SingletonProducer] = {}
_producers_lock = threading.Lock()


def make_producer(topic: str) -> SingletonProducer:
    """
    Producer factory for taskbroker-client.

    Returns a process-wide KafkaProducer for the given topic, creating one
    on first access. Producers are safe to share across threads, thus there's
    no need for a threading.local instance.
    """
    with _producers_lock:
        producer = _producers.get(topic)
        if producer is None:

            def factory() -> KafkaProducer:
                return get_arroyo_producer(f"sentry.taskworker.{topic}", topic)

            producer = _producers[topic] = SingletonProducer(
                factory, max_futures=options.get("taskworker.producer.max_futures")
            )
        return producer


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
