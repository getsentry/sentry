"""
Shared span buffer data structures.

These types describe data passed between buffer pipeline steps. Some include
small representation helpers, but Redis operations and Django model state stay
outside this module.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from typing import Any, NamedTuple

import orjson

from sentry import options
from sentry.spans.segment_key import PayloadKey, SegmentKey
from sentry.utils import metrics

type DataPoint = tuple[bytes, float]
type EvalshaData = list[DataPoint]
type QueueKey = bytes
type SpanPayload = dict[str, Any]


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

    @classmethod
    def from_redis_result(cls, subsegment: Subsegment, result: Sequence[Any]) -> InsertedSubsegment:
        return cls(subsegment, EvalshaResult.from_redis_result(result))

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


class OutputSpan(NamedTuple):
    """
    A span payload after flush-time segment metadata has been attached.
    """

    payload: SpanPayload


class FlushCandidate(NamedTuple):
    """
    A queued segment that is ready to be considered for flushing.

    At this stage only queue metadata is known; payload keys and span payloads
    are loaded after the flush lock is acquired.
    """

    shard: int
    queue_key: QueueKey
    segment_key: SegmentKey
    score: float

    @classmethod
    def from_redis_result(
        cls,
        shard: int,
        queue_key: QueueKey,
        result: Sequence[Any],
    ) -> FlushCandidate:
        segment_key, score = result
        return cls(shard, queue_key, segment_key, score)


class SegmentIngestMetadata(NamedTuple):
    """
    Ingest-time metadata stored alongside a segment.

    These values may be missing when Redis data expired before the flusher loaded
    the segment, or when another flusher won a race and cleaned up first.
    """

    ingested_count: int | None = None
    ingested_byte_count: int | None = None

    @classmethod
    def from_redis_result(
        cls,
        ingested_count: bytes | int | None,
        ingested_byte_count: bytes | int | None,
    ) -> SegmentIngestMetadata:
        return cls(
            int(ingested_count) if ingested_count is not None else None,
            int(ingested_byte_count) if ingested_byte_count is not None else None,
        )


class LoadedSegment(NamedTuple):
    """
    A flush candidate with its loaded payloads and ingest metadata.
    """

    flush_candidate: FlushCandidate
    payloads: list[bytes]
    payload_keys: list[PayloadKey]
    ingest_metadata: SegmentIngestMetadata = SegmentIngestMetadata()

    @property
    def segment_key(self) -> SegmentKey:
        return self.flush_candidate.segment_key

    @property
    def shard(self) -> int:
        return self.flush_candidate.shard

    @property
    def queue_key(self) -> QueueKey:
        return self.flush_candidate.queue_key

    @property
    def score(self) -> float:
        return self.flush_candidate.score


class FlushedSegment(NamedTuple):
    """
    A buffered segment selected, loaded, and prepared for Kafka production.

    The segment has not been produced to Kafka yet. SpanFlusher calls
    `to_messages()` and produces those messages, then cleanup happens through
    done_flush_segments.
    """

    queue_key: QueueKey
    spans: list[OutputSpan]
    project_id: int  # Used to track outcomes
    payload_keys: list[PayloadKey] = []  # For cleanup

    def to_messages(self) -> list[dict[str, Any]]:
        """
        Build producer messages for this segment.

        If the segment size exceeds `spans.buffer.max_segment_bytes`, the segment is split
        into multiple messages with skip_enrichment=True. Otherwise, returns a single message.

        Each message gets a unique flush_id generated at call time, ensuring duplicate
        flushes from Redis produce distinct IDs.
        """
        max_segment_bytes = options.get("spans.buffer.max-segment-bytes")

        spans: list[SpanPayload] = [span.payload for span in self.spans]

        sizes = [len(orjson.dumps(s)) for s in spans]
        if sum(sizes) <= max_segment_bytes:
            return [{"flush_id": uuid.uuid4().hex, "spans": spans}]

        messages: list[dict[str, Any]] = []
        current: list[SpanPayload] = []
        current_size = 0

        for span, size in zip(spans, sizes):
            if current and current_size + size > max_segment_bytes:
                messages.append(
                    {"flush_id": uuid.uuid4().hex, "spans": current, "skip_enrichment": True}
                )
                current = []
                current_size = 0
            current.append(span)
            current_size += size

        if current:
            messages.append(
                {"flush_id": uuid.uuid4().hex, "spans": current, "skip_enrichment": True}
            )

        if len(messages) > 1:
            metrics.timing(
                "spans.buffer.oversized_segments_chunked",
                len(messages),
            )
            metrics.timing("spans.buffer.oversized_segments_size", sum(sizes))

        return messages
