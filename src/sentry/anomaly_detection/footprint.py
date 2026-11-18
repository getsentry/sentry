"""Structural evidence summarized from an anomaly's sampled traces."""

from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime

from sentry.anomaly_detection.contracts import SeriesKey

SLICE_LAYERS = {"endpoints": 1, "outbound_db": 2, "outbound_http": 2}
DEPENDENCY_SIGNALS = frozenset({"outbound_db", "outbound_http"})

# A blank signal and dimension describe the whole project and environment.
Slice = tuple[str, str, str, str]
# Caller service, outbound domain, callee service. Services are "project/environment".
CallEdge = tuple[str, str, str]


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
    via: str = "traces"
    window: tuple[datetime, datetime] | None = None

    def touches(self, key: SeriesKey, min_share: float = 0.2) -> SliceStats | None:
        stats = self.slices.get(slice_of(key))
        return stats if stats is not None and stats.trace_share >= min_share else None


def base_signal(signal: str) -> str:
    base = signal.removesuffix("_slow")
    return base if base in SLICE_LAYERS else signal


def service_of(key: SeriesKey) -> str:
    return f"{key.project}/{key.env or ''}"


def slice_of(key: SeriesKey) -> Slice:
    signal = base_signal(key.signal)
    if signal in SLICE_LAYERS and key.dim_value:
        return key.project, key.env or "", signal, key.dim_value
    return key.project, key.env or "", "", ""
