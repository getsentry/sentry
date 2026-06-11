from __future__ import annotations

import itertools
import time
from collections.abc import Callable, Mapping, MutableMapping, Sequence
from typing import Any

import zstandard
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry import options
from sentry.spans.buffer_logger import DeadlineUpdateLog
from sentry.spans.buffer_types import (
    FlushCandidate,
    FlushedSegment,
    InsertedSubsegment,
    LoadedSegment,
    QueueKey,
    SegmentIngestMetadata,
    Span,
    Subsegment,
)
from sentry.spans.segment_key import PayloadKey, SegmentKey, parse_segment_key
from sentry.utils import metrics, redis

add_buffer_script = redis.load_redis_script("spans/add-buffer.lua")

type RedisClient = RedisCluster[bytes] | StrictRedis[bytes]
type DecompressPayload = Callable[[bytes], list[bytes]]
type GetDebugTraceLogger = Callable[[], Any]


class SpansBufferStore:
    """
    Redis-backed store for the span buffer.

    Methods in this class translate Redis command output back into span buffer
    entities so callers do not need to pair raw result lists with input metadata.
    """

    def __init__(
        self,
        client: RedisClient,
        assigned_shards: Sequence[int],
        slice_id: int | None = None,
    ) -> None:
        self.client = client
        self.assigned_shards = list(assigned_shards)
        self.slice_id = slice_id
        self.add_buffer_sha: str | None = None

    def get_span_key(self, project_and_trace: str, span_id: str) -> bytes:
        """
        Build the Redis key for the temporary set containing a span payload.
        """
        return f"span-buf:s:{{{project_and_trace}}}:{span_id}".encode("ascii")

    def get_payload_key(self, project_and_trace: str, span_id: str) -> PayloadKey:
        """
        Build the Redis key for payload bytes stored for a subsegment.
        """
        return f"span-buf:s:{{{project_and_trace}:{span_id}}}:{span_id}".encode("ascii")

    def get_payload_key_index(self, segment_key: SegmentKey) -> bytes:
        """
        Build the Redis key for the set that indexes payload keys by segment.
        """
        project_id, trace_id, span_id = parse_segment_key(segment_key)
        return b"span-buf:mk:{%s:%s}:%s" % (project_id, trace_id, span_id)

    def get_flush_lock_key(self, segment_key: SegmentKey) -> bytes:
        """
        Build the Redis key used to lock a segment while it is being flushed.
        """
        return b"span-buf:fl:" + segment_key

    def get_queue_key(self, shard: int) -> QueueKey:
        """
        Build the Redis sorted-set key for a queue shard.
        """
        if self.slice_id is not None:
            return f"span-buf:q:{self.slice_id}-{shard}".encode("ascii")
        else:
            return f"span-buf:q:{shard}".encode("ascii")

    def ensure_script(self) -> str:
        """
        Ensures the Lua script is loaded in Redis and returns its SHA.
        """
        if not self.add_buffer_sha or not self.client.script_exists(self.add_buffer_sha)[0]:
            self.add_buffer_sha = self.client.script_load(add_buffer_script.script)

        return self.add_buffer_sha

    def store_payloads(
        self,
        batches: Sequence[Sequence[Subsegment]],
        *,
        redis_ttl: int,
    ) -> None:
        """
        Store subsegment payload bytes in Redis sets keyed by subsegment salt.
        """
        compression_level = options.get("spans.buffer.compression.level")
        zstd_compressor = (
            None if compression_level == -1 else zstandard.ZstdCompressor(level=compression_level)
        )

        for batch in batches:
            with self.client.pipeline(transaction=False) as p:
                for subsegment in batch:
                    set_members = self._prepare_payloads(
                        subsegment.spans,
                        zstd_compressor,
                    )
                    payload_key = self.get_payload_key(
                        subsegment.project_and_trace,
                        subsegment.salt,
                    )
                    p.sadd(payload_key, *set_members)
                    p.expire(payload_key, redis_ttl)

                p.execute()

    def _prepare_payloads(
        self,
        spans: list[Span],
        zstd_compressor: zstandard.ZstdCompressor | None,
    ) -> set[str | bytes]:
        if zstd_compressor is None:
            return {span.payload for span in spans}

        combined = b"\x00".join(span.payload for span in spans)
        original_size = len(combined)

        with metrics.timer("spans.buffer.compression.cpu_time"):
            compressed = zstd_compressor.compress(combined)

        compressed_size = len(compressed)

        compression_ratio = compressed_size / original_size if original_size > 0 else 0
        metrics.timing("spans.buffer.compression.original_size", original_size)
        metrics.timing("spans.buffer.compression.compressed_size", compressed_size)
        metrics.timing("spans.buffer.compression.compression_ratio", compression_ratio)

        return {compressed}

    def insert_subsegments(
        self,
        batches: Sequence[Sequence[Subsegment]],
        *,
        redis_ttl: int,
        max_segment_bytes: int,
        flush_lock_ttl: int,
    ) -> list[InsertedSubsegment]:
        """
        Run the add-buffer Lua script and pair each result with its input subsegment.
        """
        check_flush_lock = "true" if flush_lock_ttl > 0 else "false"

        # Workaround to make `evalsha` work in pipelines. We ensure the script
        # is loaded just before adding pipelined EVALSHA commands.
        add_buffer_sha = self.ensure_script()

        inserted_subsegments: list[InsertedSubsegment] = []
        for batch in batches:
            with self.client.pipeline(transaction=False) as p:
                for subsegment in batch:
                    p.execute_command(
                        "EVALSHA",
                        add_buffer_sha,
                        1,
                        subsegment.project_and_trace,
                        len(subsegment.spans),
                        subsegment.parent_span_id,
                        "true" if subsegment.has_segment_span else "false",
                        redis_ttl,
                        subsegment.byte_count,
                        max_segment_bytes,
                        subsegment.salt,
                        check_flush_lock,
                        *subsegment.span_ids,
                    )

                redis_results = p.execute()

            assert len(batch) == len(redis_results)
            inserted_subsegments.extend(
                InsertedSubsegment.from_redis_result(subsegment, redis_result)
                for subsegment, redis_result in zip(batch, redis_results)
            )

        return inserted_subsegments

    def update_queue(
        self,
        trees: dict[tuple[str, str], list[Span]],
        inserted_subsegments: Sequence[InsertedSubsegment],
        *,
        now: int,
        redis_ttl: int,
        timeout: int,
        root_timeout: int,
        get_debug_trace_logger: GetDebugTraceLogger,
    ) -> None:
        with metrics.timer("spans.buffer.process_spans.update_queue"):
            queue_deletes: dict[QueueKey, set[bytes]] = {}
            queue_adds: dict[QueueKey, MutableMapping[str | bytes, int]] = {}

            for inserted_subsegment in inserted_subsegments:
                subsegment = inserted_subsegment.subsegment
                result = inserted_subsegment.result

                queue_key = self.get_queue_key(inserted_subsegment.queue_shard)

                # If the currently processed span is a root span, OR the buffer
                # already had a root span inside, use a different timeout than usual.
                offset = root_timeout if result.has_root_span else timeout

                zadd_items = queue_adds.setdefault(queue_key, {})

                new_deadline = now + offset
                zadd_items[result.segment_key] = new_deadline

                DeadlineUpdateLog(
                    segment_key=result.segment_key,
                    project_and_trace=inserted_subsegment.project_and_trace,
                    queue_key=queue_key,
                    new_deadline=new_deadline,
                    message_timestamp=now,
                    has_root_span=result.has_root_span,
                ).emit(self.client, get_debug_trace_logger)

                delete_set = queue_deletes.setdefault(queue_key, set())
                if not inserted_subsegment.is_detached_segment:
                    delete_set.update(
                        self.get_span_key(subsegment.project_and_trace, span.span_id)
                        for span in trees[subsegment.key]
                    )
                delete_set.discard(result.segment_key)

            with self.client.pipeline(transaction=False) as p:
                for queue_key, adds in queue_adds.items():
                    if adds:
                        p.zadd(queue_key, adds)
                        p.expire(queue_key, redis_ttl)

                for queue_key, deletes in queue_deletes.items():
                    if deletes:
                        p.zrem(queue_key, *deletes)

                p.execute()

    def acquire_flush_locks(
        self, flush_candidates: Sequence[FlushCandidate]
    ) -> list[FlushCandidate]:
        """
        Attempts to acquire a lock per segment so that two flushers cannot produce the
        same segment concurrently. Returns the subset of flush candidates successfully
        locked.

        Locking is disabled when `spans.buffer.flusher.flush-lock-ttl` is 0, in that case,
        we just return all flush candidates.
        """
        if not flush_candidates:
            return []

        lock_ttl = options.get("spans.buffer.flusher.flush-lock-ttl")
        if lock_ttl <= 0:
            return list(flush_candidates)

        with self.client.pipeline(transaction=False) as p:
            for flush_candidate in flush_candidates:
                p.set(
                    self.get_flush_lock_key(flush_candidate.segment_key),
                    b"1",
                    ex=lock_ttl,
                    nx=True,
                )
            results = p.execute()

        locked_candidates = [
            flush_candidate
            for flush_candidate, acquired in zip(flush_candidates, results)
            if acquired
        ]
        locks_contended = len(flush_candidates) - len(locked_candidates)
        if locks_contended:
            metrics.incr(
                "spans.buffer.flush_segments.lock_contention",
                amount=locks_contended,
            )
        return locked_candidates

    def load_flush_candidates(
        self,
        cutoff: int,
        max_segments_per_shard: int,
    ) -> tuple[list[FlushCandidate], int]:
        """
        Read queued segments whose deadline is at or before the cutoff.

        Returns flush candidates paired with the total Redis read latency.
        """
        queue_keys = []

        ids_start = time.monotonic()
        with metrics.timer("spans.buffer.flush_segments.load_segment_ids"):
            with self.client.pipeline(transaction=False) as p:
                for shard in self.assigned_shards:
                    key = self.get_queue_key(shard)
                    p.zrangebyscore(
                        key, 0, cutoff, start=0, num=max_segments_per_shard, withscores=True
                    )
                    queue_keys.append(key)

                redis_results = p.execute()
        load_ids_latency_ms = int((time.monotonic() - ids_start) * 1000)

        flush_candidates: list[FlushCandidate] = []
        for shard, queue_key, keys_with_scores in zip(
            self.assigned_shards, queue_keys, redis_results
        ):
            for result in keys_with_scores:
                flush_candidates.append(FlushCandidate.from_redis_result(shard, queue_key, result))

        return flush_candidates, load_ids_latency_ms

    def load_segments(
        self,
        flush_candidates: Sequence[FlushCandidate],
        *,
        decompress_payload: DecompressPayload,
    ) -> tuple[list[LoadedSegment], int, int]:
        """
        Load payload keys, span payload bytes, and ingest metadata for candidates.

        Returns loaded segments plus total load latency and payload
        decompression latency, both in milliseconds.
        """
        data_start = time.monotonic()
        segment_keys = [candidate.segment_key for candidate in flush_candidates]
        with metrics.timer("spans.buffer.flush_segments.load_segment_data"):
            page_size = options.get("spans.buffer.segment-page-size")
            payload_keys = self.load_payload_keys(segment_keys)
            payloads, decompress_latency_ms = self.load_payloads_from_keys(
                segment_keys,
                payload_keys,
                page_size,
                decompress_payload=decompress_payload,
            )
        load_data_latency_ms = int((time.monotonic() - data_start) * 1000)
        ingest_metadata = self.load_segment_ingest_metadata(segment_keys)
        loaded_segments = [
            LoadedSegment(
                flush_candidate,
                payloads.get(flush_candidate.segment_key, []),
                payload_keys.get(flush_candidate.segment_key, []),
                ingest_metadata.get(flush_candidate.segment_key, SegmentIngestMetadata()),
            )
            for flush_candidate in flush_candidates
        ]

        return loaded_segments, load_data_latency_ms, decompress_latency_ms

    def load_payload_keys(
        self, segment_keys: Sequence[SegmentKey]
    ) -> dict[SegmentKey, list[PayloadKey]]:
        """
        Load the payload keys indexed under each segment key.

        Segment keys point to member-key indexes; indexes contain payload keys
        that point to span payloads for the segment.
        """
        payload_keys: dict[SegmentKey, list[PayloadKey]] = {key: [] for key in segment_keys}

        with self.client.pipeline(transaction=False) as p:
            for key in segment_keys:
                p.smembers(self.get_payload_key_index(key))
            mk_results = p.execute()

        for key, payload_key_span_ids in zip(segment_keys, mk_results):
            project_id, trace_id, _ = parse_segment_key(key)
            project_and_trace = f"{project_id.decode('ascii')}:{trace_id.decode('ascii')}"
            for payload_key_span_id in payload_key_span_ids:
                payload_key = self.get_payload_key(
                    project_and_trace, payload_key_span_id.decode("ascii")
                )
                payload_keys[key].append(payload_key)

        return payload_keys

    def load_segment_ingest_metadata(
        self, segment_keys: Sequence[SegmentKey]
    ) -> dict[SegmentKey, SegmentIngestMetadata]:
        """
        Load ingest-time counts stored alongside each segment.
        """
        ingest_metadata = {key: SegmentIngestMetadata() for key in segment_keys}

        with self.client.pipeline(transaction=False) as p:
            for key in segment_keys:
                p.get(b"span-buf:ic:" + key)
                p.get(b"span-buf:ibc:" + key)

            redis_results = p.execute()

        for i, key in enumerate(segment_keys):
            ingest_metadata[key] = SegmentIngestMetadata.from_redis_result(
                redis_results[i * 2],
                redis_results[i * 2 + 1],
            )

        return ingest_metadata

    def load_payloads_from_keys(
        self,
        segment_keys: Sequence[SegmentKey],
        payload_keys: Mapping[SegmentKey, Sequence[PayloadKey]],
        page_size: int,
        *,
        decompress_payload: DecompressPayload,
    ) -> tuple[dict[SegmentKey, list[bytes]], int]:
        """
        Scan payload keys and return decompressed payloads grouped by segment key.
        """
        payloads: dict[SegmentKey, list[bytes]] = {key: [] for key in segment_keys}
        decompress_latency_ms = 0.0
        segment_by_payload_key = {
            payload_key: segment_key
            for segment_key, segment_payload_keys in payload_keys.items()
            for payload_key in segment_payload_keys
        }
        cursors = {payload_key: 0 for payload_key in segment_by_payload_key}

        def _add_spans(key: SegmentKey, raw_data: bytes) -> None:
            nonlocal decompress_latency_ms

            decompress_start = time.monotonic()
            decompressed = decompress_payload(raw_data)
            decompress_latency_ms += (time.monotonic() - decompress_start) * 1000
            payloads[key].extend(decompressed)

        while cursors:
            with self.client.pipeline(transaction=False) as p:
                current_keys = []
                for key, cursor in cursors.items():
                    p.sscan(key, cursor=cursor, count=page_size)
                    current_keys.append(key)

                scan_results = p.execute()

            for key, (cursor, scan_values) in zip(current_keys, scan_results):
                segment_key = segment_by_payload_key[key]
                for scan_value in scan_values:
                    if segment_key in payloads:
                        _add_spans(segment_key, scan_value)

                if cursor == 0:
                    del cursors[key]
                else:
                    cursors[key] = cursor

        return payloads, int(decompress_latency_ms)

    def get_current_queue_deadlines(
        self, loaded_segments: Sequence[LoadedSegment]
    ) -> dict[SegmentKey, int | None]:
        """
        Read the current queue deadlines for loaded segments that are still queued.
        """
        if not loaded_segments:
            return {}

        with self.client.pipeline(transaction=False) as p:
            for loaded_segment in loaded_segments:
                p.zscore(loaded_segment.queue_key, loaded_segment.segment_key)

            deadline_scores = p.execute()

        return {
            loaded_segment.segment_key: int(score) if score is not None else None
            for loaded_segment, score in zip(loaded_segments, deadline_scores)
        }

    def cleanup_flushed_segments(
        self,
        flushed_segments: Mapping[SegmentKey, FlushedSegment],
    ) -> None:
        """
        Remove Redis data for segments that were successfully produced to Kafka.
        """
        queue_removals: dict[QueueKey, list[SegmentKey]] = {}
        with self.client.pipeline(transaction=False) as p:
            for segment_key, flushed_segment in flushed_segments.items():
                p.delete(b"span-buf:hrs:" + segment_key)
                p.delete(b"span-buf:ic:" + segment_key)
                p.delete(b"span-buf:ibc:" + segment_key)
                queue_removals.setdefault(flushed_segment.queue_key, []).append(segment_key)

                project_id, trace_id, _ = parse_segment_key(segment_key)
                redirect_map_key = b"span-buf:ssr:{%s:%s}" % (project_id, trace_id)

                for span_batch in itertools.batched(flushed_segment.spans, 100):
                    span_ids = [output_span.payload["span_id"] for output_span in span_batch]
                    p.hdel(redirect_map_key, *span_ids)

                if flushed_segment.payload_keys:
                    p.delete(self.get_payload_key_index(segment_key))
                    for payload_key in flushed_segment.payload_keys:
                        p.unlink(payload_key)

                # A segment can be queued in more than one shard when spans from the
                # same segment land in different Kafka partitions. Releasing the lock
                # here lets a contending flusher later acquire it and remove those stale
                # queue entries instead of blocking on ZRANGEBYSCORE until lock TTL expires.
                # Since the segment metadata and payload keys have already been deleted
                # above, a stale queue entry cannot produce the segment again.
                p.delete(self.get_flush_lock_key(segment_key))

            for queue_key, keys in queue_removals.items():
                for key_batch in itertools.batched(keys, 100):
                    p.zrem(queue_key, *key_batch)

            p.execute()
