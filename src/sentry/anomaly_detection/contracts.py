"""Shared data for aggregate series, change episodes, and anomaly groups."""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from functools import cached_property
from typing import Any, Literal, NamedTuple, NewType


class Signal(StrEnum):
    """The population a series measures within a project and environment."""

    # Collected from the errors dataset.
    ERRORS = "errors"
    ERRORS_BY_RELEASE = "errors_by_release"  # Sliced by release.
    # Collected from transaction spans.
    REQUESTS = "requests"
    FAILED_REQUESTS = "failed_requests"
    # Derived from the totals above (see evaluation.series).
    ERROR_RATE = "error_rate"
    FAILED_RATE = "failed_rate"
    # Collected from spans, sliced by transaction, database or domain.
    ENDPOINTS = "endpoints"
    OUTBOUND_DB = "outbound_db"
    OUTBOUND_HTTP = "outbound_http"
    # A new error issue, sliced by its first group ID. Never a measured series.
    NEW_ISSUE = "new_issue"


class Metric(StrEnum):
    """The aggregate of a series. Collected values are also the Snuba aggregate names."""

    COUNT = "count()"
    COUNT_SAMPLE = "count_sample()"  # Sampled spans behind an extrapolated aggregate.
    COUNT_UNIQUE_USER = "count_unique(user)"
    P95_DURATION = "p95(span.duration)"
    FAILURE_RATE = "failure_rate()"  # A share of the slice's sampled spans.
    # Derived rates (see evaluation.series).
    ERRORS_PER_REQUEST = "errors/requests"
    FAILED_PER_REQUEST = "failed_requests/requests"

    @property
    def is_count(self) -> bool:
        return self in (Metric.COUNT, Metric.COUNT_SAMPLE, Metric.COUNT_UNIQUE_USER)


@dataclass(frozen=True, order=True)
class SeriesKey:
    project_id: int  # Scoped to the current organization.
    env: str  # Empty means no environment.
    signal: Signal
    metric: Metric
    # Endpoint, database, domain, release or issue; empty means a project/environment total.
    dim_value: str = ""

    def __str__(self) -> str:
        dim = f"[{self.dim_value}]" if self.dim_value else ""
        return f"{self.project_id}/{self.env} {self.signal}{dim} {self.metric}"


class SeriesRow(NamedTuple):
    """One collected bucket of a series."""

    ts: datetime  # Bucket start (minute or hour), naive UTC.
    signal: Signal
    metric: Metric
    project_id: int
    env: str  # Empty means no environment.
    dim_value: str  # Empty means a project/environment total.
    value: float | None  # None is a known-missing measurement, not zero.

    @property
    def key(self) -> SeriesKey:
        return SeriesKey(self.project_id, self.env, self.signal, self.metric, self.dim_value)


class Service(NamedTuple):
    """A project and environment, the unit of call paths and blast radius."""

    project_id: int
    env: str  # Empty means no environment.

    def __str__(self) -> str:
        return f"{self.project_id}/{self.env}"


# Stable identity of a correlated anomaly; also the Workflow Engine detector group key.
AnomalyGroupKey = NewType("AnomalyGroupKey", str)


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


class EpisodeKey(NamedTuple):
    """Identity of one change episode on one series."""

    series_key: SeriesKey
    change_type: ChangeType
    start: datetime


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


# A detector's report on an episode at a minute. "latent" is an open judged routine,
# kept as supporting evidence; "expire" ends an episode without observing recovery.
ChangeActionKind = Literal["open", "latent", "escalate", "close", "expire"]
ChangeAction = tuple[ChangeActionKind, ChangeEvent]


class Urgency(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class AnomalyGroup:
    id: AnomalyGroupKey
    opened_at: datetime
    change_events: list[ChangeEvent] = field(default_factory=list)
    driving_issues: list[int] = field(default_factory=list)
    localization: str | None = None
    blast_radius: list[Service] = field(default_factory=list)
    urgency: Urgency = Urgency.LOW
    possibly_related: list[AnomalyGroupKey] = field(default_factory=list)
