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


# NamedTuples are faster to construct than dataclasses
class Span(NamedTuple):
    trace_id: str
    span_id: str
    parent_span_id: str | None
    segment_id: str | None
    project_id: int
    payload: bytes
    is_segment_span: bool = False
    partition: int = 0

    def effective_parent_id(self) -> str:
        # Note: For the case where the span's parent is in another project, we
        # will still flush the segment-without-root-span as one unit, just after
        # `timeout` rather than `root-timeout` seconds.
        if self.is_segment_span:
            return self.span_id
        else:
            return self.segment_id or self.parent_span_id or self.span_id


class Subsegment(NamedTuple):
    project_and_trace: str
    parent_span_id: str
    salt: str
    spans: list[Span]

    @property
    def key(self) -> tuple[str, str]:
        return (self.project_and_trace, self.parent_span_id)

    @property
    def byte_count(self) -> int:
        return sum(len(span.payload) for span in self.spans)

    @property
    def has_segment_span(self) -> bool:
        return any(span.is_segment_span for span in self.spans)

    @property
    def partition(self) -> int:
        # All spans in a subsegment share the same trace_id, so they all came
        # from the same Kafka partition.
        return self.spans[0].partition

    @property
    def span_ids(self) -> list[str]:
        return [span.span_id for span in self.spans]


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


class InsertedSubsegment(NamedTuple):
    subsegment: Subsegment
    result: EvalshaResult

    @property
    def project_and_trace(self) -> str:
        return self.subsegment.project_and_trace

    @property
    def queue_shard(self) -> int:
        # The Kafka partition is used directly as the queue shard so that
        # routing is stable across rebalances.
        return self.subsegment.partition

    @property
    def is_detached_segment(self) -> bool:
        return self.result.segment_key.endswith(self.subsegment.salt.encode("ascii"))
