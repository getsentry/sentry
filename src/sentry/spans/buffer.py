"""
Span buffer is a consumer that takes individual spans from snuba-spans (soon
ingest-spans, anyway, from Relay) and assembles them to segments of this form:

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

Segments are flushed out to `buffered-spans` topic under two conditions:

* If the segment has a root span, it is flushed out after `span_buffer_root_timeout` seconds of inactivity.
* Otherwise, it is flushed out after `span_buffer_timeout` seconds of inactivity.

Now how does that look like in Redis? For each incoming span, we:

1. Try to figure out what the name of the respective span buffer is (`set_key` in `add-buffer.lua`)
  a. We look up any "redirects" from the span buffer's parent_span_id (hashmap at "span-buf:ssr:{project_id:trace_id}") to another key.
  b. Otherwise we use "span-buf:s:{project_id:trace_id}:span_id"
2. Rename any span buffers keyed under the span's own span ID to `set_key`, merging their contents.
3. Add the ingested span's payload to the set under `set_key`.
4. To a "global queue", we write the set's key, sorted by timeout.

Eventually, flushing cronjob looks at that global queue, and removes all timed
out keys from it. Then fetches the sets associated with those keys, and deletes
the sets.

This happens in two steps: Get the to-be-flushed segments in `flush_segments`,
then the consumer produces them, then they are deleted from Redis
(`done_flush_segments`)

On top of this, the global queue is sharded by partition, meaning that each
consumer reads and writes to shards that correspond to its own assigned
partitions. This means that extra care needs to be taken when recreating topics
or using spillover topics, especially when their new partition count is lower
than the original topic.

Glossary for types of keys:

    * span-buf:s:* -- the actual set keys, containing span payloads. Each key contains all data for a segment. The most memory-intensive kind of key.
    * span-buf:q:* -- the priority queue, used to determine which segments are ready to be flushed.
    * span-buf:hrs:* -- simple bool key to flag a segment as "has root span" (HRS)
    * span-buf:ssr:* -- redirect mappings so that each incoming span ID can be mapped to the right span-buf:s: set.
    * span-buf:ic:* -- ingested count, tracks total number of spans originally ingested for a segment (used to calculate dropped spans for outcome tracking)
    * span-buf:ibc:* -- ingested byte count, tracks total bytes originally ingested for a segment
"""

from __future__ import annotations

import itertools
import logging
import math
import time
from collections.abc import Generator, MutableMapping, Sequence
from typing import Any, NamedTuple

import orjson
import zstandard
from django.conf import settings
from django.utils.functional import cached_property
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry import options
from sentry.constants import DataCategory
from sentry.models.project import Project
from sentry.processing.backpressure.memory import ServiceMemory, iter_cluster_memory_usage
from sentry.spans.buffer_logger import (
    BufferLogger,
    EvalshaData,
    FlusherLogEntry,
    FlusherLogger,
    emit_observability_metrics,
)
from sentry.spans.consumers.process_segments.types import attribute_value
from sentry.spans.debug_trace_logger import DebugTraceLogger
from sentry.spans.segment_key import (
    DistributedPayloadKey,
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
done_flush_segment_script = redis.load_redis_script("spans/done-flush-segment.lua")
done_flush_segment_data_script = redis.load_redis_script("spans/done-flush-segment-data.lua")


# NamedTuples are faster to construct than dataclasses
class Span(NamedTuple):
    trace_id: str
    span_id: str
    parent_span_id: str | None
    segment_id: str | None
    project_id: int
    payload: bytes
    end_timestamp: float
    is_segment_span: bool = False
    partition: int = 0

    def effective_parent_id(self):
        # Note: For the case where the span's parent is in another project, we
        # will still flush the segment-without-root-span as one unit, just after
        # `timeout` rather than `root-timeout` seconds.
        if self.is_segment_span:
            return self.span_id
        else:
            return self.segment_id or self.parent_span_id or self.span_id


class OutputSpan(NamedTuple):
    payload: dict[str, Any]


class FlushedSegment(NamedTuple):
    queue_key: QueueKey
    spans: list[OutputSpan]
    project_id: int  # Used to track outcomes
    score: float = (
        0.0  # Queue score at flush time, used for conditional cleanup in done_flush_segments
    )
    ingested_count: int = 0  # Ingested count at flush time, used for conditional data cleanup
    distributed_payload_keys: list[DistributedPayloadKey] = []  # For cleanup


class SpansBuffer:
    def __init__(self, assigned_shards: list[int], slice_id: int | None = None):
        self.assigned_shards = list(assigned_shards)
        self.slice_id = slice_id
        self.add_buffer_sha: str | None = None
        self.done_flush_segment_sha: str | None = None
        self.done_flush_segment_data_sha: str | None = None
        self.any_shard_at_limit = False
        self._last_decompress_latency_ms = 0
        self._current_compression_level = None
        self._zstd_compressor: zstandard.ZstdCompressor | None = None
        self._zstd_decompressor = zstandard.ZstdDecompressor()
        self._buffer_logger = BufferLogger()
        self._flusher_logger = FlusherLogger()
        self._debug_trace_logger: DebugTraceLogger | None = None
        self._distributed_payload_keys_map: dict[SegmentKey, list[bytes]] = {}

    @cached_property
    def client(self) -> RedisCluster[bytes] | StrictRedis[bytes]:
        return get_redis_client()

    # make it pickleable
    def __reduce__(self):
        return (SpansBuffer, (self.assigned_shards, self.slice_id))

    def _get_span_key(self, project_and_trace: str, span_id: str) -> bytes:
        return f"span-buf:s:{{{project_and_trace}}}:{span_id}".encode("ascii")

    def _get_distributed_payload_key(
        self, project_and_trace: str, span_id: str
    ) -> DistributedPayloadKey:
        return f"span-buf:s:{{{project_and_trace}:{span_id}}}:{span_id}".encode("ascii")

    def _get_payload_key_index(self, segment_key: SegmentKey) -> bytes:
        project_id, trace_id, span_id = parse_segment_key(segment_key)
        return b"span-buf:mk:{%s:%s}:%s" % (project_id, trace_id, span_id)

    def _cleanup_distributed_keys(self, segment_keys: set[SegmentKey]) -> None:
        """Delete member-keys tracking sets and distributed payload keys for the
        given segments, and remove them from the payload keys map so
        done_flush_segments doesn't try again."""
        with self.client.pipeline(transaction=False) as p:
            for key in segment_keys:
                payload_keys = self._distributed_payload_keys_map.get(key, [])
                if payload_keys:
                    mk_key = self._get_payload_key_index(key)
                    p.delete(mk_key)
                    for batch in itertools.batched(payload_keys, 100):
                        p.unlink(*batch)
                self._distributed_payload_keys_map.pop(key, None)
            p.execute()

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
        timeout = options.get("spans.buffer.timeout")
        root_timeout = options.get("spans.buffer.root-timeout")
        max_segment_bytes = options.get("spans.buffer.max-segment-bytes")
        max_spans_per_evalsha = options.get("spans.buffer.max-spans-per-evalsha")
        zero_copy_threshold = options.get("spans.buffer.zero-copy-dest-threshold-bytes")
        write_distributed_payloads = options.get("spans.buffer.write-distributed-payloads")
        write_merged_payloads = options.get("spans.buffer.write-merged-payloads")

        result_meta = []
        is_root_span_count = 0

        with metrics.timer("spans.buffer.process_spans.push_payloads"):
            trees = self._group_by_parent(spans)
            pipeline_batch_size = options.get("spans.buffer.pipeline-batch-size")

            # Split large subsegments into chunks to avoid Lua unpack() limits.
            # Chunks share the same parent_span_id but are processed separately.
            tree_items: list[tuple[tuple[str, str], list[Span]]] = []
            for key, subsegment in trees.items():
                if max_spans_per_evalsha > 0 and len(subsegment) > max_spans_per_evalsha:
                    for chunk in itertools.batched(subsegment, max_spans_per_evalsha):
                        tree_items.append((key, list(chunk)))
                else:
                    tree_items.append((key, subsegment))

            tree_batches: Sequence[Sequence[tuple[tuple[str, str], list[Span]]]]
            if pipeline_batch_size > 0:
                tree_batches = list(itertools.batched(tree_items, pipeline_batch_size))
            else:
                tree_batches = [tree_items]

            for batch in tree_batches:
                with self.client.pipeline(transaction=False) as p:
                    for (project_and_trace, parent_span_id), subsegment in batch:
                        set_members = self._prepare_payloads(subsegment)
                        if write_distributed_payloads:
                            # Write to distributed key.
                            dist_key = self._get_distributed_payload_key(
                                project_and_trace, parent_span_id
                            )
                            p.sadd(dist_key, *set_members.keys())
                            p.expire(dist_key, redis_ttl)

                        if write_merged_payloads:
                            set_key = self._get_span_key(project_and_trace, parent_span_id)
                            p.sadd(set_key, *set_members.keys())

                    p.execute()

        with metrics.timer("spans.buffer.process_spans.insert_spans"):
            # Workaround to make `evalsha` work in pipelines. We load ensure the
            # script is loaded just before calling it below. This calls `SCRIPT
            # EXISTS` once per batch.
            add_buffer_sha = self._ensure_script()

            results: list[Any] = []
            for batch in tree_batches:
                with self.client.pipeline(transaction=False) as p:
                    for (project_and_trace, parent_span_id), subsegment in batch:
                        byte_count = sum(len(span.payload) for span in subsegment)

                        try:
                            if self._debug_trace_logger is None:
                                self._debug_trace_logger = DebugTraceLogger(self.client)
                            self._debug_trace_logger.log_subsegment_info(
                                project_and_trace, parent_span_id, subsegment
                            )
                        except Exception:
                            logger.exception("process_spans: Failed to log debug trace info")

                        span_ids = [span.span_id for span in subsegment]
                        is_segment_span = (
                            "true" if any(span.is_segment_span for span in subsegment) else "false"
                        )

                        p.execute_command(
                            "EVALSHA",
                            add_buffer_sha,
                            1,
                            project_and_trace,
                            len(subsegment),
                            parent_span_id,
                            is_segment_span,
                            redis_ttl,
                            max_segment_bytes,
                            byte_count,
                            zero_copy_threshold,
                            "true" if write_distributed_payloads else "false",
                            "true" if write_merged_payloads else "false",
                            *span_ids,
                        )

                        is_root_span_count += sum(span.is_segment_span for span in subsegment)

                        # All spans in a subsegment share the same trace_id,
                        # so they all came from the same Kafka partition.
                        partition = subsegment[0].partition
                        result_meta.append((project_and_trace, parent_span_id, partition))

                    results.extend(p.execute())

        with metrics.timer("spans.buffer.process_spans.update_queue"):
            queue_deletes: dict[bytes, set[bytes]] = {}
            queue_adds: dict[bytes, MutableMapping[str | bytes, int]] = {}
            latency_entries: list[tuple[str, int]] = []
            latency_metrics = []
            gauge_metrics = []
            longest_evalsha_data: tuple[float, EvalshaData, EvalshaData] = (
                -1.0,
                [],
                [],
            )

            assert len(result_meta) == len(results)

            for (project_and_trace, parent_span_id, partition), result in zip(result_meta, results):
                (
                    segment_key,
                    has_root_span,
                    evalsha_latency_ms,
                    _,
                    _,
                ) = result

                latency_entries.append((project_and_trace, evalsha_latency_ms))

                # The Kafka partition is used directly as the queue shard
                # so that routing is stable across rebalances.
                shard = partition
                queue_key = self._get_queue_key(shard)

                # if the currently processed span is a root span, OR the buffer
                # already had a root span inside, use a different timeout than
                # usual.
                if has_root_span:
                    offset = root_timeout
                else:
                    offset = timeout

                zadd_items = queue_adds.setdefault(queue_key, {})

                new_deadline = now + offset
                zadd_items[segment_key] = new_deadline

                # Debug logging
                try:
                    old_deadline = None
                    if self._debug_trace_logger is None:
                        self._debug_trace_logger = DebugTraceLogger(self.client)
                    if self._debug_trace_logger._should_log_trace(project_and_trace):
                        old_deadline_score = self.client.zscore(queue_key, segment_key)
                        old_deadline = (
                            int(old_deadline_score) if old_deadline_score is not None else None
                        )

                    self._debug_trace_logger.log_deadline_update(
                        segment_key=segment_key,
                        project_and_trace=project_and_trace,
                        old_deadline=old_deadline,
                        new_deadline=new_deadline,
                        message_timestamp=now,
                        has_root_span=has_root_span,
                    )
                except Exception:
                    logger.exception("process_spans: Failed to log deadline update")

                subsegment_spans = trees[project_and_trace, parent_span_id]
                delete_set = queue_deletes.setdefault(queue_key, set())
                delete_set.update(
                    self._get_span_key(project_and_trace, span.span_id) for span in subsegment_spans
                )
                delete_set.discard(segment_key)

            for result in results:
                (
                    _,
                    _,
                    evalsha_latency_ms,
                    evalsha_latency_metrics,
                    evalsha_gauge_metrics,
                ) = result
                latency_metrics.append(evalsha_latency_metrics)
                gauge_metrics.append(evalsha_gauge_metrics)
                if evalsha_latency_ms > longest_evalsha_data[0]:
                    longest_evalsha_data = (
                        evalsha_latency_ms,
                        evalsha_latency_metrics,
                        evalsha_gauge_metrics,
                    )

            self._buffer_logger.log(latency_entries)

            with self.client.pipeline(transaction=False) as p:
                for queue_key, adds in queue_adds.items():
                    if adds:
                        p.zadd(queue_key, adds)
                        p.expire(queue_key, redis_ttl)

                for queue_key, deletes in queue_deletes.items():
                    if deletes:
                        p.zrem(queue_key, *deletes)

                p.execute()

        metrics.timing("spans.buffer.process_spans.num_spans", len(spans))
        # This incr metric is needed to get a rate overall.
        metrics.incr("spans.buffer.process_spans.count_spans", amount=len(spans))
        metrics.timing("spans.buffer.process_spans.num_is_root_spans", is_root_span_count)
        metrics.timing("spans.buffer.process_spans.num_subsegments", len(trees))
        metrics.timing("spans.buffer.process_spans.num_evalsha_calls", len(tree_items))

        try:
            emit_observability_metrics(latency_metrics, gauge_metrics, longest_evalsha_data)
        except Exception as e:
            logger.exception("Error emitting observability metrics: %s", e)

    def _ensure_script(self) -> str:
        """
        Ensures the Lua script is loaded in Redis and returns its SHA.
        """
        if not self.add_buffer_sha or not self.client.script_exists(self.add_buffer_sha)[0]:
            self.add_buffer_sha = self.client.script_load(add_buffer_script.script)

        return self.add_buffer_sha

    def _ensure_done_flush_script(self) -> str:
        if (
            not self.done_flush_segment_sha
            or not self.client.script_exists(self.done_flush_segment_sha)[0]
        ):
            self.done_flush_segment_sha = self.client.script_load(done_flush_segment_script.script)

        return self.done_flush_segment_sha

    def _ensure_done_flush_data_script(self) -> str:
        if (
            not self.done_flush_segment_data_sha
            or not self.client.script_exists(self.done_flush_segment_data_sha)[0]
        ):
            self.done_flush_segment_data_sha = self.client.script_load(
                done_flush_segment_data_script.script
            )

        return self.done_flush_segment_data_sha

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

    def _prepare_payloads(self, spans: list[Span]) -> dict[str | bytes, float]:
        """
        Prepare span payloads for storage. Returns set_members mapping
        payload bytes to their minimum timestamp.
        """
        if self._zstd_compressor is None:
            return {span.payload: span.end_timestamp for span in spans}

        combined = b"\x00".join(span.payload for span in spans)
        original_size = len(combined)

        with metrics.timer("spans.buffer.compression.cpu_time"):
            compressed = self._zstd_compressor.compress(combined)

        compressed_size = len(compressed)

        compression_ratio = compressed_size / original_size if original_size > 0 else 0
        metrics.timing("spans.buffer.compression.original_size", original_size)
        metrics.timing("spans.buffer.compression.compressed_size", compressed_size)
        metrics.timing("spans.buffer.compression.compression_ratio", compression_ratio)

        min_timestamp = min(span.end_timestamp for span in spans)

        return {compressed: min_timestamp}

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

    def flush_segments(self, now: int) -> dict[SegmentKey, FlushedSegment]:
        cutoff = now

        queue_keys = []
        shard_factor = max(1, len(self.assigned_shards))
        max_flush_segments = options.get("spans.buffer.max-flush-segments")
        flusher_logger_enabled = options.get("spans.buffer.flusher-cumulative-logger-enabled")
        max_segments_per_shard = math.ceil(max_flush_segments / shard_factor)

        ids_start = time.monotonic()
        with metrics.timer("spans.buffer.flush_segments.load_segment_ids"):
            with self.client.pipeline(transaction=False) as p:
                for shard in self.assigned_shards:
                    key = self._get_queue_key(shard)
                    p.zrangebyscore(
                        key, 0, cutoff, start=0, num=max_segments_per_shard, withscores=True
                    )
                    queue_keys.append(key)

                result = p.execute()
        load_ids_latency_ms = int((time.monotonic() - ids_start) * 1000)

        segment_keys: list[tuple[int, QueueKey, SegmentKey, float]] = []
        for shard, queue_key, keys_with_scores in zip(self.assigned_shards, queue_keys, result):
            for segment_key, score in keys_with_scores:
                segment_keys.append((shard, queue_key, segment_key, score))

        data_start = time.monotonic()
        with metrics.timer("spans.buffer.flush_segments.load_segment_data"):
            segments, ingested_counts = self._load_segment_data([k for _, _, k, _ in segment_keys])
        load_data_latency_ms = int((time.monotonic() - data_start) * 1000)

        return_segments = {}
        num_has_root_spans = 0
        any_shard_at_limit = False
        flusher_log_entries: list[FlusherLogEntry] = []

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
                span = orjson.loads(payload)

                if not attribute_value(span, "sentry.segment.id"):
                    if not isinstance(span.get("attributes"), dict):
                        span["attributes"] = {}
                    span["attributes"]["sentry.segment.id"] = {
                        "type": "string",
                        "value": segment_span_id,
                    }

                is_segment = segment_span_id == span["span_id"]
                span["is_segment"] = is_segment
                if is_segment:
                    has_root_span = True

                output_spans.append(OutputSpan(payload=span))

            metrics.incr(
                "spans.buffer.flush_segments.num_segments_per_shard", tags={"shard_i": shard}
            )
            return_segments[segment_key] = FlushedSegment(
                queue_key=queue_key,
                spans=output_spans,
                project_id=int(project_id.decode("ascii")),
                score=score,
                ingested_count=ingested_counts[segment_key],
                distributed_payload_keys=self._distributed_payload_keys_map.get(segment_key, []),
            )
            num_has_root_spans += int(has_root_span)

            try:
                if self._debug_trace_logger is None:
                    self._debug_trace_logger = DebugTraceLogger(self.client)
                self._debug_trace_logger.log_flush_info(
                    segment_key,
                    segment_span_id,
                    has_root_span,
                    len(segment),
                    shard,
                    queue_key,
                    now,
                )
            except Exception:
                logger.exception("flush_segments: Failed to log debug trace flush info")

            if flusher_logger_enabled and segment:
                project_id, trace_id, _ = parse_segment_key(segment_key)
                project_and_trace = f"{project_id.decode('ascii')}:{trace_id.decode('ascii')}"
                flusher_log_entries.append(
                    FlusherLogEntry(
                        project_and_trace,
                        len(segment),
                        sum(len(s) for s in segment),
                    )
                )

        if flusher_logger_enabled and flusher_log_entries:
            self._flusher_logger.log(
                flusher_log_entries,
                load_ids_latency_ms,
                load_data_latency_ms,
                self._last_decompress_latency_ms,
            )

        metrics.timing("spans.buffer.flush_segments.num_segments", len(return_segments))
        metrics.timing("spans.buffer.flush_segments.has_root_span", num_has_root_spans)

        self.any_shard_at_limit = any_shard_at_limit
        return return_segments

    def _load_segment_data(
        self, segment_keys: list[SegmentKey]
    ) -> tuple[dict[SegmentKey, list[bytes]], dict[SegmentKey, int]]:
        """
        Loads the segments from Redis, given a list of segment keys. Segments
        exceeding a certain size are skipped, and an error is logged.

        :param segment_keys: List of segment keys to load.
        :return: Tuple of (payloads, ingested_counts). payloads maps segment
            keys to lists of span payloads. ingested_counts maps segment keys
            to ingested count at read time.
        """

        page_size = options.get("spans.buffer.segment-page-size")
        max_segment_bytes = options.get("spans.buffer.max-segment-bytes")
        read_distributed_payloads = options.get("spans.buffer.read-distributed-payloads")
        write_distributed_payloads = options.get("spans.buffer.write-distributed-payloads")

        payloads: dict[SegmentKey, list[bytes]] = {key: [] for key in segment_keys}
        sizes: dict[SegmentKey, int] = {key: 0 for key in segment_keys}
        self._last_decompress_latency_ms = 0
        decompress_latency_ms = 0.0

        # Maps each scan key back to the segment it belongs to. For merged
        # keys these are the same; for distributed keys many map to one segment.
        scan_key_to_segment: dict[SegmentKey | DistributedPayloadKey, SegmentKey] = {}

        # When read_distributed_payloads is off, scan merged segment keys directly.
        # When on, skip them — all data lives in distributed keys.
        cursors: dict[bytes, int] = {}
        if not read_distributed_payloads:
            for key in segment_keys:
                scan_key_to_segment[key] = key
                cursors[key] = 0

        self._distributed_payload_keys_map = {}

        if write_distributed_payloads:
            with self.client.pipeline(transaction=False) as p:
                for key in segment_keys:
                    p.smembers(self._get_payload_key_index(key))
                mk_results = p.execute()

            for key, sub_span_ids in zip(segment_keys, mk_results):
                project_id, trace_id, _ = parse_segment_key(key)
                pat = f"{project_id.decode('ascii')}:{trace_id.decode('ascii')}"
                distributed_keys: list[bytes] = []
                for sub_span_id in sub_span_ids:
                    distributed_key = self._get_distributed_payload_key(
                        pat, sub_span_id.decode("ascii")
                    )
                    distributed_keys.append(distributed_key)
                    if read_distributed_payloads:
                        scan_key_to_segment[distributed_key] = key
                        cursors[distributed_key] = 0
                self._distributed_payload_keys_map[key] = distributed_keys

        dropped_segments: set[SegmentKey] = set()

        def _add_spans(key: SegmentKey, raw_data: bytes) -> bool:
            """
            Decompress and add spans to the segment. Returns False if the
            segment exceeded max_segment_bytes and was dropped.
            """
            nonlocal decompress_latency_ms

            decompress_start = time.monotonic()
            decompressed = self._decompress_batch(raw_data)
            decompress_latency_ms += (time.monotonic() - decompress_start) * 1000

            sizes[key] = sizes.get(key, 0) + sum(len(span) for span in decompressed)
            if sizes[key] > max_segment_bytes:
                metrics.incr("spans.buffer.flush_segments.segment_size_exceeded")
                logger.warning("Skipping too large segment, byte size %s", sizes[key])
                payloads.pop(key, None)
                sizes.pop(key, None)
                dropped_segments.add(key)
                return False

            payloads[key].extend(decompressed)
            return True

        while cursors:
            with self.client.pipeline(transaction=False) as p:
                current_keys = []
                for key, cursor in cursors.items():
                    p.sscan(key, cursor=cursor, count=page_size)
                    current_keys.append(key)

                scan_results = p.execute()

            for key, (cursor, scan_values) in zip(current_keys, scan_results):
                segment_key = scan_key_to_segment[key]
                if segment_key in dropped_segments:
                    cursors.pop(key, None)
                    continue

                size_exceeded = False
                for scan_value in scan_values:
                    if segment_key in payloads:
                        if not _add_spans(segment_key, scan_value):
                            size_exceeded = True

                if size_exceeded:
                    cursors.pop(key, None)
                elif cursor == 0:
                    del cursors[key]
                else:
                    cursors[key] = cursor

        if dropped_segments:
            self._cleanup_distributed_keys(dropped_segments)

        # Fetch ingested counts for all segments to calculate dropped spans
        with self.client.pipeline(transaction=False) as p:
            for key in segment_keys:
                ingested_count_key = b"span-buf:ic:" + key
                p.get(ingested_count_key)
                ingested_byte_count_key = b"span-buf:ibc:" + key
                p.get(ingested_byte_count_key)

            ingested_results = p.execute()

        # Build ingested counts dict for conditional cleanup in done_flush_segments
        ingested_counts: dict[SegmentKey, int] = {}

        # Calculate dropped counts: total ingested - successfully loaded
        for i, key in enumerate(segment_keys):
            ingested_count = ingested_results[i * 2]
            ingested_byte_count = ingested_results[i * 2 + 1]

            if ingested_count:
                ingested_counts[key] = int(ingested_count)

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
                # BUG DETECTION: Segment was in the flush queue but both the data
                # (span-buf:s:*) and metadata (span-buf:ic:*) keys are missing.
                # This means the Redis keys expired before the flusher could process
                # them, resulting in silent data loss. The spans were already committed
                # from the ingest Kafka topic, so they cannot be recovered.
                metrics.incr("spans.buffer.segment_expired_before_flush")

        for key, spans in payloads.items():
            if not spans:
                # This is a bug, most likely the input topic is not
                # partitioned by trace_id so multiple consumers are writing
                # over each other. The consequence is duplicated segments,
                # worst-case.
                metrics.incr("spans.buffer.empty_segments")

        self._last_decompress_latency_ms = int(decompress_latency_ms)

        return payloads, ingested_counts

    def done_flush_segments(self, segment_keys: dict[SegmentKey, FlushedSegment]):
        metrics.timing("spans.buffer.done_flush_segments.num_segments", len(segment_keys))
        with metrics.timer("spans.buffer.done_flush_segments"):
            use_conditional_cleanup = options.get("spans.buffer.done-flush-conditional-zrem")

            segments_to_skip: set[SegmentKey] = set()
            if use_conditional_cleanup:
                segment_key_list = list(segment_keys.items())

                # Phase 1: Conditional ZREM on queue slot.
                # Only remove queue entry if score hasn't changed (no new spans
                # updated the deadline). This is an optimization to skip early.
                done_flush_sha = self._ensure_done_flush_script()
                with self.client.pipeline(transaction=False) as p:
                    for segment_key, flushed_segment in segment_key_list:
                        p.execute_command(
                            "EVALSHA",
                            done_flush_sha,
                            1,
                            flushed_segment.queue_key,
                            segment_key,
                            flushed_segment.score,
                        )
                    zrem_results = p.execute()

                for (segment_key, _), was_removed in zip(segment_key_list, zrem_results):
                    if not was_removed:
                        segments_to_skip.add(segment_key)

                # Phase 2: Conditional data deletion on segment slot.
                # Even if Phase 1 succeeded, new spans may have arrived between
                # ZREM and now. The Lua script atomically checks ingested count
                # and only deletes data if unchanged. This is atomic with
                # add-buffer.lua on the same {project_id:trace_id} slot,
                # so it cannot interleave with process_spans.
                done_flush_data_sha = self._ensure_done_flush_data_script()
                with self.client.pipeline(transaction=False) as p:
                    # Only run Phase 2 for segments that passed Phase 1
                    phase2_keys = [
                        (sk, fs) for sk, fs in segment_key_list if sk not in segments_to_skip
                    ]
                    for segment_key, flushed_segment in phase2_keys:
                        p.execute_command(
                            "EVALSHA",
                            done_flush_data_sha,
                            1,
                            segment_key,
                            flushed_segment.ingested_count,
                        )
                    data_delete_results = p.execute()

                for (segment_key, _), was_deleted in zip(phase2_keys, data_delete_results):
                    if not was_deleted:
                        segments_to_skip.add(segment_key)

                skipped = len(segments_to_skip)
                if skipped:
                    metrics.incr(
                        "spans.buffer.done_flush_segments.skipped_cleanup",
                        amount=skipped,
                    )

            queue_removals: dict[bytes, list[SegmentKey]] = {}
            with self.client.pipeline(transaction=False) as p:
                for segment_key, flushed_segment in segment_keys.items():
                    if segment_key in segments_to_skip:
                        continue

                    if use_conditional_cleanup:
                        # Data keys (set, hrs, ic, ibc) were already deleted
                        # by the Phase 2 Lua script. Only clean up redirect map.
                        project_id, trace_id, _ = parse_segment_key(segment_key)
                        redirect_map_key = b"span-buf:ssr:{%s:%s}" % (project_id, trace_id)

                        for span_batch in itertools.batched(flushed_segment.spans, 100):
                            span_ids = [
                                output_span.payload["span_id"] for output_span in span_batch
                            ]
                            p.hdel(redirect_map_key, *span_ids)
                    else:
                        p.delete(b"span-buf:hrs:" + segment_key)
                        p.delete(b"span-buf:ic:" + segment_key)
                        p.delete(b"span-buf:ibc:" + segment_key)
                        p.unlink(segment_key)

                        project_id, trace_id, _ = parse_segment_key(segment_key)
                        redirect_map_key = b"span-buf:ssr:{%s:%s}" % (project_id, trace_id)

                        for span_batch in itertools.batched(flushed_segment.spans, 100):
                            span_ids = [
                                output_span.payload["span_id"] for output_span in span_batch
                            ]
                            p.hdel(redirect_map_key, *span_ids)

                        queue_removals.setdefault(flushed_segment.queue_key, []).append(segment_key)

                    if flushed_segment.distributed_payload_keys:
                        mk_key = self._get_payload_key_index(segment_key)
                        p.delete(mk_key)
                        for distributed_key_batch in itertools.batched(
                            flushed_segment.distributed_payload_keys, 100
                        ):
                            p.unlink(*distributed_key_batch)

                for queue_key, keys in queue_removals.items():
                    for key_batch in itertools.batched(keys, 100):
                        p.zrem(queue_key, *key_batch)

                p.execute()
