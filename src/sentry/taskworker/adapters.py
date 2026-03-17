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
from taskbroker_client.metrics import MetricsBackend, Tags
from taskbroker_client.router import TaskRouter as LibraryRouter
from taskbroker_client.types import AtMostOnceStore

from sentry.conf.types.kafka_definition import Topic
from sentry.taskworker.router import DefaultRouter
from sentry.utils import metrics as sentry_metrics
from sentry.utils.arroyo_producer import get_arroyo_producer
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


class SentryRouter(DefaultRouter, LibraryRouter):
    """
    Router that satisfies taskbroker_client's TaskRouter protocol while using
    sentry's routing logic (settings, options, silo mode).
    """

    def route_namespace(self, name: str) -> str:  # type: ignore[override]
        return super().route_namespace(name).value


_producer_local = threading.local()


def make_producer(topic: str) -> KafkaProducer:
    """
    Producer factory for taskbroker-client.

    Returns a thread-local KafkaProducer for the given topic, creating one
    on first access.
    """
    if not hasattr(_producer_local, "producers"):
        _producer_local.producers = {}
    if topic not in _producer_local.producers:
        _producer_local.producers[topic] = get_arroyo_producer(
            f"sentry.taskworker.{topic}", Topic(topic)
        )
    return _producer_local.producers[topic]
