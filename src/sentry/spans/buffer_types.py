"""
Shared value types for the span buffer.

These types describe data passed between buffer pipeline steps. They do not
own Redis operations, logging behavior, or Django model state.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, NamedTuple

from sentry.spans.segment_key import SegmentKey

type DataPoint = tuple[bytes, float]
type EvalshaData = list[DataPoint]


class EvalshaResult(NamedTuple):
    segment_key: SegmentKey
    has_root_span: bool
    latency_ms: int
    latency_metrics: EvalshaData
    gauge_metrics: EvalshaData

    @classmethod
    def from_redis_result(cls, result: Sequence[Any]) -> EvalshaResult:
        (
            segment_key,
            has_root_span,
            latency_ms,
            latency_metrics,
            gauge_metrics,
        ) = result
        return cls(segment_key, has_root_span, latency_ms, latency_metrics, gauge_metrics)
