from __future__ import annotations

from unittest import mock

import orjson
import pytest
import zstandard

from sentry.spans.buffer import SpansBuffer
from sentry.spans.buffer_store import SpansBufferStore
from sentry.spans.buffer_types import FlushCandidate
from sentry.spans.segment_key import SegmentKey
from sentry.testutils.helpers.options import override_options

pytestmark = [pytest.mark.django_db]


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
def storage() -> SpansBufferStore:
    buffer = SpansBuffer(assigned_shards=[0])
    buffer.client.flushdb()
    yield buffer.store
    buffer.client.flushdb()


def test_load_flush_candidates_reads_ready_segments(storage: SpansBufferStore) -> None:
    queue_key = storage.get_queue_key(0)
    ready_segment_key = _segment_id(1, "a" * 32, "b" * 16)
    later_segment_key = _segment_id(1, "a" * 32, "c" * 16)
    storage.client.zadd(queue_key, {ready_segment_key: 5, later_segment_key: 15})

    flush_candidates, load_ids_latency_ms = storage.load_flush_candidates(
        cutoff=10,
        max_segments_per_shard=10,
    )

    assert flush_candidates == [FlushCandidate(0, queue_key, ready_segment_key, 5)]
    assert load_ids_latency_ms >= 0


def test_acquire_flush_locks_keeps_locked_candidates(storage: SpansBufferStore) -> None:
    first_segment_key = _segment_id(1, "a" * 32, "b" * 16)
    second_segment_key = _segment_id(1, "a" * 32, "c" * 16)
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
        _segment_id(1, "a" * 32, "b" * 16),
        5,
    )
    second_candidate = FlushCandidate(
        0,
        storage.get_queue_key(0),
        _segment_id(1, "a" * 32, "c" * 16),
        10,
    )

    with override_options({"spans.buffer.flusher.flush-lock-ttl": 0}):
        flush_candidates = storage.acquire_flush_locks([first_candidate, second_candidate])

    assert flush_candidates == [first_candidate, second_candidate]


def test_load_payload_keys_from_distributed_keys(storage: SpansBufferStore) -> None:
    trace_id = "a" * 32
    segment_key = _segment_id(1, trace_id, "b" * 16)
    first_salt = "1" * 32
    second_salt = "2" * 32
    first_payload_key = _payload_key(1, trace_id, first_salt)
    second_payload_key = _payload_key(1, trace_id, second_salt)
    storage.client.sadd(storage.get_payload_key_index(segment_key), first_salt, second_salt)

    payload_keys = storage.load_payload_keys([segment_key])

    assert set(payload_keys[segment_key]) == {
        first_payload_key,
        second_payload_key,
    }


def test_load_payloads_from_keys_decompresses_payload_batches(
    storage: SpansBufferStore,
) -> None:
    trace_id = "a" * 32
    segment_key = _segment_id(1, trace_id, "b" * 16)
    payload_key = _payload_key(1, trace_id, "1" * 32)
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


def test_load_segments_reads_payloads_from_distributed_keys(storage: SpansBufferStore) -> None:
    trace_id = "a" * 32
    segment_key = _segment_id(1, trace_id, "b" * 16)
    first_salt = "1" * 32
    second_salt = "2" * 32
    first_payload_key = _payload_key(1, trace_id, first_salt)
    second_payload_key = _payload_key(1, trace_id, second_salt)
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


def test_load_segments_decompresses_payload_batches(storage: SpansBufferStore) -> None:
    trace_id = "a" * 32
    segment_key = _segment_id(1, trace_id, "b" * 16)
    salt = "1" * 32
    payload_key = _payload_key(1, trace_id, salt)
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
