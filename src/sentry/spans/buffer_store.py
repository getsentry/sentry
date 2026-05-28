from __future__ import annotations

import time
from collections.abc import Callable, Mapping, Sequence
from typing import Any

from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry import options
from sentry.spans.buffer_types import (
    FlushCandidate,
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
type PreparePayloads = Callable[[list[Span]], set[str | bytes]]
type DecompressPayload = Callable[[bytes], list[bytes]]


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
        return f"span-buf:s:{{{project_and_trace}}}:{span_id}".encode("ascii")

    def get_payload_key(self, project_and_trace: str, span_id: str) -> PayloadKey:
        return f"span-buf:s:{{{project_and_trace}:{span_id}}}:{span_id}".encode("ascii")

    def get_payload_key_index(self, segment_key: SegmentKey) -> bytes:
        project_id, trace_id, span_id = parse_segment_key(segment_key)
        return b"span-buf:mk:{%s:%s}:%s" % (project_id, trace_id, span_id)

    def get_flush_lock_key(self, segment_key: SegmentKey) -> bytes:
        return b"span-buf:fl:" + segment_key

    def get_queue_key(self, shard: int) -> QueueKey:
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
        prepare_payloads: PreparePayloads,
    ) -> None:
        for batch in batches:
            with self.client.pipeline(transaction=False) as p:
                for subsegment in batch:
                    set_members = prepare_payloads(subsegment.spans)
                    payload_key = self.get_payload_key(
                        subsegment.project_and_trace,
                        subsegment.salt,
                    )
                    p.sadd(payload_key, *set_members)
                    p.expire(payload_key, redis_ttl)

                p.execute()

    def insert_subsegments(
        self,
        batches: Sequence[Sequence[Subsegment]],
        *,
        redis_ttl: int,
        max_segment_bytes: int,
        flush_lock_ttl: int,
    ) -> list[InsertedSubsegment]:
        check_flush_lock = "true" if flush_lock_ttl > 0 else "false"

        # Workaround to make `evalsha` work in pipelines. We ensure the script
        # is loaded just before adding pipelined EVALSHA commands.
        add_buffer_sha = self.ensure_script()

        inserted_subsegments: list[InsertedSubsegment] = []
        for batch in batches:
            inserted_subsegments.extend(
                self._insert_subsegment_batch(
                    batch,
                    add_buffer_sha=add_buffer_sha,
                    redis_ttl=redis_ttl,
                    max_segment_bytes=max_segment_bytes,
                    check_flush_lock=check_flush_lock,
                )
            )

        return inserted_subsegments

    def _insert_subsegment_batch(
        self,
        batch: Sequence[Subsegment],
        *,
        add_buffer_sha: str,
        redis_ttl: int,
        max_segment_bytes: int,
        check_flush_lock: str,
    ) -> list[InsertedSubsegment]:
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

        return self._inserted_subsegments_from_results(batch, redis_results)

    def _inserted_subsegments_from_results(
        self,
        subsegments: Sequence[Subsegment],
        redis_results: Sequence[Any],
    ) -> list[InsertedSubsegment]:
        assert len(subsegments) == len(redis_results)
        return [
            InsertedSubsegment.from_redis_result(subsegment, redis_result)
            for subsegment, redis_result in zip(subsegments, redis_results)
        ]

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
        Read ready segment keys from the assigned queue shards.
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

        return (
            self._flush_candidates_from_results(queue_keys, redis_results),
            load_ids_latency_ms,
        )

    def _flush_candidates_from_results(
        self,
        queue_keys: Sequence[QueueKey],
        redis_results: Sequence[Any],
    ) -> list[FlushCandidate]:
        flush_candidates: list[FlushCandidate] = []
        for shard, queue_key, keys_with_scores in zip(
            self.assigned_shards, queue_keys, redis_results
        ):
            for segment_key, score in keys_with_scores:
                flush_candidates.append(FlushCandidate(shard, queue_key, segment_key, score))

        return flush_candidates

    def load_segments(
        self,
        flush_candidates: Sequence[FlushCandidate],
        *,
        decompress_payload: DecompressPayload,
    ) -> tuple[list[LoadedSegment], int, int]:
        """
        Load payload keys, span payload bytes, and persisted metadata for flush candidates.
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
        ingest_metadata = {key: SegmentIngestMetadata() for key in segment_keys}

        with self.client.pipeline(transaction=False) as p:
            for key in segment_keys:
                p.get(b"span-buf:ic:" + key)
                p.get(b"span-buf:ibc:" + key)

            redis_results = p.execute()

        for i, key in enumerate(segment_keys):
            ingest_metadata[key] = SegmentIngestMetadata.from_redis_results(
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

    def get_current_queue_deadline(self, loaded_segment: LoadedSegment) -> int | None:
        deadline_score = self.client.zscore(loaded_segment.queue_key, loaded_segment.segment_key)
        return int(deadline_score) if deadline_score is not None else None
