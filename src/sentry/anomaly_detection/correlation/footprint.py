"""Structural evidence summarized from an anomaly's sampled traces."""

from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Final, Literal, NamedTuple

from sentry.anomaly_detection.contracts import SeriesKey, Service, Signal

# Depth of each sliced signal below its service total, which is layer 0.
SLICE_LAYERS = {Signal.ENDPOINTS: 1, Signal.OUTBOUND_DB: 2, Signal.OUTBOUND_HTTP: 2}
DEPENDENCY_SIGNALS = frozenset({Signal.OUTBOUND_DB, Signal.OUTBOUND_HTTP})


class Slice(NamedTuple):
    service: Service
    signal: Signal | None  # None, with an empty dimension, is the whole service.
    dim_value: str


class CallEdge(NamedTuple):
    caller: Service
    domain: str  # The caller's outbound HTTP span domain.
    callee: Service


@dataclass(frozen=True)
class SliceStats:
    trace_share: float
    p95_ms: float | None
    spans: int


@dataclass
class Footprint:
    event: SeriesKey
    traces: list[str]
    slices: dict[Slice, SliceStats] = field(default_factory=dict)
    edges: Counter[CallEdge] = field(default_factory=Counter)
    window: tuple[datetime, datetime] | None = None

    def touches(self, key: SeriesKey, min_share: float = 0.2) -> SliceStats | None:
        stats = self.slices.get(slice_of(key))
        return stats if stats is not None and stats.trace_share >= min_share else None


class _FootprintStatus(Enum):
    DEFERRED = "deferred"


# A budget miss is not evidence that the event has no affected traces.
FOOTPRINT_DEFERRED: Final = _FootprintStatus.DEFERRED
FootprintResult = Footprint | None | Literal[_FootprintStatus.DEFERRED]


def service_of(key: SeriesKey) -> Service:
    return Service(key.project_id, key.env)


def slice_of(key: SeriesKey) -> Slice:
    if key.signal in SLICE_LAYERS and key.dim_value:
        return Slice(service_of(key), key.signal, key.dim_value)
    return Slice(service_of(key), None, "")
