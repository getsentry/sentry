"""
Adapter implementations for taskbroker-client interfaces.

This module contains Sentry's concrete implementations of the abstract
interfaces defined by the taskbroker-client library.
"""

from __future__ import annotations

import threading
from contextlib import contextmanager
from typing import Generator

from arroyo.backends.kafka import KafkaProducer
from django.conf import settings
from django.core.cache.backends.base import BaseCache
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
