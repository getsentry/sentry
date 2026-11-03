from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol


class DatadogStats(Protocol):
    _container_id: str | None

    def start(self) -> None: ...
    def stop(self) -> bool: ...
    def increment(
        self,
        metric_name: str,
        value: float | int = 1,
        timestamp: float | None = None,
        tags: Sequence[str] | None = None,
        sample_rate: float = 1,
        host: str | None = None,
    ) -> None: ...
    def decrement(
        self,
        metric_name: str,
        value: float | int = 1,
        timestamp: float | None = None,
        tags: Sequence[str] | None = None,
        sample_rate: float = 1,
        host: str | None = None,
    ) -> None: ...
    def timing(
        self,
        metric_name: str,
        value: float,
        timestamp: float | None = None,
        tags: Sequence[str] | None = None,
        sample_rate: float = 1,
        host: str | None = None,
    ) -> None: ...
    def gauge(
        self,
        metric_name: str,
        value: float,
        timestamp: float | None = None,
        tags: Sequence[str] | None = None,
        sample_rate: float = 1,
        host: str | None = None,
    ) -> None: ...
    def distribution(
        self,
        metric_name: str,
        value: float,
        timestamp: float | None = None,
        tags: Sequence[str] | None = None,
        sample_rate: float = 1,
        host: str | None = None,
    ) -> None: ...
    def set(
        self,
        metric_name: str,
        value: str | int,
        timestamp: float | None = None,
        tags: Sequence[str] | None = None,
        sample_rate: float = 1,
        host: str | None = None,
    ) -> None: ...
    def event(
        self,
        title: str,
        message: str,
        alert_type: str | None = None,
        aggregation_key: str | None = None,
        source_type_name: str | None = None,
        date_happened: int | None = None,
        priority: str | None = None,
        tags: Sequence[str] | None = None,
        hostname: str | None = None,
    ) -> None: ...
    def disable_telemetry(self) -> None: ...
    def enable_background_sender(
        self, sender_queue_size: int, sender_queue_timeout: int
    ) -> None: ...
    def wait_for_pending(self) -> None: ...
