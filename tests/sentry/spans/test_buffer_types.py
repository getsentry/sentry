from __future__ import annotations

import orjson

from sentry.spans.buffer_types import (
    EvalshaResult,
    FlushCandidate,
    InsertedSubsegment,
    LoadedSegment,
    SegmentIngestMetadata,
    Span,
    Subsegment,
)
from sentry.spans.segment_key import PayloadKey, SegmentKey


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentKey:
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _payload(span_id: str) -> bytes:
    return orjson.dumps({"span_id": span_id})


def _span(
    span_id: str,
    parent_span_id: str | None,
    *,
    segment_id: str | None = None,
    is_segment_span: bool = False,
    partition: int = 0,
) -> Span:
    return Span(
        payload=_payload(span_id),
        trace_id="a" * 32,
        span_id=span_id,
        parent_span_id=parent_span_id,
        segment_id=segment_id,
        project_id=1,
        is_segment_span=is_segment_span,
        partition=partition,
    )


def test_span_effective_parent_id_prefers_segment_id() -> None:
    span = _span("a" * 16, "b" * 16, segment_id="c" * 16)

    assert span.effective_parent_id() == "c" * 16


def test_span_effective_parent_id_uses_parent_or_span_id() -> None:
    span_with_parent = _span("a" * 16, "b" * 16)
    span_without_parent = _span("c" * 16, None)

    assert span_with_parent.effective_parent_id() == "b" * 16
    assert span_without_parent.effective_parent_id() == "c" * 16


def test_span_effective_parent_id_uses_span_id_for_segment_span() -> None:
    span = _span("a" * 16, "b" * 16, segment_id="c" * 16, is_segment_span=True)

    assert span.effective_parent_id() == "a" * 16


def test_subsegment_exposes_span_metadata() -> None:
    trace_id = "a" * 32
    parent_span_id = "f" * 16
    first_span = _span("a" * 16, parent_span_id, partition=3)
    second_span = _span("b" * 16, parent_span_id, is_segment_span=True, partition=3)
    subsegment = Subsegment(
        project_and_trace=f"1:{trace_id}",
        parent_span_id=parent_span_id,
        salt="salted",
        spans=[first_span, second_span],
    )

    assert subsegment.key == (f"1:{trace_id}", parent_span_id)
    assert subsegment.byte_count == len(first_span.payload) + len(second_span.payload)
    assert subsegment.has_segment_span
    assert subsegment.partition == 3
    assert subsegment.span_ids == ["a" * 16, "b" * 16]


def test_evalsha_result_from_redis_result() -> None:
    segment_key = _segment_id(1, "a" * 32, "b" * 16)
    latency_metrics = [(b"operation", 12.0)]
    gauge_metrics = [(b"gauge", 3.0)]

    result = EvalshaResult.from_redis_result(
        [segment_key, True, 15, latency_metrics, gauge_metrics]
    )

    assert result == EvalshaResult(
        segment_key=segment_key,
        has_root_span=True,
        latency_ms=15,
        latency_metrics=latency_metrics,
        gauge_metrics=gauge_metrics,
    )


def test_inserted_subsegment_exposes_queue_and_cleanup_metadata() -> None:
    trace_id = "a" * 32
    parent_span_id = "f" * 16
    salt = "salted"
    subsegment = Subsegment(
        project_and_trace=f"1:{trace_id}",
        parent_span_id=parent_span_id,
        salt=salt,
        spans=[_span("a" * 16, parent_span_id, partition=3)],
    )

    inserted = InsertedSubsegment(
        subsegment,
        EvalshaResult(
            segment_key=_segment_id(1, trace_id, parent_span_id),
            has_root_span=False,
            latency_ms=15,
            latency_metrics=[],
            gauge_metrics=[],
        ),
    )
    detached = InsertedSubsegment(
        subsegment,
        EvalshaResult(
            segment_key=_segment_id(1, trace_id, salt),
            has_root_span=False,
            latency_ms=15,
            latency_metrics=[],
            gauge_metrics=[],
        ),
    )

    assert inserted.project_and_trace == f"1:{trace_id}"
    assert inserted.queue_shard == 3
    assert not inserted.is_detached_segment
    assert detached.is_detached_segment


def test_inserted_subsegment_from_redis_result() -> None:
    trace_id = "a" * 32
    parent_span_id = "f" * 16
    subsegment = Subsegment(
        project_and_trace=f"1:{trace_id}",
        parent_span_id=parent_span_id,
        salt="salted",
        spans=[_span("a" * 16, parent_span_id)],
    )
    segment_key = _segment_id(1, trace_id, "c" * 16)

    inserted = InsertedSubsegment.from_redis_result(
        subsegment,
        [segment_key, False, 12, [], []],
    )

    assert inserted == InsertedSubsegment(
        subsegment,
        EvalshaResult(segment_key, False, 12, [], []),
    )


def test_flush_candidate_from_redis_result() -> None:
    segment_key = _segment_id(1, "a" * 32, "b" * 16)

    flush_candidate = FlushCandidate.from_redis_result(
        0,
        b"span-buf:q:0",
        (segment_key, 5.0),
    )

    assert flush_candidate == FlushCandidate(0, b"span-buf:q:0", segment_key, 5.0)


def test_segment_ingest_metadata_from_redis_result() -> None:
    assert SegmentIngestMetadata.from_redis_result(b"3", b"42") == SegmentIngestMetadata(
        ingested_count=3,
        ingested_byte_count=42,
    )
    assert SegmentIngestMetadata.from_redis_result(None, None) == SegmentIngestMetadata()


def test_loaded_segment_exposes_candidate_payloads_and_metadata() -> None:
    segment_key = _segment_id(1, "a" * 32, "b" * 16)
    queue_key = b"span-buf:q:0"
    payload_key = PayloadKey(b"span-buf:s:{1:%s:salted}:salted" % (b"a" * 32))
    payload = _payload("a" * 16)

    loaded_segment = LoadedSegment(
        FlushCandidate(0, queue_key, segment_key, 5),
        payloads=[payload],
        payload_keys=[payload_key],
        ingest_metadata=SegmentIngestMetadata(1, len(payload)),
    )

    assert loaded_segment.segment_key == segment_key
    assert loaded_segment.queue_key == queue_key
    assert loaded_segment.shard == 0
    assert loaded_segment.score == 5
    assert loaded_segment.payloads == [payload]
    assert loaded_segment.payload_keys == [payload_key]
    assert loaded_segment.ingest_metadata == SegmentIngestMetadata(1, len(payload))
