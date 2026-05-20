"""
Span buffer is a consumer that takes individual spans from Relay, in the `ingest-spans` topic,
and assembles them to segments of this form:

    {"spans": <span1>,<span2>,<span3>}

We have to do this without having such a thing as segment ID:

    span1 = {"span_id": "a...", "parent_span_id": "b..."}
    span2 = {"span_id": "b...", "parent_span_id": "c..."}
    span3 = {"span_id": "c...", "parent_span_id": "d..."}

In other words, spans only know their parent spans' IDs, and the segment should
be assembled according to those relationships and implied transitive ones.

There are a few ways to detect when a span is a root span (aka segment span):

1. It does not have a parent_span_id
2. It has an explicit is_segment_span marker, or some attribute directly on the span.
3. For some time, no span comes in that identifies itself as parent.
4. The parent span exists in another project.

We simplify this set of conditions for the span buffer:

* Relay writes is_segment based on some other attributes for us, so that we don't have to look at N span-local attributes. This simplifies condition 2.
* The span buffer is sharded by project. Therefore, condition 4 is handled by the code for condition 3, although with some delay.

Segments are flushed out to `buffered-segments` topic under two conditions:

* If the segment has a root span, it is flushed out after `spans.buffer.root-timeout` seconds of inactivity.
* Otherwise, it is flushed out after `spans.buffer.timeout` seconds of inactivity.

Now how does that look like in Redis? For each incoming span, we:

1. Store the span payload in a payload key. Each subsegment gets its own key,
   distributed across Redis cluster nodes. The key uses a unique salt per subsegment
   so that, if the parent segment is over the byte limit, the subsegment can be
   detached into its own segment without merging or copying any data.
   Key: `span-buf:s:{project_id:trace_id:salt}:salt`
2. The Lua script (add-buffer.lua) receives the span IDs and:
   a. Follows redirects from parent_span_id (hashmap at
      "span-buf:ssr:{project_id:trace_id}") to find the segment root.
   b. Updates the redirect table so future spans can find the segment root.
   c. Merges member-keys indexes and counters (ingested count, byte count)
      from span IDs that were previously separate segment roots into the
      current segment root.
   d. If the segment exceeds max_segment_bytes, detaches the subsegment
      into its own segment keyed by the salt.
   e. If the target segment is currently locked by a flusher, detaches the
      subsegment into its own segment so new spans are not written into data
      that is being produced and cleaned up.
3. To a "global queue", we write the segment key, sorted by timeout.

Eventually, flusher subprocesses read timed-out segment keys from the queue,
acquire a per-segment flush lock when configured, fetch the payload keys for
each segment via the member-keys index, load their data, and produce the
segment.

This happens in two steps: Get the to-be-flushed segments in `flush_segments`,
then the consumer produces them, then they are deleted from Redis
(`done_flush_segments`)

On top of this, the global queue is sharded by partition, meaning that each
consumer reads and writes to shards that correspond to its own assigned
partitions. This means that extra care needs to be taken when recreating topics
or using spillover topics, especially when their new partition count is lower
than the original topic.

Segment size enforcement:

Segments can grow unboundedly as spans arrive. To prevent oversized segments from
consuming excessive memory during flush, the buffer enforces a maximum byte limit
per segment (controlled by `spans.buffer.max-segment-bytes`).

Each subsegment is assigned a unique salt. The Lua script tracks cumulative
ingested bytes per segment via `span-buf:ibc` keys. If adding a subsegment would
push the segment over the byte limit, or if the target segment is being flushed,
the script detaches the subsegment into a new segment keyed by the salt instead of
merging it into the parent. The detached segment is independently tracked and flushed.

During flush, segments that exceed `max-segment-bytes` are chunked into multiple
Kafka messages to stay within downstream size limits.

Glossary for types of keys:

    * span-buf:s:{project_id:trace_id:salt}:salt -- payload keys containing span payloads, distributed across cluster nodes.
    * span-buf:mk:{project_id:trace_id}:root_span_id -- member-keys index, tracks which payload keys belong to a segment.
    * span-buf:q:* -- the priority queue, used to determine which segments are ready to be flushed.
    * span-buf:ssr:{project_id:trace_id} -- redirect mappings so that each incoming span ID can be mapped to the right segment.
    * span-buf:hrs:<segment_key> -- flags a segment as "has root span" (HRS).
    * span-buf:ic:<segment_key> -- ingested count, total spans originally ingested for a segment.
    * span-buf:ibc:<segment_key> -- ingested byte count, total bytes originally ingested for a segment.
    * span-buf:fl:<segment_key> -- a per-segment lock (with TTL) to prevent the same segment from being flushed multiple times concurrently.
    <segment_key> -- an internal identifier, see `spans.segment_key` module.
    <salt> -- a unique identifier for a subsegment, determined by hashing all span IDs in the subsegment.
"""

from __future__ import annotations

import itertools
import logging
import math
import uuid
from collections.abc import Generator, MutableMapping, Sequence
from hashlib import blake2b
from typing import Any, NamedTuple, cast

import orjson
import zstandard
from django.conf import settings
from django.utils.functional import cached_property
from sentry_kafka_schemas.schema_types.ingest_spans_v1 import SpanEvent
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry import options
from sentry.constants import DataCategory
from sentry.models.project import Project
from sentry.processing.backpressure.memory import ServiceMemory, iter_cluster_memory_usage
from sentry.spans.buffer_logger import (
    BufferLogger,
    DeadlineUpdateLog,
    FlushSegmentLog,
    ProcessSpansObservability,
    SubsegmentDebugLog,
)
from sentry.spans.buffer_types import EvalshaResult, InsertedSubsegment, Span, Subsegment
from sentry.spans.consumers.process_segments.types import attribute_value
from sentry.spans.debug_trace_logger import DebugTraceLogger
from sentry.spans.segment_key import (
    PayloadKey,
    SegmentKey,
    parse_segment_key,
    segment_key_to_span_id,
)
from sentry.utils import metrics, redis
from sentry.utils.outcomes import Outcome, track_outcome

QueueKey = bytes

logger = logging.getLogger(__name__)


def get_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    return redis.redis_clusters.get_binary(settings.SENTRY_SPAN_BUFFER_CLUSTER)


add_buffer_script = redis.load_redis_script("spans/add-buffer.lua")


type SpanPayload = dict[str, Any]


def _compute_salt(spans: Sequence[Span]) -> str:
    return blake2b(
        b"".join(s.span_id.encode("ascii") for s in spans),
        digest_size=16,
    ).hexdigest()


class OutputSpan(NamedTuple):
    payload: SpanPayload


class FlushedSegment(NamedTuple):
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


class SpansBuffer:
    def __init__(self, assigned_shards: list[int], slice_id: int | None = None):
        self.assigned_shards = list(assigned_shards)
        self.slice_id = slice_id
        self.add_buffer_sha: str | None = None
        self.any_shard_at_limit = False
        self._current_compression_level = None
        self._zstd_compressor: zstandard.ZstdCompressor | None = None
        self._zstd_decompressor = zstandard.ZstdDecompressor()
        self._buffer_logger = BufferLogger()
        self._debug_trace_logger: DebugTraceLogger | None = None

    @cached_property
    def client(self) -> RedisCluster[bytes] | StrictRedis[bytes]:
        return get_redis_client()

    # make it pickleable
    def __reduce__(self):
        return (SpansBuffer, (self.assigned_shards, self.slice_id))

    def _get_span_key(self, project_and_trace: str, span_id: str) -> bytes:
        return f"span-buf:s:{{{project_and_trace}}}:{span_id}".encode("ascii")

    def _get_payload_key(self, project_and_trace: str, span_id: str) -> PayloadKey:
        return f"span-buf:s:{{{project_and_trace}:{span_id}}}:{span_id}".encode("ascii")

    def _get_payload_key_index(self, segment_key: SegmentKey) -> bytes:
        project_id, trace_id, span_id = parse_segment_key(segment_key)
        return b"span-buf:mk:{%s:%s}:%s" % (project_id, trace_id, span_id)

    def _get_flush_lock_key(self, segment_key: SegmentKey) -> bytes:
        return b"span-buf:fl:" + segment_key

    def _get_debug_trace_logger(self) -> DebugTraceLogger:
        if self._debug_trace_logger is None:
            self._debug_trace_logger = DebugTraceLogger(self.client)
        return self._debug_trace_logger

    @metrics.wraps("spans.buffer.process_spans")
    def process_spans(self, spans: Sequence[Span], now: int):
        """
        :param spans: List of to-be-ingested spans.
        :param now: The current time to be used for setting expiration/flush
            deadlines. Used for unit-testing and managing backlogging behavior.
        """

        compression_level = options.get("spans.buffer.compression.level")
        if compression_level != self._current_compression_level:
            self._current_compression_level = compression_level
            if compression_level == -1:
                self._zstd_compressor = None
            else:
                self._zstd_compressor = zstandard.ZstdCompressor(level=compression_level)

        redis_ttl = options.get("spans.buffer.redis-ttl")
        max_spans_per_evalsha = options.get("spans.buffer.max-spans-per-evalsha")
        pipeline_batch_size = options.get("spans.buffer.pipeline-batch-size")
        max_segment_bytes = options.get("spans.buffer.max-segment-bytes")
        flush_lock_ttl = options.get("spans.buffer.flusher.flush-lock-ttl")
        timeout = options.get("spans.buffer.timeout")
        root_timeout = options.get("spans.buffer.root-timeout")

        trees, subsegment_batches = self._push_payloads(
            spans,
            redis_ttl=redis_ttl,
            max_spans_per_evalsha=max_spans_per_evalsha,
            pipeline_batch_size=pipeline_batch_size,
        )

        inserted_subsegments = self._insert_spans(
            subsegment_batches,
            redis_ttl=redis_ttl,
            max_segment_bytes=max_segment_bytes,
            flush_lock_ttl=flush_lock_ttl,
        )

        observability = self._update_queue(
            trees,
            inserted_subsegments,
            now=now,
            redis_ttl=redis_ttl,
            timeout=timeout,
            root_timeout=root_timeout,
        )

        observability.emit_metrics()

    def _build_subsegments(
        self,
        trees: dict[tuple[str, str], list[Span]],
        max_spans_per_evalsha: int,
    ) -> list[Subsegment]:
        # Split large subsegments into chunks to avoid Lua unpack() limits.
        # Chunks share the same parent_span_id but are processed separately.
        subsegments: list[Subsegment] = []
        for (project_and_trace, parent_span_id), spans in trees.items():
            if max_spans_per_evalsha > 0 and len(spans) > max_spans_per_evalsha:
                for chunk in itertools.batched(spans, max_spans_per_evalsha):
                    chunk_list = list(chunk)
                    subsegments.append(
                        Subsegment(
                            project_and_trace,
                            parent_span_id,
                            _compute_salt(chunk_list),
                            chunk_list,
                        )
                    )
            else:
                subsegments.append(
                    Subsegment(
                        project_and_trace,
                        parent_span_id,
                        _compute_salt(spans),
                        spans,
                    )
                )
        return subsegments

    def _batch_subsegments(
        self,
        subsegments: list[Subsegment],
        pipeline_batch_size: int,
    ) -> Sequence[Sequence[Subsegment]]:
        if pipeline_batch_size > 0:
            return list(itertools.batched(subsegments, pipeline_batch_size))
        else:
            return [subsegments]

    def _push_payloads(
        self,
        spans: Sequence[Span],
        *,
        redis_ttl: int,
        max_spans_per_evalsha: int,
        pipeline_batch_size: int,
    ) -> tuple[
        dict[tuple[str, str], list[Span]],
        Sequence[Sequence[Subsegment]],
    ]:
        with metrics.timer("spans.buffer.process_spans.push_payloads"):
            trees = self._group_by_parent(spans)
            subsegments = self._build_subsegments(trees, max_spans_per_evalsha)
            subsegment_batches = self._batch_subsegments(subsegments, pipeline_batch_size)

            for batch in subsegment_batches:
                with self.client.pipeline(transaction=False) as p:
                    for subsegment in batch:
                        set_members = self._prepare_payloads(subsegment.spans)
                        payload_key = self._get_payload_key(
                            subsegment.project_and_trace,
                            subsegment.salt,
                        )
                        p.sadd(payload_key, *set_members)
                        p.expire(payload_key, redis_ttl)

                    p.execute()

            metrics.timing("spans.buffer.process_spans.num_spans", len(spans))
            # This incr metric is needed to get a rate overall.
            metrics.incr("spans.buffer.process_spans.count_spans", amount=len(spans))
            metrics.timing("spans.buffer.process_spans.num_subsegments", len(trees))

        return trees, subsegment_batches

    def _insert_spans(
        self,
        batches: Sequence[Sequence[Subsegment]],
        *,
        redis_ttl: int,
        max_segment_bytes: int,
        flush_lock_ttl: int,
    ) -> list[InsertedSubsegment]:
        with metrics.timer("spans.buffer.process_spans.insert_spans"):
            check_flush_lock = "true" if flush_lock_ttl > 0 else "false"

            # Workaround to make `evalsha` work in pipelines. We ensure the script
            # is loaded just before calling it below. This calls `SCRIPT EXISTS`
            # once per batch.
            add_buffer_sha = self._ensure_script()

            result_subsegments: list[Subsegment] = []
            results: list[Any] = []
            is_root_span_count = 0

            for batch in batches:
                with self.client.pipeline(transaction=False) as p:
                    for subsegment in batch:
                        SubsegmentDebugLog(
                            project_and_trace=subsegment.project_and_trace,
                            parent_span_id=subsegment.parent_span_id,
                            subsegment=subsegment.spans,
                        ).emit(self._get_debug_trace_logger)

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

                        is_root_span_count += sum(span.is_segment_span for span in subsegment.spans)
                        result_subsegments.append(subsegment)

                    results.extend(p.execute())

            assert len(result_subsegments) == len(results)

            inserted_subsegments = [
                InsertedSubsegment(subsegment, EvalshaResult.from_redis_result(result))
                for subsegment, result in zip(result_subsegments, results)
            ]

            metrics.timing("spans.buffer.process_spans.num_is_root_spans", is_root_span_count)
            metrics.timing(
                "spans.buffer.process_spans.num_evalsha_calls", len(inserted_subsegments)
            )

            return inserted_subsegments

    def _update_queue(
        self,
        trees: dict[tuple[str, str], list[Span]],
        inserted_subsegments: Sequence[InsertedSubsegment],
        *,
        now: int,
        redis_ttl: int,
        timeout: int,
        root_timeout: int,
    ) -> ProcessSpansObservability:
        with metrics.timer("spans.buffer.process_spans.update_queue"):
            queue_deletes: dict[bytes, set[bytes]] = {}
            queue_adds: dict[bytes, MutableMapping[str | bytes, int]] = {}
            observability = ProcessSpansObservability()

            for inserted_subsegment in inserted_subsegments:
                subsegment = inserted_subsegment.subsegment
                result = inserted_subsegment.result
                observability.record_evalsha_result(inserted_subsegment.project_and_trace, result)

                queue_key = self._get_queue_key(inserted_subsegment.queue_shard)

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
                ).emit(self.client, self._get_debug_trace_logger)

                delete_set = queue_deletes.setdefault(queue_key, set())
                if not inserted_subsegment.is_detached_segment:
                    delete_set.update(
                        self._get_span_key(subsegment.project_and_trace, span.span_id)
                        for span in trees[subsegment.key]
                    )
                delete_set.discard(result.segment_key)

            self._buffer_logger.log(observability.evalsha_latency_entries)

            with self.client.pipeline(transaction=False) as p:
                for queue_key, adds in queue_adds.items():
                    if adds:
                        p.zadd(queue_key, adds)
                        p.expire(queue_key, redis_ttl)

                for queue_key, deletes in queue_deletes.items():
                    if deletes:
                        p.zrem(queue_key, *deletes)

                p.execute()

            return observability

    def _ensure_script(self) -> str:
        """
        Ensures the Lua script is loaded in Redis and returns its SHA.
        """
        if not self.add_buffer_sha or not self.client.script_exists(self.add_buffer_sha)[0]:
            self.add_buffer_sha = self.client.script_load(add_buffer_script.script)

        return self.add_buffer_sha

    def _get_queue_key(self, shard: int) -> bytes:
        if self.slice_id is not None:
            return f"span-buf:q:{self.slice_id}-{shard}".encode("ascii")
        else:
            return f"span-buf:q:{shard}".encode("ascii")

    def _group_by_parent(self, spans: Sequence[Span]) -> dict[tuple[str, str], list[Span]]:
        """
        Groups partial trees of spans by their top-most parent span ID in the
        provided list. The result is a dictionary where the keys identify a
        top-most known parent, and the value is a flat list of all its
        transitive children.

        For spans with a known segment_id, the grouping is done by the
        segment_id instead of the parent_span_id. This is the case for spans
        extracted from transaction events, or if in the future SDKs provide
        segment IDs.

        :param spans: List of spans to be grouped.
        :return: Dictionary of grouped spans. The key is a tuple of the
            `project_and_trace`, and the `parent_span_id`.
        """
        trees: dict[tuple[str, str], list[Span]] = {}
        redirects: dict[str, dict[str, str]] = {}

        for span in spans:
            project_and_trace = f"{span.project_id}:{span.trace_id}"
            parent = span.effective_parent_id()

            trace_redirects = redirects.setdefault(project_and_trace, {})
            while redirect := trace_redirects.get(parent):
                parent = redirect

            subsegment = trees.setdefault((project_and_trace, parent), [])
            if parent != span.span_id:
                subsegment.extend(trees.pop((project_and_trace, span.span_id), []))
                trace_redirects[span.span_id] = parent
            subsegment.append(span)

        return trees

    def _prepare_payloads(self, spans: list[Span]) -> set[str | bytes]:
        """
        Prepare span payloads for storage. Returns a set of payload bytes.
        """
        if self._zstd_compressor is None:
            return {span.payload for span in spans}

        combined = b"\x00".join(span.payload for span in spans)
        original_size = len(combined)

        with metrics.timer("spans.buffer.compression.cpu_time"):
            compressed = self._zstd_compressor.compress(combined)

        compressed_size = len(compressed)

        compression_ratio = compressed_size / original_size if original_size > 0 else 0
        metrics.timing("spans.buffer.compression.original_size", original_size)
        metrics.timing("spans.buffer.compression.compressed_size", compressed_size)
        metrics.timing("spans.buffer.compression.compression_ratio", compression_ratio)

        return {compressed}

    def _decompress_batch(self, compressed_data: bytes) -> list[bytes]:
        # Check for zstd magic header (0xFD2FB528 in little-endian) --
        # backwards compat with code that did not write compressed payloads.
        with metrics.timer("spans.buffer.decompression.cpu_time"):
            if not compressed_data.startswith(b"\x28\xb5\x2f\xfd"):
                return [compressed_data]

            decompressed_buffer = self._zstd_decompressor.decompress(compressed_data)
            return decompressed_buffer.split(b"\x00")

    def record_stored_segments(self):
        with metrics.timer("spans.buffer.get_stored_segments"):
            with self.client.pipeline(transaction=False) as p:
                for shard in self.assigned_shards:
                    key = self._get_queue_key(shard)
                    p.zcard(key)

                result = p.execute()

        assert len(result) == len(self.assigned_shards)

        for shard_i, queue_size in zip(self.assigned_shards, result):
            metrics.timing(
                "spans.buffer.flush_segments.queue_size",
                queue_size,
                tags={"shard_i": shard_i},
            )

    def get_memory_info(self) -> Generator[ServiceMemory]:
        return iter_cluster_memory_usage(self.client)

    def _acquire_flush_locks(self, segment_keys: Sequence[SegmentKey]) -> set[SegmentKey]:
        """
        Attempts to acquire a lock per segment so that two flushers cannot produce the
        same segment concurrently. Returns the subset of segment keys successfully locked.

        Locking is disabled when `spans.buffer.flusher.flush-lock-ttl` is 0, in that case,
        we just return all segment keys.
        """
        if not segment_keys:
            return set()

        lock_ttl = options.get("spans.buffer.flusher.flush-lock-ttl")
        if lock_ttl <= 0:
            return set(segment_keys)

        with self.client.pipeline(transaction=False) as p:
            for segment_key in segment_keys:
                p.set(self._get_flush_lock_key(segment_key), b"1", ex=lock_ttl, nx=True)
            results = p.execute()

        locks_acquired = {key for key, acquired in zip(segment_keys, results) if acquired}
        locks_contended = len(segment_keys) - len(locks_acquired)
        if locks_contended:
            metrics.incr(
                "spans.buffer.flush_segments.lock_contention",
                amount=locks_contended,
            )
        return locks_acquired

    def flush_segments(self, now: int) -> dict[SegmentKey, FlushedSegment]:
        cutoff = now

        queue_keys = []
        shard_factor = max(1, len(self.assigned_shards))
        max_flush_segments = options.get("spans.buffer.max-flush-segments")
        max_segments_per_shard = math.ceil(max_flush_segments / shard_factor)

        with metrics.timer("spans.buffer.flush_segments.load_segment_ids"):
            with self.client.pipeline(transaction=False) as p:
                for shard in self.assigned_shards:
                    key = self._get_queue_key(shard)
                    p.zrangebyscore(
                        key, 0, cutoff, start=0, num=max_segments_per_shard, withscores=True
                    )
                    queue_keys.append(key)

                result = p.execute()

        segment_keys: list[tuple[int, QueueKey, SegmentKey, float]] = []
        for shard, queue_key, keys_with_scores in zip(self.assigned_shards, queue_keys, result):
            for segment_key, score in keys_with_scores:
                segment_keys.append((shard, queue_key, segment_key, score))

        acquired_locks = self._acquire_flush_locks([k for _, _, k, _ in segment_keys])
        segment_keys = [entry for entry in segment_keys if entry[2] in acquired_locks]

        with metrics.timer("spans.buffer.flush_segments.load_segment_data"):
            # Pass queue mapping to enable TTL expiration detection
            segment_to_queue = {
                segment_key: queue_key for _, queue_key, segment_key, _ in segment_keys
            }
            segments, payload_keys_map = self._load_segment_data(
                [k for _, _, k, _ in segment_keys],
                segment_to_queue,
                now,
            )

        return_segments = {}
        num_has_root_spans = 0
        any_shard_at_limit = False

        for shard, queue_key, segment_key, score in segment_keys:
            segment_span_id = segment_key_to_span_id(segment_key).decode("ascii")
            segment = segments.get(segment_key, [])
            project_id, _, _ = parse_segment_key(segment_key)
            if len(segment) >= max_segments_per_shard:
                any_shard_at_limit = True

            output_spans = []
            has_root_span = False
            metrics.timing("spans.buffer.flush_segments.num_spans_per_segment", len(segment))
            # This incr metric is needed to get a rate overall.
            metrics.incr("spans.buffer.flush_segments.count_spans_per_segment", amount=len(segment))
            for payload in segment:
                span: SpanEvent = orjson.loads(payload)

                if not attribute_value(span, "sentry.segment.id"):
                    attributes = span.get("attributes")
                    if not isinstance(attributes, dict):
                        span["attributes"] = attributes = {}
                    attributes["sentry.segment.id"] = {
                        "type": "string",
                        "value": segment_span_id,
                    }

                is_segment = segment_span_id == span["span_id"]
                span["is_segment"] = is_segment
                if is_segment:
                    has_root_span = True

                output_spans.append(OutputSpan(payload=cast(dict[str, Any], span)))

            metrics.incr(
                "spans.buffer.flush_segments.num_segments_per_shard", tags={"shard_i": shard}
            )
            return_segments[segment_key] = FlushedSegment(
                queue_key=queue_key,
                spans=output_spans,
                project_id=int(project_id.decode("ascii")),
                payload_keys=payload_keys_map.get(segment_key, []),
            )
            num_has_root_spans += int(has_root_span)

            FlushSegmentLog(
                segment_key=segment_key,
                segment_span_id=segment_span_id,
                has_root_span=has_root_span,
                num_spans=len(segment),
                shard=shard,
                queue_key=queue_key,
                timestamp=now,
            ).emit(self._get_debug_trace_logger)

        metrics.timing("spans.buffer.flush_segments.num_segments", len(return_segments))
        metrics.timing("spans.buffer.flush_segments.has_root_span", num_has_root_spans)

        self.any_shard_at_limit = any_shard_at_limit
        return return_segments

    def _load_segment_data(
        self,
        segment_keys: list[SegmentKey],
        segment_to_queue: dict[SegmentKey, QueueKey],
        now: int,
    ) -> tuple[dict[SegmentKey, list[bytes]], dict[SegmentKey, list[PayloadKey]]]:
        """
        Loads the segments from Redis, given a list of segment keys.

        :param segment_keys: List of segment keys to load.
        :param segment_to_queue: Mapping of segment keys to their queue keys for TTL checking.
        :param now: Current timestamp for age calculation.
        :return: payloads mapping segment keys to lists of span payloads.
        """

        page_size = options.get("spans.buffer.segment-page-size")

        payloads: dict[SegmentKey, list[bytes]] = {key: [] for key in segment_keys}
        payload_keys_map: dict[SegmentKey, list[PayloadKey]] = {key: [] for key in segment_keys}

        # Maps each payload key back to the segment it belongs to.
        # Multiple distributed payload keys map to one segment.
        scan_key_to_segment: dict[SegmentKey | PayloadKey, SegmentKey] = {}
        cursors: dict[bytes, int] = {}

        with self.client.pipeline(transaction=False) as p:
            for key in segment_keys:
                p.smembers(self._get_payload_key_index(key))
            mk_results = p.execute()

        for key, payload_key_span_ids in zip(segment_keys, mk_results):
            project_id, trace_id, _ = parse_segment_key(key)
            project_and_trace = f"{project_id.decode('ascii')}:{trace_id.decode('ascii')}"
            segment_payload_keys: list[PayloadKey] = []
            for payload_key_span_id in payload_key_span_ids:
                payload_key = self._get_payload_key(
                    project_and_trace, payload_key_span_id.decode("ascii")
                )
                segment_payload_keys.append(payload_key)
                scan_key_to_segment[payload_key] = key
                cursors[payload_key] = 0
            payload_keys_map[key] = segment_payload_keys

        def _add_spans(key: SegmentKey, raw_data: bytes):
            """
            Decompress and add spans to the segment.
            """
            decompressed = self._decompress_batch(raw_data)
            payloads[key].extend(decompressed)

        while cursors:
            with self.client.pipeline(transaction=False) as p:
                current_keys = []
                for key, cursor in cursors.items():
                    p.sscan(key, cursor=cursor, count=page_size)
                    current_keys.append(key)

                scan_results = p.execute()

            for key, (cursor, scan_values) in zip(current_keys, scan_results):
                segment_key = scan_key_to_segment[key]
                for scan_value in scan_values:
                    if segment_key in payloads:
                        _add_spans(segment_key, scan_value)

                if cursor == 0:
                    del cursors[key]
                else:
                    cursors[key] = cursor

        # Fetch ingested counts for all segments to calculate dropped spans
        with self.client.pipeline(transaction=False) as p:
            for key in segment_keys:
                ingested_count_key = b"span-buf:ic:" + key
                p.get(ingested_count_key)
                ingested_byte_count_key = b"span-buf:ibc:" + key
                p.get(ingested_byte_count_key)

            ingested_results = p.execute()

        # Calculate dropped counts: total ingested - successfully loaded
        redis_ttl = options.get("spans.buffer.redis-ttl")
        root_timeout = options.get("spans.buffer.root-timeout")

        for i, key in enumerate(segment_keys):
            ingested_count = ingested_results[i * 2]
            ingested_byte_count = ingested_results[i * 2 + 1]

            if ingested_byte_count:
                metrics.timing(
                    "spans.buffer.flush_segments.ingested_bytes_per_segment",
                    int(ingested_byte_count),
                )

            if ingested_count:
                total_ingested = int(ingested_count)
                metrics.timing(
                    "spans.buffer.flush_segments.ingested_spans_per_segment", total_ingested
                )
                successfully_loaded = len(payloads.get(key, []))
                dropped = total_ingested - successfully_loaded
                if dropped <= 0:
                    continue

                project_id_bytes, _, _ = parse_segment_key(key)
                project_id_int = int(project_id_bytes)
                try:
                    project = Project.objects.get_from_cache(id=project_id_int)
                except Project.DoesNotExist:
                    logger.warning(
                        "Project does not exist for segment with dropped spans",
                        extra={"project_id": project_id_int},
                    )
                else:
                    track_outcome(
                        org_id=project.organization_id,
                        project_id=project_id_int,
                        key_id=None,
                        outcome=Outcome.INVALID,
                        reason="segment_too_large",
                        category=DataCategory.SPAN_INDEXED,
                        quantity=dropped,
                    )
            elif not payloads.get(key):
                # Both data and metadata are missing. This could be:
                # 1. TTL expiration (segment sat in queue for >1 hour) - TRUE DATA LOSS
                # 2. Race condition (another consumer flushed between load and metadata fetch)
                # Only increment metric if segment is old enough to have actually expired.
                queue_key = segment_to_queue.get(key)
                if queue_key:
                    deadline_score = self.client.zscore(queue_key, key)
                    if deadline_score is not None:
                        deadline = int(deadline_score)
                        time_past_deadline = now - deadline
                        # Estimate segment age: deadline = creation_time + timeout
                        # Use root_timeout as conservative estimate (smaller value)
                        estimated_age = time_past_deadline + root_timeout

                        if estimated_age > redis_ttl:
                            # Segment is older than TTL - true expiration (data loss)
                            metrics.incr("spans.buffer.segment_expired_before_flush")

        for key, spans in payloads.items():
            if not spans:
                # This is a bug, most likely the input topic is not
                # partitioned by trace_id so multiple consumers are writing
                # over each other. The consequence is duplicated segments,
                # worst-case.
                metrics.incr("spans.buffer.empty_segments")

        return payloads, payload_keys_map

    def done_flush_segments(self, segment_keys: dict[SegmentKey, FlushedSegment]):
        metrics.timing("spans.buffer.done_flush_segments.num_segments", len(segment_keys))
        with metrics.timer("spans.buffer.done_flush_segments"):
            queue_removals: dict[bytes, list[SegmentKey]] = {}
            with self.client.pipeline(transaction=False) as p:
                for segment_key, flushed_segment in segment_keys.items():
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
                        mk_key = self._get_payload_key_index(segment_key)
                        p.delete(mk_key)
                        for payload_key in flushed_segment.payload_keys:
                            p.unlink(payload_key)

                    # A segment can be queued in more than one shard when spans from the
                    # same segment land in different Kafka partitions. Releasing the lock
                    # here lets a contending flusher later acquire it and remove those stale
                    # queue entries instead of blocking on ZRANGEBYSCORE until lock TTL expires.
                    # Since the segment metadata and payload keys have already been deleted
                    # above, a stale queue entry cannot produce the segment again.
                    p.delete(self._get_flush_lock_key(segment_key))

                for queue_key, keys in queue_removals.items():
                    for key_batch in itertools.batched(keys, 100):
                        p.zrem(queue_key, *key_batch)

                p.execute()
