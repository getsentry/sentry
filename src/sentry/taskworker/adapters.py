"""
Adapter implementations for taskbroker-client interfaces.

This module contains Sentry's concrete implementations of the abstract
interfaces defined by the taskbroker-client library.
"""

from __future__ import annotations

import contextlib
import logging
import threading
import traceback as _traceback
from collections.abc import MutableMapping
from contextlib import contextmanager
from typing import Any, Generator

import orjson
import sentry_sdk
from arroyo.backends.kafka import KafkaProducer
from django.conf import settings
from django.core.cache.backends.base import BaseCache
from sentry_protos.taskbroker.v1.taskbroker_pb2 import TaskError
from sentry_sdk import capture_exception
from taskbroker_client.metrics import MetricsBackend, Tags
from taskbroker_client.router import TaskRouter as LibraryRouter
from taskbroker_client.types import AtMostOnceStore

from sentry import options
from sentry.conf.types.kafka_definition import Topic
from sentry.silo.base import SiloMode
from sentry.utils import json
from sentry.utils import metrics as sentry_metrics
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.memory import track_memory_usage as sentry_track_memory_usage
from sentry.viewer_context import (
    ViewerContext,
    get_viewer_context,
    observe_viewer_context_propagation,
    viewer_context_scope,
)

logger = logging.getLogger(__name__)


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


class SentryMetricsBackend(MetricsBackend):
    """
    MetricsBackend implementation that delegates to sentry.utils.metrics.
    """

    def incr(
        self,
        name: str,
        value: int | float = 1,
        tags: Tags | None = None,
        sample_rate: float | None = None,
    ) -> None:
        if sample_rate is None:
            sample_rate = settings.SENTRY_METRICS_SAMPLE_RATE
        sentry_metrics.incr(name, amount=int(value), tags=tags, sample_rate=sample_rate)

    def gauge(
        self,
        key: str,
        value: float,
        instance: str | None = None,
        tags: Tags | None = None,
        sample_rate: float | None = None,
        unit: str | None = None,
        stacklevel: int = 0,
    ) -> None:
        if sample_rate is None:
            sample_rate = settings.SENTRY_METRICS_SAMPLE_RATE

        return sentry_metrics.gauge(
            key,
            value,
            instance=instance,
            tags=tags,
            sample_rate=sample_rate,
            unit=unit,
            stacklevel=stacklevel,
        )

    def distribution(
        self,
        name: str,
        value: int | float,
        tags: Tags | None = None,
        unit: str | None = None,
        sample_rate: float | None = None,
    ) -> None:
        if sample_rate is None:
            sample_rate = settings.SENTRY_METRICS_SAMPLE_RATE
        sentry_metrics.distribution(
            name, value=value, tags=tags, unit=unit, sample_rate=sample_rate
        )

    @contextmanager
    def timer(
        self,
        key: str,
        tags: Tags | None = None,
        sample_rate: float | None = None,
        stacklevel: int = 0,
    ) -> Generator[None]:
        if sample_rate is None:
            sample_rate = settings.SENTRY_METRICS_SAMPLE_RATE
        with sentry_metrics.timer(key, tags=tags, sample_rate=sample_rate):
            yield

    @contextmanager
    def track_memory_usage(
        self,
        key: str,
        tags: Tags | None = None,
    ) -> Generator[None]:
        with sentry_track_memory_usage(key, tags=tags):
            yield


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
        self._default_topic = (
            Topic.TASKWORKER_CONTROL
            if SiloMode.get_current_mode() == SiloMode.CONTROL
            else Topic.TASKWORKER
        )

    def route_namespace(self, name: str) -> str:
        overrides = options.get("taskworker.route.overrides")
        if name in overrides:
            return Topic(overrides[name]).value
        if name in self._route_map:
            return Topic(self._route_map[name]).value
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

        # Only `expected=True` when dispatch actually sent the header.
        # That distinguishes the noise case (system task with no VC, header
        # genuinely absent) from the bug case (header sent but deserialization
        # failed → ctx is None).
        observe_viewer_context_propagation(
            "task_execute",
            ctx=ctx,
            expected=bool(raw),
        )
        if ctx is None:
            return contextlib.nullcontext()
        return viewer_context_scope(ctx)


def _qualified_type(exc: BaseException) -> str:
    cls = type(exc)
    return f"{cls.__module__}.{cls.__qualname__}"


def _task_meta_field(task_meta: object, field: str) -> str | None:
    value = getattr(task_meta, field, None)
    if value is not None:
        return str(value)

    activation = getattr(task_meta, "activation", None)
    if activation is not None:
        value = getattr(activation, field, None)
        if value is not None:
            return str(value)

    return None


def _log_value(value: object) -> str:
    return orjson.dumps("" if value is None else str(value)).decode()


def _smart_truncate(text: str, max_chars: int) -> str:
    """
    Truncates a string from the middle, preserving the head and tail.
    Ideal for tracebacks where the root cause (head) and final exception (tail) are most important.
    Note: The output may contain newlines and is meant for payloads (e.g., TaskError),
    not for structured log lines.
    """
    if len(text) <= max_chars:
        return text

    marker = "\n... <TRACEBACK TRUNCATED> ...\n"
    if max_chars <= len(marker) + 2:
        return text[:max_chars]

    keep_each = (max_chars - len(marker)) // 2
    return text[:keep_each] + marker + text[-keep_each:]


def _get_root_cause(exc: BaseException) -> BaseException:
    """
    Extracts the deepest root cause of an exception (chained exceptions).
    Includes cycle detection to prevent infinite loops, and respects
    Python's __suppress_context__ (e.g., raise ... from None).
    """
    root = exc
    seen: set[int] = set()
    while True:
        next_exc = root.__cause__
        if next_exc is None and not root.__suppress_context__:
            next_exc = root.__context__

        if next_exc is None or id(next_exc) in seen:
            return root

        seen.add(id(next_exc))
        root = next_exc


def _safe_capture_exception(exc: BaseException) -> None:
    """
    Safely captures an exception to Sentry without ever raising.
    Used within error hooks to ensure we never violate the 'Never raises' contract.
    """
    try:
        sentry_sdk.capture_exception(exc)
    except Exception:
        pass


class TaskErrorCaptureHook:
    """
    On a task exception:
      1. Ship a Sentry event tagged with task identifiers.
      2. Emit a structured log line containing the task context, the exception,
         and the root cause (if chained). We omit the full traceback from the logs
         to prevent multiline parsing issues and massive log volumes, relying on Sentry
         as the source of truth for stack traces.
      3. Return a size-bounded TaskError envelope (with a smartly truncated traceback)
         for the SetTaskStatus RPC.

    Redundant if taskbroker_client already captures internally; harmless.
    Never raises — a hook bug must not mask the original task exception.
    """

    # Character limits. The proto contract is "bounded"; the exact number is
    # backpressure against runaway payloads reaching the broker's logs and
    # Kafka, not an exact wire guarantee.
    MAX_MESSAGE_CHARS = 2_000
    MAX_TRACEBACK_CHARS = 8_000

    def on_exception(self, task_meta, exc: BaseException) -> TaskError | None:
        try:
            exc_type = _qualified_type(exc)
            task_id = _task_meta_field(task_meta, "id")
            taskname = _task_meta_field(task_meta, "taskname")
            namespace = _task_meta_field(task_meta, "namespace")
            exception_message = str(exc)[: self.MAX_MESSAGE_CHARS]

            # Always extract and log the root cause. If no chain exists, these will
            # duplicate the outer exception fields. This ensures a stable log schema.
            root_exc = _get_root_cause(exc)
            root_type = _qualified_type(root_exc)
            root_message = str(root_exc)[: self.MAX_MESSAGE_CHARS]

            try:
                with sentry_sdk.isolation_scope() as scope:
                    scope.set_tag("taskname", taskname or "")
                    scope.set_tag("namespace", namespace or "")
                    scope.set_tag("task_id", task_id or "")
                    sentry_sdk.capture_exception(exc)
            except Exception as capture_exc:
                _safe_capture_exception(capture_exc)
                try:
                    logger.error(
                        "taskworker.error_hook.capture_failed "
                        f"task_id={_log_value(task_id)} "
                        f"internal_error_type={_log_value(_qualified_type(capture_exc))} "
                        f"internal_error_message={_log_value(str(capture_exc))}"
                    )
                except Exception:
                    pass

            try:
                # Emit a clean, single-line log without raw exc_info tracebacks
                # to remain perfectly parseable by log aggregators like Vector.
                logger.error(
                    "taskworker.task_failed "
                    f"task_id={_log_value(task_id)} "
                    f"taskname={_log_value(taskname)} "
                    f"namespace={_log_value(namespace)} "
                    f"exception_type={_log_value(exc_type)} "
                    f"exception_message={_log_value(exception_message)} "
                    f"root_cause_type={_log_value(root_type)} "
                    f"root_cause_message={_log_value(root_message)}"
                )
            except Exception:
                pass

            try:
                tb_string = "".join(_traceback.format_exception(exc))
                tb_truncated = _smart_truncate(tb_string, self.MAX_TRACEBACK_CHARS)

                return TaskError(
                    exception_type=exc_type,
                    exception_message=exception_message,
                    traceback=tb_truncated,
                )
            except Exception as env_exc:
                _safe_capture_exception(env_exc)
                try:
                    logger.error(
                        "taskworker.error_hook.envelope_failed "
                        f"task_id={_log_value(task_id)} "
                        f"internal_error_type={_log_value(_qualified_type(env_exc))} "
                        f"internal_error_message={_log_value(str(env_exc))}"
                    )
                except Exception:
                    pass
                return None
        except Exception as hook_exc:
            _safe_capture_exception(hook_exc)
            try:
                logger.error(
                    "taskworker.error_hook.failed "
                    f"internal_error_type={_log_value(_qualified_type(hook_exc))} "
                    f"internal_error_message={_log_value(str(hook_exc))}"
                )
            except Exception:
                pass
            return None


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
