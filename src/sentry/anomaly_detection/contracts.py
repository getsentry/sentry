"""Shared data for aggregate series and change episodes."""

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any, Literal, NamedTuple, NewType, TypedDict


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
    point_count: int
    sigma: float
    lower: float
    upper: float


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


class NoveltyEvidence(TypedDict, total=False):
    """How an episode was judged against its history, and why it was later promoted."""

    unusual: bool
    size: float
    return_days: float
    similar: int
    history_days: float
    pooled_rate: float
    kind: str
    p_normal: float
    lasting_min: int
    harm: bool
    vouched: bool
    opened_on_escalation: bool
    opened_on_duration: bool
    unusual_since: datetime


class ChangeEvent:
    """One change episode on one series.

    Deliberately not a dataclass, because msgspec would store dataclasses inline: the
    detectors, correlator, novelty model and admission policy hold and update the same
    instance, and the checkpoint stores each instance once and restores shared references
    to it. Use `is` for identity; `==` compares values, like the dataclass it replaced.
    """

    __slots__ = (
        "key",
        "change_type",
        "start",
        "actual",
        "expected",
        "confidence",
        "evidence",
        "detected_at",
        "ended_at",
        "peak_ratio",
        "open_ratio",
        "novelty",
        "escalations",
        "recent_ratio",
        "sustained_at",
        "issue_ids",
    )

    def __init__(
        self,
        key: SeriesKey,
        change_type: ChangeType,
        start: datetime,
        actual: float,
        expected: float,
        confidence: float,
        evidence: list[str] | None = None,
        detected_at: datetime | None = None,
        ended_at: datetime | None = None,
        peak_ratio: float = 1.0,
        open_ratio: float = 1.0,
        novelty: NoveltyEvidence | None = None,
        escalations: list[tuple[datetime, float]] | None = None,
        recent_ratio: float | None = None,
        sustained_at: datetime | None = None,
        issue_ids: tuple[int, ...] = (),
    ) -> None:
        self.key = key
        self.change_type = change_type
        self.start = start
        self.actual = actual
        self.expected = expected
        self.confidence = confidence
        self.evidence = evidence if evidence is not None else []
        self.detected_at = detected_at
        self.ended_at = ended_at
        self.peak_ratio = peak_ratio
        self.open_ratio = open_ratio
        self.novelty = novelty
        self.escalations = escalations if escalations is not None else []
        self.recent_ratio = recent_ratio
        self.sustained_at = sustained_at
        self.issue_ids = issue_ids

    def replace(self, **changes: Any) -> "ChangeEvent":
        """A new, independent episode with the given fields changed (shallow copy)."""
        return ChangeEvent(**({name: getattr(self, name) for name in self.__slots__} | changes))

    def __repr__(self) -> str:
        return f"ChangeEvent({self.key}, {self.change_type}, start={self.start.isoformat()})"

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, ChangeEvent):
            return NotImplemented
        return all(getattr(self, name) == getattr(other, name) for name in self.__slots__)

    __hash__ = None  # type: ignore[assignment]  # Mutable, so unhashable.


# A detector's report on an episode at a minute. "latent" is an open judged routine,
# kept as supporting evidence; "expire" ends an episode without observing recovery.
ChangeActionKind = Literal["open", "latent", "escalate", "close", "expire"]
ChangeAction = tuple[ChangeActionKind, ChangeEvent]


class Urgency(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
