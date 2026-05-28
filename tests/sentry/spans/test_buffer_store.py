from __future__ import annotations

import builtins
from types import TracebackType
from typing import Any
from unittest import mock

import orjson
import zstandard

from sentry.spans.buffer_store import SpansBufferStore
from sentry.spans.buffer_types import (
    EvalshaResult,
    FlushCandidate,
    InsertedSubsegment,
    Span,
    Subsegment,
)
from sentry.spans.segment_key import SegmentKey
from sentry.testutils.helpers.options import override_options


def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentKey:
    return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")


def _payload_key(project_id: int, trace_id: str, salt: str) -> bytes:
    return f"span-buf:s:{{{project_id}:{trace_id}:{salt}}}:{salt}".encode("ascii")


def _payload(span_id: str) -> bytes:
    return orjson.dumps({"span_id": span_id})


def _as_redis_bytes(value: bytes | str | int) -> bytes:
    if isinstance(value, bytes):
        return value
    return str(value).encode("ascii")


def _decompress_payload(raw_data: bytes) -> list[bytes]:
    if not raw_data.startswith(b"\x28\xb5\x2f\xfd"):
        return [raw_data]

    decompressed_buffer = zstandard.ZstdDecompressor().decompress(raw_data)
    return decompressed_buffer.split(b"\x00")


class _StorageRedis:
    def __init__(self) -> None:
        self.sets: dict[bytes, builtins.set[bytes]] = {}
        self.values: dict[bytes, bytes] = {}
        self.zsets: dict[bytes, dict[bytes, float]] = {}

    def pipeline(self, transaction: bool = False) -> _StoragePipeline:
        return _StoragePipeline(self)

    def sadd(self, key: bytes, *values: bytes | str) -> None:
        self.sets.setdefault(key, builtins.set()).update(_as_redis_bytes(value) for value in values)

    def set(self, key: bytes, value: bytes | int, ex: int | None = None, nx: bool = False) -> bool:
        if nx and key in self.values:
            return False
        self.values[key] = _as_redis_bytes(value)
        return True

    def zadd(self, key: bytes, mapping: dict[bytes, int]) -> None:
        self.zsets.setdefault(key, {}).update(mapping)

    def zrem(self, key: bytes, *values: bytes) -> None:
        for value in values:
            self.zsets.get(key, {}).pop(value, None)

    def zscore(self, key: bytes, value: bytes) -> float | None:
        return self.zsets.get(key, {}).get(value)

    def expire(self, key: bytes, ttl: int) -> None:
        return None

    def smembers(self, key: bytes) -> builtins.set[bytes]:
        return self.sets.get(key, builtins.set())

    def sscan(
        self, key: bytes, cursor: int = 0, count: int | None = None
    ) -> tuple[int, list[bytes]]:
        values = sorted(self.sets.get(key, builtins.set()))
        page_size = count or len(values) or 1
        next_cursor = cursor + page_size
        if next_cursor >= len(values):
            return 0, values[cursor:]
        return next_cursor, values[cursor:next_cursor]

    def get(self, key: bytes) -> bytes | None:
        return self.values.get(key)

    def zrangebyscore(
        self,
        key: bytes,
        min_score: int,
        max_score: int,
        start: int = 0,
        num: int | None = None,
        withscores: bool = False,
    ) -> list[bytes] | list[tuple[bytes, float]]:
        values_with_scores = [
            (value, score)
            for value, score in self.zsets.get(key, {}).items()
            if min_score <= score <= max_score
        ]
        values_with_scores.sort(key=lambda item: item[1])
        if num is not None:
            values_with_scores = values_with_scores[start : start + num]
        else:
            values_with_scores = values_with_scores[start:]

        if withscores:
            return values_with_scores
        return [value for value, _ in values_with_scores]


class _StoragePipeline:
    def __init__(self, client: _StorageRedis) -> None:
        self.client = client
        self.commands: list[tuple[str, tuple[Any, ...]]] = []

    def __enter__(self) -> _StoragePipeline:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        return None

    def smembers(self, key: bytes) -> None:
        self.commands.append(("smembers", (key,)))

    def sscan(self, key: bytes, cursor: int = 0, count: int | None = None) -> None:
        self.commands.append(("sscan", (key, cursor, count)))

    def get(self, key: bytes) -> None:
        self.commands.append(("get", (key,)))

    def set(self, key: bytes, value: bytes | int, ex: int | None = None, nx: bool = False) -> None:
        self.commands.append(("set", (key, value, ex, nx)))

    def zadd(self, key: bytes, mapping: dict[bytes, int]) -> None:
        self.commands.append(("zadd", (key, mapping)))

    def zrem(self, key: bytes, *values: bytes) -> None:
        self.commands.append(("zrem", (key, *values)))

    def expire(self, key: bytes, ttl: int) -> None:
        self.commands.append(("expire", (key, ttl)))

    def zrangebyscore(
        self,
        key: bytes,
        min_score: int,
        max_score: int,
        start: int = 0,
        num: int | None = None,
        withscores: bool = False,
    ) -> None:
        self.commands.append(("zrangebyscore", (key, min_score, max_score, start, num, withscores)))

    def execute(self) -> list[Any]:
        results: list[Any] = []
        for command, args in self.commands:
            method = getattr(self.client, command)
            results.append(method(*args))
        self.commands = []
        return results


def _storage() -> tuple[SpansBufferStore, _StorageRedis]:
    client = _StorageRedis()
    return SpansBufferStore(client, assigned_shards=[0]), client


def test_load_flush_candidates_reads_ready_segments() -> None:
    storage, client = _storage()
    queue_key = storage.get_queue_key(0)
    ready_segment_key = _segment_id(1, "a" * 32, "b" * 16)
    later_segment_key = _segment_id(1, "a" * 32, "c" * 16)
    client.zadd(queue_key, {ready_segment_key: 5, later_segment_key: 15})

    flush_candidates, load_ids_latency_ms = storage.load_flush_candidates(
        cutoff=10,
        max_segments_per_shard=10,
    )

    assert flush_candidates == [FlushCandidate(0, queue_key, ready_segment_key, 5)]
    assert load_ids_latency_ms >= 0


def test_acquire_flush_locks_keeps_locked_candidates() -> None:
    storage, client = _storage()
    first_segment_key = _segment_id(1, "a" * 32, "b" * 16)
    second_segment_key = _segment_id(1, "a" * 32, "c" * 16)
    first_candidate = FlushCandidate(0, storage.get_queue_key(0), first_segment_key, 5)
    second_candidate = FlushCandidate(0, storage.get_queue_key(0), second_segment_key, 10)
    client.set(storage.get_flush_lock_key(first_segment_key), b"1")

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


def test_acquire_flush_locks_returns_all_candidates_when_disabled() -> None:
    storage, _ = _storage()
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


def test_update_queue_writes_deadlines_and_removes_stale_span_keys() -> None:
    storage, client = _storage()
    trace_id = "a" * 32
    project_and_trace = f"1:{trace_id}"
    parent_span_id = "f" * 16
    queue_key = storage.get_queue_key(3)
    first_span = Span(
        trace_id=trace_id,
        span_id="1" * 16,
        parent_span_id=parent_span_id,
        segment_id=None,
        project_id=1,
        payload=_payload("1" * 16),
        partition=3,
    )
    second_span = Span(
        trace_id=trace_id,
        span_id="2" * 16,
        parent_span_id=parent_span_id,
        segment_id=None,
        project_id=1,
        payload=_payload("2" * 16),
        partition=3,
    )
    subsegment = Subsegment(
        project_and_trace=project_and_trace,
        parent_span_id=parent_span_id,
        salt="salted",
        spans=[first_span],
    )
    segment_key = _segment_id(1, trace_id, parent_span_id)
    result = EvalshaResult(
        segment_key=segment_key,
        has_root_span=True,
        latency_ms=15,
        latency_metrics=[],
        gauge_metrics=[],
    )
    debug_trace_logger = mock.Mock()
    debug_trace_logger._should_log_trace.return_value = True
    client.zadd(
        queue_key,
        {
            segment_key: 80,
            storage.get_span_key(project_and_trace, first_span.span_id): 90,
            storage.get_span_key(project_and_trace, second_span.span_id): 95,
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

    assert client.zsets[queue_key] == {segment_key: 110}
    debug_trace_logger.log_deadline_update.assert_called_once_with(
        segment_key=segment_key,
        project_and_trace=project_and_trace,
        old_deadline=80,
        new_deadline=110,
        message_timestamp=100,
        has_root_span=True,
    )


def test_update_queue_uses_timeout_for_non_root_segments() -> None:
    storage, client = _storage()
    trace_id = "a" * 32
    project_and_trace = f"1:{trace_id}"
    parent_span_id = "f" * 16
    queue_key = storage.get_queue_key(3)
    span = Span(
        trace_id=trace_id,
        span_id="1" * 16,
        parent_span_id=parent_span_id,
        segment_id=None,
        project_id=1,
        payload=_payload("1" * 16),
        partition=3,
    )
    subsegment = Subsegment(
        project_and_trace=project_and_trace,
        parent_span_id=parent_span_id,
        salt="salted",
        spans=[span],
    )
    segment_key = _segment_id(1, trace_id, parent_span_id)
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
    assert client.zsets[queue_key] == {segment_key: 160}


def test_update_queue_keeps_child_span_keys_for_detached_segments() -> None:
    storage, client = _storage()
    trace_id = "a" * 32
    project_and_trace = f"1:{trace_id}"
    parent_span_id = "f" * 16
    salt = "salted"
    queue_key = storage.get_queue_key(3)
    span = Span(
        trace_id=trace_id,
        span_id="1" * 16,
        parent_span_id=parent_span_id,
        segment_id=None,
        project_id=1,
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
    detached_segment_key = f"span-buf:s:{{1:{trace_id}:{salt}}}:{salt}".encode("ascii")
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
    client.zadd(queue_key, {span_key: 90})

    storage.update_queue(
        {subsegment.key: [span]},
        [InsertedSubsegment(subsegment, result)],
        now=100,
        redis_ttl=3600,
        timeout=60,
        root_timeout=10,
        get_debug_trace_logger=lambda: debug_trace_logger,
    )

    assert client.zsets[queue_key] == {span_key: 90, detached_segment_key: 160}


def test_load_payload_keys_from_distributed_keys() -> None:
    storage, client = _storage()
    trace_id = "a" * 32
    segment_key = _segment_id(1, trace_id, "b" * 16)
    first_salt = "1" * 32
    second_salt = "2" * 32
    first_payload_key = _payload_key(1, trace_id, first_salt)
    second_payload_key = _payload_key(1, trace_id, second_salt)
    client.sadd(storage.get_payload_key_index(segment_key), first_salt, second_salt)

    payload_keys = storage.load_payload_keys([segment_key])

    assert set(payload_keys[segment_key]) == {
        first_payload_key,
        second_payload_key,
    }


def test_load_payloads_from_keys_decompresses_payload_batches() -> None:
    storage, client = _storage()
    trace_id = "a" * 32
    segment_key = _segment_id(1, trace_id, "b" * 16)
    payload_key = _payload_key(1, trace_id, "1" * 32)
    span_a = _payload("a" * 16)
    span_b = _payload("b" * 16)
    compressed = zstandard.ZstdCompressor(level=0).compress(b"\x00".join([span_a, span_b]))
    client.sadd(payload_key, compressed)

    payloads, decompress_latency_ms = storage.load_payloads_from_keys(
        [segment_key],
        {segment_key: [payload_key]},
        page_size=1,
        decompress_payload=_decompress_payload,
    )

    assert set(payloads[segment_key]) == {span_a, span_b}
    assert decompress_latency_ms >= 0


def test_load_segments_reads_payloads_from_distributed_keys() -> None:
    storage, client = _storage()
    trace_id = "a" * 32
    segment_key = _segment_id(1, trace_id, "b" * 16)
    first_salt = "1" * 32
    second_salt = "2" * 32
    first_payload_key = _payload_key(1, trace_id, first_salt)
    second_payload_key = _payload_key(1, trace_id, second_salt)
    span_a = _payload("a" * 16)
    span_b = _payload("b" * 16)
    span_c = _payload("c" * 16)

    client.sadd(storage.get_payload_key_index(segment_key), first_salt, second_salt)
    client.sadd(first_payload_key, span_a, span_b)
    client.sadd(second_payload_key, span_c)
    client.set(b"span-buf:ic:" + segment_key, 3)
    client.set(b"span-buf:ibc:" + segment_key, len(span_a) + len(span_b) + len(span_c))

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


def test_load_segments_decompresses_payload_batches() -> None:
    storage, client = _storage()
    trace_id = "a" * 32
    segment_key = _segment_id(1, trace_id, "b" * 16)
    salt = "1" * 32
    payload_key = _payload_key(1, trace_id, salt)
    span_a = _payload("a" * 16)
    span_b = _payload("b" * 16)
    compressed = zstandard.ZstdCompressor(level=0).compress(b"\x00".join([span_a, span_b]))

    client.sadd(storage.get_payload_key_index(segment_key), salt)
    client.sadd(payload_key, compressed)
    client.set(b"span-buf:ic:" + segment_key, 2)

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
