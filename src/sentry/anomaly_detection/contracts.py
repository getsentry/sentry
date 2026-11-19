"""Shared data for aggregate series, change episodes, and anomaly groups."""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from functools import cached_property
from typing import Any


@dataclass(frozen=True, order=True)
class SeriesKey:
    project: str  # Stringified project ID, scoped to the current organization.
    env: str
    signal: str
    metric: str
    dim_value: str = ""  # Empty means a project/environment total.

    def __str__(self) -> str:
        dim = f"[{self.dim_value}]" if self.dim_value else ""
        return f"{self.project}/{self.env} {self.signal}{dim} {self.metric}"


@dataclass(frozen=True)
class ExpectedValue:
    key: SeriesKey
    ts: datetime
    expected: float
    recent_actuals: tuple[float | None, ...]
    point_count: int
    _estimate_band: Callable[[], tuple[float, float, float]] = field(repr=False, compare=False)

    @cached_property
    def _band(self) -> tuple[float, float, float]:
        # Most observations don't pass the ratio test, so never need log-space MAD.
        return self._estimate_band()

    @property
    def sigma(self) -> float:
        return self._band[0]

    @property
    def lower(self) -> float:
        return self._band[1]

    @property
    def upper(self) -> float:
        return self._band[2]


class ChangeType(StrEnum):
    SPIKE = "spike"
    DROP = "drop"
    SLOWDOWN = "slowdown"
    CHANGE_POINT = "change_point"
    FLAG_REGRESSION = "flag_regression"
    NEW_FAILURE_MODE = "new_failure_mode"
    SILENCE = "silence"


@dataclass
class ChangeEvent:
    key: SeriesKey
    change_type: ChangeType
    start: datetime
    actual: float
    expected: float
    confidence: float
    evidence: list[str] = field(default_factory=list)
    detected_at: datetime | None = None
    ended_at: datetime | None = None
    peak_ratio: float = 1.0
    open_ratio: float = 1.0
    novelty: dict[str, Any] | None = None
    escalations: list[tuple[datetime, float]] = field(default_factory=list)
    recent_ratio: float | None = None
    sustained_at: datetime | None = None
    issue_ids: tuple[int, ...] = ()


class Urgency(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class AnomalyGroup:
    id: str
    opened_at: datetime
    change_events: list[ChangeEvent] = field(default_factory=list)
    driving_issues: list[str] = field(default_factory=list)
    nearby_changes: list[tuple[str, float]] = field(default_factory=list)
    localization: str | None = None
    blast_radius: list[str] = field(default_factory=list)
    urgency: Urgency = Urgency.LOW
    possibly_related: list[str] = field(default_factory=list)
