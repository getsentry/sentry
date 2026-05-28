from __future__ import annotations

import builtins
from unittest import mock

import orjson
import zstandard

from sentry.spans.buffer_store import SpansBufferStore
from sentry.spans.buffer_types import FlushCandidate
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

    def pipeline(self, transaction: bool = False):
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

    def smembers(self, key: bytes) -> builtins.set[bytes]:
        return self.sets.get(key, builtins.set())

    def sscan(self, key: bytes, cursor: int = 0, count: int | None = None):
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
    ):
        values = [
            (value, score)
            for value, score in self.zsets.get(key, {}).items()
            if min_score <= score <= max_score
        ]
        values.sort(key=lambda item: item[1])
        if num is not None:
            values = values[start : start + num]
        else:
            values = values[start:]

        if withscores:
            return values
        return [value for value, _ in values]


class _StoragePipeline:
    def __init__(self, client: _StorageRedis) -> None:
        self.client = client
        self.commands: list[tuple[str, tuple[object, ...]]] = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        return None

    def smembers(self, key: bytes) -> None:
        self.commands.append(("smembers", (key,)))

    def sscan(self, key: bytes, cursor: int = 0, count: int | None = None) -> None:
        self.commands.append(("sscan", (key, cursor, count)))

    def get(self, key: bytes) -> None:
        self.commands.append(("get", (key,)))

    def set(self, key: bytes, value: bytes | int, ex: int | None = None, nx: bool = False) -> None:
        self.commands.append(("set", (key, value, ex, nx)))

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

    def execute(self):
        results = []
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
