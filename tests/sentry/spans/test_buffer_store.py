from __future__ import annotations

from collections.abc import Generator
from unittest import mock

import orjson
import pytest
import zstandard

from sentry.spans.buffer import SpansBuffer
from sentry.spans.buffer_store import SpansBufferStore
from sentry.spans.buffer_types import (
    EvalshaResult,
    FlushCandidate,
    FlushedSegment,
    InsertedSubsegment,
    OutputSpan,
    Span,
    Subsegment,
)
from sentry.spans.segment_key import SegmentKey
from sentry.testutils.helpers.options import override_options

pytestmark = [pytest.mark.django_db]

# Keep these tests in their own Redis keyspace. CI runs test files in parallel,
# so broad cleanup like flushdb() can erase state from test_buffer.py.
_TEST_PROJECT_ID = 999_001
_TEST_TRACE_ID = "f" * 32
_TEST_SLICE_ID = 999_001


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentKey:
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _payload_key(project_id: int, trace_id: str, salt: str) -> bytes:
    return f"span-buf:s:{{{project_id}:{trace_id}:{salt}}}:{salt}".encode("ascii")


def _payload(span_id: str) -> bytes:
    return orjson.dumps({"span_id": span_id})


def _decompress_payload(raw_data: bytes) -> list[bytes]:
    if not raw_data.startswith(b"\x28\xb5\x2f\xfd"):
        return [raw_data]

    decompressed_buffer = zstandard.ZstdDecompressor().decompress(raw_data)
    return decompressed_buffer.split(b"\x00")


@pytest.fixture
def storage() -> Generator[SpansBufferStore]:
    buffer = SpansBuffer(
        assigned_shards=[0],
        slice_id=_TEST_SLICE_ID,
    )
    yield buffer.store
    keys = buffer.client.keys(f"*{_TEST_PROJECT_ID}:{_TEST_TRACE_ID}*")
    keys.extend(buffer.store.get_queue_key(shard) for shard in (0, 3))
    buffer.client.delete(*keys)


def test_load_flush_candidates_reads_ready_segments(storage: SpansBufferStore) -> None:
    queue_key = storage.get_queue_key(0)
    ready_segment_key = _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, "b" * 16)
    later_segment_key = _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, "c" * 16)
    storage.client.zadd(queue_key, {ready_segment_key: 5, later_segment_key: 15})

    flush_candidates, load_ids_latency_ms = storage.load_flush_candidates(
        cutoff=10,
        max_segments_per_shard=10,
    )

    assert flush_candidates == [FlushCandidate(0, queue_key, ready_segment_key, 5)]
    assert load_ids_latency_ms >= 0


def test_acquire_flush_locks_keeps_locked_candidates(storage: SpansBufferStore) -> None:
    first_segment_key = _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, "b" * 16)
    second_segment_key = _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, "c" * 16)
    first_candidate = FlushCandidate(0, storage.get_queue_key(0), first_segment_key, 5)
    second_candidate = FlushCandidate(0, storage.get_queue_key(0), second_segment_key, 10)
    storage.client.set(storage.get_flush_lock_key(first_segment_key), b"1")

    with (
        override_options({"spans.buffer.flusher.flush-lock-ttl": 60}),
        mock.patch("sentry.spans.buffer_store.metrics.incr") as metrics_incr,
    ):
        flush_candidates = storage.acquire_flush_locks([first_candidate, second_candidate])

    assert flush_candidates == [second_candidate]
    metrics_incr.assert_called_once_with(
        "spans.buffer.flush_segments.lock_contention",
        amount=1,
    )


def test_acquire_flush_locks_returns_all_candidates_when_disabled(
    storage: SpansBufferStore,
) -> None:
    first_candidate = FlushCandidate(
        0,
        storage.get_queue_key(0),
        _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, "b" * 16),
        5,
    )
    second_candidate = FlushCandidate(
        0,
        storage.get_queue_key(0),
        _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, "c" * 16),
        10,
    )

    with override_options({"spans.buffer.flusher.flush-lock-ttl": 0}):
        flush_candidates = storage.acquire_flush_locks([first_candidate, second_candidate])

    assert flush_candidates == [first_candidate, second_candidate]


def test_update_queue_writes_deadlines_and_removes_stale_span_keys(
    storage: SpansBufferStore,
) -> None:
    project_and_trace = f"{_TEST_PROJECT_ID}:{_TEST_TRACE_ID}"
    parent_span_id = "f" * 16
    queue_key = storage.get_queue_key(3)
    first_span = Span(
        trace_id=_TEST_TRACE_ID,
        span_id="1" * 16,
        parent_span_id=parent_span_id,
        segment_id=None,
        project_id=_TEST_PROJECT_ID,
        payload=_payload("1" * 16),
        partition=3,
    )
    second_span = Span(
        trace_id=_TEST_TRACE_ID,
        span_id="2" * 16,
        parent_span_id=parent_span_id,
        segment_id=None,
        project_id=_TEST_PROJECT_ID,
        payload=_payload("2" * 16),
        partition=3,
    )
    subsegment = Subsegment(
        project_and_trace=project_and_trace,
        parent_span_id=parent_span_id,
        salt="salted",
        spans=[first_span],
    )
    segment_key = _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, parent_span_id)
    result = EvalshaResult(
        segment_key=segment_key,
        has_root_span=True,
        latency_ms=15,
        latency_metrics=[],
        gauge_metrics=[],
    )
    debug_trace_logger = mock.Mock()
    debug_trace_logger._should_log_trace.return_value = True
    first_span_key = storage.get_span_key(project_and_trace, first_span.span_id)
    second_span_key = storage.get_span_key(project_and_trace, second_span.span_id)
    storage.client.zadd(
        queue_key,
        {
            segment_key: 80,
            first_span_key: 90,
            second_span_key: 95,
        },
    )

    storage.update_queue(
        {subsegment.key: [first_span, second_span]},
        [InsertedSubsegment(subsegment, result)],
        now=100,
        redis_ttl=3600,
        timeout=60,
        root_timeout=10,
        get_debug_trace_logger=lambda: debug_trace_logger,
    )

    assert storage.client.zscore(queue_key, segment_key) == 110
    assert storage.client.zscore(queue_key, first_span_key) is None
    assert storage.client.zscore(queue_key, second_span_key) is None
    debug_trace_logger.log_deadline_update.assert_called_once_with(
        segment_key=segment_key,
        project_and_trace=project_and_trace,
        old_deadline=80,
        new_deadline=110,
        message_timestamp=100,
        has_root_span=True,
    )


def test_update_queue_uses_timeout_for_non_root_segments(storage: SpansBufferStore) -> None:
    project_and_trace = f"{_TEST_PROJECT_ID}:{_TEST_TRACE_ID}"
    parent_span_id = "f" * 16
    queue_key = storage.get_queue_key(3)
    span = Span(
        trace_id=_TEST_TRACE_ID,
        span_id="1" * 16,
        parent_span_id=parent_span_id,
        segment_id=None,
        project_id=_TEST_PROJECT_ID,
        payload=_payload("1" * 16),
        partition=3,
    )
    subsegment = Subsegment(
        project_and_trace=project_and_trace,
        parent_span_id=parent_span_id,
        salt="salted",
        spans=[span],
    )
    segment_key = _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, parent_span_id)
    result = EvalshaResult(
        segment_key=segment_key,
        has_root_span=False,
        latency_ms=15,
        latency_metrics=[],
        gauge_metrics=[],
    )
    debug_trace_logger = mock.Mock()
    debug_trace_logger._should_log_trace.return_value = False

    storage.update_queue(
        {subsegment.key: [span]},
        [InsertedSubsegment(subsegment, result)],
        now=100,
        redis_ttl=3600,
        timeout=60,
        root_timeout=10,
        get_debug_trace_logger=lambda: debug_trace_logger,
    )

    # Without a root span the deadline uses `timeout` (60), not `root_timeout` (10).
    assert storage.client.zscore(queue_key, segment_key) == 160


def test_update_queue_keeps_child_span_keys_for_detached_segments(
    storage: SpansBufferStore,
) -> None:
    project_and_trace = f"{_TEST_PROJECT_ID}:{_TEST_TRACE_ID}"
    parent_span_id = "f" * 16
    salt = "salted"
    queue_key = storage.get_queue_key(3)
    span = Span(
        trace_id=_TEST_TRACE_ID,
        span_id="1" * 16,
        parent_span_id=parent_span_id,
        segment_id=None,
        project_id=_TEST_PROJECT_ID,
        payload=_payload("1" * 16),
        partition=3,
    )
    subsegment = Subsegment(
        project_and_trace=project_and_trace,
        parent_span_id=parent_span_id,
        salt=salt,
        spans=[span],
    )
    # A detached segment's key ends with the subsegment salt; its child span keys
    # must be left in the queue rather than removed.
    detached_segment_key = _payload_key(_TEST_PROJECT_ID, _TEST_TRACE_ID, salt)
    result = EvalshaResult(
        segment_key=detached_segment_key,
        has_root_span=False,
        latency_ms=15,
        latency_metrics=[],
        gauge_metrics=[],
    )
    debug_trace_logger = mock.Mock()
    debug_trace_logger._should_log_trace.return_value = False
    span_key = storage.get_span_key(project_and_trace, span.span_id)
    storage.client.zadd(queue_key, {span_key: 90})

    storage.update_queue(
        {subsegment.key: [span]},
        [InsertedSubsegment(subsegment, result)],
        now=100,
        redis_ttl=3600,
        timeout=60,
        root_timeout=10,
        get_debug_trace_logger=lambda: debug_trace_logger,
    )

    assert storage.client.zscore(queue_key, span_key) == 90
    assert storage.client.zscore(queue_key, detached_segment_key) == 160


def test_load_payload_keys_from_distributed_keys(storage: SpansBufferStore) -> None:
    segment_key = _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, "b" * 16)
    first_salt = "1" * 32
    second_salt = "2" * 32
    first_payload_key = _payload_key(_TEST_PROJECT_ID, _TEST_TRACE_ID, first_salt)
    second_payload_key = _payload_key(_TEST_PROJECT_ID, _TEST_TRACE_ID, second_salt)
    storage.client.sadd(storage.get_payload_key_index(segment_key), first_salt, second_salt)

    payload_keys = storage.load_payload_keys([segment_key])

    assert set(payload_keys[segment_key]) == {
        first_payload_key,
        second_payload_key,
    }


def test_load_payloads_from_keys_decompresses_payload_batches(
    storage: SpansBufferStore,
) -> None:
    segment_key = _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, "b" * 16)
    payload_key = _payload_key(_TEST_PROJECT_ID, _TEST_TRACE_ID, "1" * 32)
    span_a = _payload("a" * 16)
    span_b = _payload("b" * 16)
    compressed = zstandard.ZstdCompressor(level=0).compress(b"\x00".join([span_a, span_b]))
    storage.client.sadd(payload_key, compressed)

    payloads, decompress_latency_ms = storage.load_payloads_from_keys(
        [segment_key],
        {segment_key: [payload_key]},
        page_size=1,
        decompress_payload=_decompress_payload,
    )

    assert set(payloads[segment_key]) == {span_a, span_b}
    assert decompress_latency_ms >= 0


def test_load_segments_reads_payloads_from_distributed_keys(
    storage: SpansBufferStore,
) -> None:
    segment_key = _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, "b" * 16)
    first_salt = "1" * 32
    second_salt = "2" * 32
    first_payload_key = _payload_key(_TEST_PROJECT_ID, _TEST_TRACE_ID, first_salt)
    second_payload_key = _payload_key(_TEST_PROJECT_ID, _TEST_TRACE_ID, second_salt)
    span_a = _payload("a" * 16)
    span_b = _payload("b" * 16)
    span_c = _payload("c" * 16)

    storage.client.sadd(storage.get_payload_key_index(segment_key), first_salt, second_salt)
    storage.client.sadd(first_payload_key, span_a, span_b)
    storage.client.sadd(second_payload_key, span_c)
    storage.client.set(b"span-buf:ic:" + segment_key, 3)
    storage.client.set(b"span-buf:ibc:" + segment_key, len(span_a) + len(span_b) + len(span_c))

    with override_options({"spans.buffer.segment-page-size": 1}):
        loaded_segments, _, _ = storage.load_segments(
            [FlushCandidate(0, storage.get_queue_key(0), segment_key, 5)],
            decompress_payload=_decompress_payload,
        )
    loaded_segment = loaded_segments[0]

    assert set(loaded_segment.payloads) == {span_a, span_b, span_c}
    assert set(loaded_segment.payload_keys) == {
        first_payload_key,
        second_payload_key,
    }
    assert loaded_segment.ingest_metadata.ingested_count == 3
    assert loaded_segment.ingest_metadata.ingested_byte_count == (
        len(span_a) + len(span_b) + len(span_c)
    )


def test_load_segments_decompresses_payload_batches(
    storage: SpansBufferStore,
) -> None:
    segment_key = _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, "b" * 16)
    salt = "1" * 32
    payload_key = _payload_key(_TEST_PROJECT_ID, _TEST_TRACE_ID, salt)
    span_a = _payload("a" * 16)
    span_b = _payload("b" * 16)
    compressed = zstandard.ZstdCompressor(level=0).compress(b"\x00".join([span_a, span_b]))

    storage.client.sadd(storage.get_payload_key_index(segment_key), salt)
    storage.client.sadd(payload_key, compressed)
    storage.client.set(b"span-buf:ic:" + segment_key, 2)

    with override_options({"spans.buffer.segment-page-size": 1}):
        loaded_segments, load_data_latency_ms, decompress_latency_ms = storage.load_segments(
            [FlushCandidate(0, storage.get_queue_key(0), segment_key, 5)],
            decompress_payload=_decompress_payload,
        )
    loaded_segment = loaded_segments[0]

    assert set(loaded_segment.payloads) == {span_a, span_b}
    assert loaded_segment.payload_keys == [payload_key]
    assert loaded_segment.ingest_metadata.ingested_count == 2
    assert load_data_latency_ms >= 0
    assert decompress_latency_ms >= 0


def test_cleanup_flushed_segments_removes_segment_data(storage: SpansBufferStore) -> None:
    segment_key = _segment_id(_TEST_PROJECT_ID, _TEST_TRACE_ID, "b" * 16)
    payload_key = _payload_key(_TEST_PROJECT_ID, _TEST_TRACE_ID, "1" * 32)
    queue_key = storage.get_queue_key(0)
    redirect_map_key = f"span-buf:ssr:{{{_TEST_PROJECT_ID}:{_TEST_TRACE_ID}}}".encode("ascii")
    span_id = "b" * 16

    storage.client.set(b"span-buf:hrs:" + segment_key, b"1")
    storage.client.set(b"span-buf:ic:" + segment_key, 1)
    storage.client.set(b"span-buf:ibc:" + segment_key, 10)
    storage.client.hset(redirect_map_key, span_id, b"redirected")
    storage.client.sadd(storage.get_payload_key_index(segment_key), "1" * 32)
    storage.client.sadd(payload_key, _payload(span_id))
    storage.client.set(storage.get_flush_lock_key(segment_key), b"1")
    storage.client.zadd(queue_key, {segment_key: 10})

    storage.cleanup_flushed_segments(
        {
            segment_key: FlushedSegment(
                queue_key=queue_key,
                spans=[OutputSpan(payload={"span_id": span_id})],
                project_id=_TEST_PROJECT_ID,
                payload_keys=[payload_key],
            )
        }
    )

    assert storage.client.get(b"span-buf:hrs:" + segment_key) is None
    assert storage.client.get(b"span-buf:ic:" + segment_key) is None
    assert storage.client.get(b"span-buf:ibc:" + segment_key) is None
    assert storage.client.hget(redirect_map_key, span_id) is None
    assert not storage.client.exists(storage.get_payload_key_index(segment_key))
    assert not storage.client.exists(payload_key)
    assert storage.client.get(storage.get_flush_lock_key(segment_key)) is None
    assert storage.client.zscore(queue_key, segment_key) is None
