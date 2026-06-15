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
from collections import defaultdict
from collections.abc import Generator, Sequence
from hashlib import blake2b
from typing import Any, cast

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
    FlusherLogger,
    FlushSegmentLog,
    InsertSpansMetrics,
    SubsegmentDebugLog,
)
from sentry.spans.buffer_store import SpansBufferStore
from sentry.spans.buffer_store import add_buffer_script as add_buffer_script
from sentry.spans.buffer_types import (
    FlushedSegment,
    InsertedSubsegment,
    LoadedSegment,
    OutputSpan,
    Span,
    Subsegment,
)
from sentry.spans.consumers.process_segments.types import attribute_value
from sentry.spans.debug_trace_logger import DebugTraceLogger
from sentry.spans.segment_key import (
    SegmentKey,
    parse_segment_key,
    segment_key_to_span_id,
)
from sentry.utils import metrics, redis
from sentry.utils.outcomes import Outcome, track_outcome

logger = logging.getLogger(__name__)


def get_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    return redis.redis_clusters.get_binary(settings.SENTRY_SPAN_BUFFER_CLUSTER)


def _compute_salt(spans: Sequence[Span]) -> str:
    return blake2b(
        b"".join(s.span_id.encode("ascii") for s in spans),
        digest_size=16,
    ).hexdigest()


class SpansBuffer:
    def __init__(self, assigned_shards: list[int], slice_id: int | None = None):
        self.assigned_shards = list(assigned_shards)
        self.slice_id = slice_id
        self.any_shard_at_limit = False
        self._zstd_decompressor = zstandard.ZstdDecompressor()
        self._buffer_logger = BufferLogger()
        self._flusher_logger = FlusherLogger()
        self._debug_trace_logger: DebugTraceLogger | None = None

    @cached_property
    def client(self) -> RedisCluster[bytes] | StrictRedis[bytes]:
        return get_redis_client()

    @cached_property
    def store(self) -> SpansBufferStore:
        return SpansBufferStore(self.client, self.assigned_shards, self.slice_id)

    # make it pickleable
    def __reduce__(self):
        return (SpansBuffer, (self.assigned_shards, self.slice_id))

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

        self._update_queue(
            trees,
            inserted_subsegments,
            now=now,
            redis_ttl=redis_ttl,
            timeout=timeout,
            root_timeout=root_timeout,
        )

        self._emit_process_spans_count_metrics(spans, trees, inserted_subsegments)

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
            self.store.store_payloads(
                subsegment_batches,
                redis_ttl=redis_ttl,
            )

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
            for batch in batches:
                for subsegment in batch:
                    SubsegmentDebugLog(
                        project_and_trace=subsegment.project_and_trace,
                        parent_span_id=subsegment.parent_span_id,
                        subsegment=subsegment.spans,
                    ).emit(self._get_debug_trace_logger)

            inserted_subsegments = self.store.insert_subsegments(
                batches,
                redis_ttl=redis_ttl,
                max_segment_bytes=max_segment_bytes,
                flush_lock_ttl=flush_lock_ttl,
            )

        # Emit metrics for insert spans / EVALSHA Lua script
        insert_spans_metrics = InsertSpansMetrics.from_inserted_subsegments(inserted_subsegments)
        insert_spans_metrics.emit_metrics()

        # Record cumulative latency per trace slow-operation logger
        self._buffer_logger.log(insert_spans_metrics.evalsha_latency_entries)

        return inserted_subsegments

    def _emit_process_spans_count_metrics(
        self,
        spans: Sequence[Span],
        trees: dict[tuple[str, str], list[Span]],
        inserted_subsegments: Sequence[InsertedSubsegment],
    ) -> None:
        is_root_span_count = sum(
            span.is_segment_span
            for inserted_subsegment in inserted_subsegments
            for span in inserted_subsegment.subsegment.spans
        )

        metrics.timing("spans.buffer.process_spans.num_spans", len(spans))
        # This incr metric is needed to get a rate overall.
        metrics.incr("spans.buffer.process_spans.count_spans", amount=len(spans))
        metrics.timing("spans.buffer.process_spans.num_is_root_spans", is_root_span_count)
        metrics.timing("spans.buffer.process_spans.num_subsegments", len(trees))
        metrics.timing("spans.buffer.process_spans.num_evalsha_calls", len(inserted_subsegments))

    def _update_queue(
        self,
        trees: dict[tuple[str, str], list[Span]],
        inserted_subsegments: Sequence[InsertedSubsegment],
        *,
        now: int,
        redis_ttl: int,
        timeout: int,
        root_timeout: int,
    ) -> None:
        self.store.update_queue(
            trees,
            inserted_subsegments,
            now=now,
            redis_ttl=redis_ttl,
            timeout=timeout,
            root_timeout=root_timeout,
            get_debug_trace_logger=self._get_debug_trace_logger,
        )

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
                    key = self.store.get_queue_key(shard)
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

    def flush_segments(self, now: int) -> dict[SegmentKey, FlushedSegment]:
        """
        Select queued segments and prepare them for Kafka production.

        This orchestrates the flush path: load ready queue entries, acquire
        per-segment locks, load payload data, emit loss/flush observability, and
        return producer-ready FlushedSegment objects. SpanFlusher produces those
        objects to Kafka and calls done_flush_segments after successful delivery.
        """
        shard_factor = max(1, len(self.assigned_shards))
        max_flush_segments = options.get("spans.buffer.max-flush-segments")
        max_segments_per_shard = math.ceil(max_flush_segments / shard_factor)

        flush_candidates, load_ids_latency_ms = self.store.load_flush_candidates(
            now,
            max_segments_per_shard,
        )

        flush_candidates = self.store.acquire_flush_locks(flush_candidates)

        loaded_segments, load_data_latency_ms, decompress_latency_ms = self.store.load_segments(
            flush_candidates,
            decompress_payload=self._decompress_batch,
        )

        self._record_segment_loss_metrics(loaded_segments, now)

        flushed_segments, num_has_root_spans, any_shard_at_limit = self._build_flushed_segments(
            loaded_segments,
            max_segments_per_shard,
            now,
        )

        self._flusher_logger.log_loaded_segments(
            loaded_segments,
            load_ids_latency_ms=load_ids_latency_ms,
            load_data_latency_ms=load_data_latency_ms,
            decompress_latency_ms=decompress_latency_ms,
        )

        metrics.timing("spans.buffer.flush_segments.num_segments", len(flushed_segments))
        metrics.timing("spans.buffer.flush_segments.has_root_span", num_has_root_spans)

        self.any_shard_at_limit = any_shard_at_limit
        return flushed_segments

    def _build_flushed_segments(
        self,
        loaded_segments: Sequence[LoadedSegment],
        max_segments_per_shard: int,
        now: int,
    ) -> tuple[dict[SegmentKey, FlushedSegment], int, bool]:
        """
        Convert loaded payload bytes into FlushedSegment objects that contain
        the segment metadata and span payloads.
        """
        return_segments: dict[SegmentKey, FlushedSegment] = {}
        num_has_root_spans = 0
        any_shard_at_limit = False

        for loaded_segment in loaded_segments:
            segment_key = loaded_segment.segment_key
            segment_span_id = segment_key_to_span_id(segment_key).decode("ascii")
            segment = loaded_segment.payloads
            project_id, _, _ = parse_segment_key(segment_key)
            if len(segment) >= max_segments_per_shard:
                any_shard_at_limit = True

            output_spans: list[OutputSpan] = []
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
                "spans.buffer.flush_segments.num_segments_per_shard",
                tags={"shard_i": loaded_segment.shard},
            )
            return_segments[segment_key] = FlushedSegment(
                queue_key=loaded_segment.queue_key,
                spans=output_spans,
                project_id=int(project_id.decode("ascii")),
                payload_keys=loaded_segment.payload_keys,
            )
            num_has_root_spans += int(has_root_span)

            FlushSegmentLog(
                segment_key=segment_key,
                segment_span_id=segment_span_id,
                has_root_span=has_root_span,
                num_spans=len(segment),
                shard=loaded_segment.shard,
                queue_key=loaded_segment.queue_key,
                timestamp=now,
            ).emit(self._get_debug_trace_logger)

        return return_segments, num_has_root_spans, any_shard_at_limit

    def _record_segment_loss_metrics(
        self,
        loaded_segments: Sequence[LoadedSegment],
        now: int,
    ) -> None:
        """
        Emit loss and expiration metrics for loaded segments.
        """
        # Calculate dropped counts: total ingested - successfully loaded
        redis_ttl = options.get("spans.buffer.redis-ttl")
        root_timeout = options.get("spans.buffer.root-timeout")

        dropped_by_project: defaultdict[int, int] = defaultdict(int)

        for loaded_segment in loaded_segments:
            ingest_metadata = loaded_segment.ingest_metadata

            if ingest_metadata.ingested_byte_count is not None:
                metrics.timing(
                    "spans.buffer.flush_segments.ingested_bytes_per_segment",
                    ingest_metadata.ingested_byte_count,
                )

            if ingest_metadata.ingested_count is not None:
                total_ingested = ingest_metadata.ingested_count
                metrics.timing(
                    "spans.buffer.flush_segments.ingested_spans_per_segment", total_ingested
                )
                successfully_loaded = len(loaded_segment.payloads)
                dropped = total_ingested - successfully_loaded
                if dropped <= 0:
                    continue

                project_id_bytes, _, _ = parse_segment_key(loaded_segment.segment_key)
                project_id_int = int(project_id_bytes)
                dropped_by_project[project_id_int] += dropped
            elif not loaded_segment.payloads:
                # Both data and metadata are missing. This could be:
                # 1. TTL expiration (segment sat in queue for >1 hour) - TRUE DATA LOSS
                # 2. Race condition (another consumer flushed between load and metadata fetch)
                # Only increment metric if segment is old enough to have actually expired.
                deadline = self.store.get_current_queue_deadline(loaded_segment)
                if deadline is not None:
                    time_past_deadline = now - deadline
                    # Estimate segment age: deadline = creation_time + timeout
                    # Use root_timeout as conservative estimate (smaller value)
                    estimated_age = time_past_deadline + root_timeout

                    if estimated_age > redis_ttl:
                        # Segment is older than TTL - true expiration (data loss)
                        metrics.incr("spans.buffer.segment_expired_before_flush")

        if dropped_by_project:
            projects_by_id = {
                project.id: project
                for project in Project.objects.get_many_from_cache(list(dropped_by_project.keys()))
            }
            for project_id, dropped in dropped_by_project.items():
                project = projects_by_id.get(project_id)
                if project is None:
                    logger.warning(
                        "Project does not exist for segment with dropped spans",
                        extra={"project_id": project_id},
                    )
                    continue
                track_outcome(
                    org_id=project.organization_id,
                    project_id=project_id,
                    key_id=None,
                    outcome=Outcome.INVALID,
                    reason="segment_too_large",
                    category=DataCategory.SPAN_INDEXED,
                    quantity=dropped,
                )

        for loaded_segment in loaded_segments:
            if not loaded_segment.payloads:
                # This is a bug, most likely the input topic is not
                # partitioned by trace_id so multiple consumers are writing
                # over each other. The consequence is duplicated segments,
                # worst-case.
                metrics.incr("spans.buffer.empty_segments")

    def done_flush_segments(self, segment_keys: dict[SegmentKey, FlushedSegment]):
        metrics.timing("spans.buffer.done_flush_segments.num_segments", len(segment_keys))
        with metrics.timer("spans.buffer.done_flush_segments"):
            self.store.cleanup_flushed_segments(segment_keys)
