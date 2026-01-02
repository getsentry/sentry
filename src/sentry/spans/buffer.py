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
  a. We look up any "redirects" from the span buffer's parent_span_id (hashmap at "span-buf:sr:{project_id:trace_id}") to another key.
  b. Otherwise we use "span-buf:z:{project_id:trace_id}:span_id"
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

    * span-buf:z:* -- the actual set keys, containing span payloads. Each key contains all data for a segment. The most memory-intensive kind of key.
    * span-buf:q:* -- the priority queue, used to determine which segments are ready to be flushed.
    * span-buf:hrs:* -- simple bool key to flag a segment as "has root span" (HRS)
    * span-buf:sr:* -- redirect mappings so that each incoming span ID can be mapped to the right span-buf:z: set.
    * span-buf:ic:* -- ingested count, tracks total number of spans originally ingested for a segment (used to calculate dropped spans for outcome tracking)
    * span-buf:ibc:* -- ingested byte count, tracks total bytes originally ingested for a segment
"""

from __future__ import annotations

import itertools
import logging
import math
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
from sentry.spans.consumers.process_segments.types import attribute_value
from sentry.utils import metrics, redis
from sentry.utils.outcomes import Outcome, track_outcome

# SegmentKey is an internal identifier used by the redis buffer that is also
# directly used as raw redis key. the format is
# "span-buf:z:{project_id:trace_id}:span_id", and the type is bytes because our
# redis client is bytes.
#
# The segment ID in the Kafka protocol is only the span ID.
SegmentKey = bytes

QueueKey = bytes

logger = logging.getLogger(__name__)


def _segment_key_to_span_id(segment_key: SegmentKey) -> bytes:
    return parse_segment_key(segment_key)[-1]


def parse_segment_key(segment_key: SegmentKey) -> tuple[bytes, bytes, bytes]:
    segment_key_parts = segment_key.split(b":")

    if len(segment_key_parts) == 5:
        project_id = segment_key_parts[2][1:]
        trace_id = segment_key_parts[3][:-1]
        span_id = segment_key_parts[4]
    elif len(segment_key_parts) == 6:
        # Temporary format with partition on index 2
        project_id = segment_key_parts[3]
        trace_id = segment_key_parts[4]
        span_id = segment_key_parts[5]
    else:
        raise ValueError("unsupported segment key format")

    return project_id, trace_id, span_id


def get_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    return redis.redis_clusters.get_binary(settings.SENTRY_SPAN_BUFFER_CLUSTER)


add_buffer_script = redis.load_redis_script("spans/add-buffer.lua")


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


class SpansBuffer:
    def __init__(self, assigned_shards: list[int], slice_id: int | None = None):
        self.assigned_shards = list(assigned_shards)
        self.slice_id = slice_id
        self.add_buffer_sha: str | None = None
        self.any_shard_at_limit = False
        self._current_compression_level = None
        self._zstd_compressor: zstandard.ZstdCompressor | None = None
        self._zstd_decompressor = zstandard.ZstdDecompressor()

    @cached_property
    def client(self) -> RedisCluster[bytes] | StrictRedis[bytes]:
        return get_redis_client()

    # make it pickleable
    def __reduce__(self):
        return (SpansBuffer, (self.assigned_shards, self.slice_id))

    def _get_span_key(self, project_and_trace: str, span_id: str) -> bytes:
        return f"span-buf:z:{{{project_and_trace}}}:{span_id}".encode("ascii")

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

        result_meta = []
        is_root_span_count = 0
        min_redirect_depth = float("inf")
        max_redirect_depth = float("-inf")

        with metrics.timer("spans.buffer.process_spans.push_payloads"):
            trees = self._group_by_parent(spans)

            with self.client.pipeline(transaction=False) as p:
                for (project_and_trace, parent_span_id), subsegment in trees.items():
                    set_key = self._get_span_key(project_and_trace, parent_span_id)
                    prepared = self._prepare_payloads(subsegment)
                    p.zadd(set_key, prepared)

                p.execute()

        with metrics.timer("spans.buffer.process_spans.insert_spans"):
            # Workaround to make `evalsha` work in pipelines. We load ensure the
            # script is loaded just before calling it below. This calls `SCRIPT
            # EXISTS` once per batch.
            add_buffer_sha = self._ensure_script()

            with self.client.pipeline(transaction=False) as p:
                for (project_and_trace, parent_span_id), subsegment in trees.items():
                    byte_count = sum(len(span.payload) for span in subsegment)
                    p.execute_command(
                        "EVALSHA",
                        add_buffer_sha,
                        1,
                        project_and_trace,
                        len(subsegment),
                        parent_span_id,
                        "true" if any(span.is_segment_span for span in subsegment) else "false",
                        redis_ttl,
                        max_segment_bytes,
                        byte_count,
                        *[span.span_id for span in subsegment],
                    )

                    is_root_span_count += sum(span.is_segment_span for span in subsegment)
                    result_meta.append((project_and_trace, parent_span_id))

                results = p.execute()

        with metrics.timer("spans.buffer.process_spans.update_queue"):
            queue_deletes: dict[bytes, set[bytes]] = {}
            queue_adds: dict[bytes, MutableMapping[str | bytes, int]] = {}

            assert len(result_meta) == len(results)

            for (project_and_trace, parent_span_id), result in zip(result_meta, results):
                redirect_depth, set_key, has_root_span = result

                shard = self.assigned_shards[
                    int(project_and_trace.split(":")[1], 16) % len(self.assigned_shards)
                ]
                queue_key = self._get_queue_key(shard)

                min_redirect_depth = min(min_redirect_depth, redirect_depth)
                max_redirect_depth = max(max_redirect_depth, redirect_depth)

                # if the currently processed span is a root span, OR the buffer
                # already had a root span inside, use a different timeout than
                # usual.
                if has_root_span:
                    offset = root_timeout
                else:
                    offset = timeout

                zadd_items = queue_adds.setdefault(queue_key, {})
                zadd_items[set_key] = now + offset

                subsegment_spans = trees[project_and_trace, parent_span_id]
                delete_set = queue_deletes.setdefault(queue_key, set())
                delete_set.update(
                    self._get_span_key(project_and_trace, span.span_id) for span in subsegment_spans
                )
                delete_set.discard(set_key)

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
        metrics.gauge("spans.buffer.min_redirect_depth", min_redirect_depth)
        metrics.gauge("spans.buffer.max_redirect_depth", max_redirect_depth)

    def _ensure_script(self):
        if self.add_buffer_sha is not None:
            if self.client.script_exists(self.add_buffer_sha)[0]:
                return self.add_buffer_sha

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

    def _prepare_payloads(self, spans: list[Span]) -> dict[str | bytes, float]:
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
        max_segments_per_shard = math.ceil(max_flush_segments / shard_factor)

        with metrics.timer("spans.buffer.flush_segments.load_segment_ids"):
            with self.client.pipeline(transaction=False) as p:
                for shard in self.assigned_shards:
                    key = self._get_queue_key(shard)
                    p.zrangebyscore(key, 0, cutoff, start=0, num=max_segments_per_shard)
                    queue_keys.append(key)

                result = p.execute()

        segment_keys: list[tuple[int, QueueKey, SegmentKey]] = []
        for shard, queue_key, keys in zip(self.assigned_shards, queue_keys, result):
            for segment_key in keys:
                segment_keys.append((shard, queue_key, segment_key))

        with metrics.timer("spans.buffer.flush_segments.load_segment_data"):
            segments = self._load_segment_data([k for _, _, k in segment_keys])

        return_segments = {}
        num_has_root_spans = 0
        any_shard_at_limit = False

        for shard, queue_key, segment_key in segment_keys:
            segment_span_id = _segment_key_to_span_id(segment_key).decode("ascii")
            segment = segments.get(segment_key, [])

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
                    span.setdefault("attributes", {})["sentry.segment.id"] = {
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
            return_segments[segment_key] = FlushedSegment(queue_key=queue_key, spans=output_spans)
            num_has_root_spans += int(has_root_span)

        metrics.timing("spans.buffer.flush_segments.num_segments", len(return_segments))
        metrics.timing("spans.buffer.flush_segments.has_root_span", num_has_root_spans)

        self.any_shard_at_limit = any_shard_at_limit
        return return_segments

    def _load_segment_data(self, segment_keys: list[SegmentKey]) -> dict[SegmentKey, list[bytes]]:
        """
        Loads the segments from Redis, given a list of segment keys. Segments
        exceeding a certain size are skipped, and an error is logged.

        :param segment_keys: List of segment keys to load.
        :return: Dictionary mapping segment keys to lists of span payloads.
        """

        page_size = options.get("spans.buffer.segment-page-size")
        max_segment_bytes = options.get("spans.buffer.max-segment-bytes")

        payloads: dict[SegmentKey, list[bytes]] = {key: [] for key in segment_keys}
        cursors = {key: 0 for key in segment_keys}
        sizes = {key: 0 for key in segment_keys}

        while cursors:
            with self.client.pipeline(transaction=False) as p:
                current_keys = []
                for key, cursor in cursors.items():
                    if key.startswith(b"span-buf:z:"):
                        p.zscan(key, cursor=cursor, count=page_size)
                    else:
                        p.sscan(key, cursor=cursor, count=page_size)
                    current_keys.append(key)

                scan_results = p.execute()

            for key, (cursor, scan_values) in zip(current_keys, scan_results):
                decompressed_spans = []

                for scan_value in scan_values:
                    span_data = scan_value[0] if isinstance(scan_value, tuple) else scan_value
                    decompressed_spans.extend(self._decompress_batch(span_data))

                sizes[key] += sum(len(span) for span in decompressed_spans)
                if sizes[key] > max_segment_bytes:
                    metrics.incr("spans.buffer.flush_segments.segment_size_exceeded")
                    logger.warning("Skipping too large segment, byte size %s", sizes[key])

                    del payloads[key]
                    del cursors[key]
                    continue

                payloads[key].extend(decompressed_spans)
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
                project_id = int(project_id_bytes)
                try:
                    project = Project.objects.get_from_cache(id=project_id)
                except Project.DoesNotExist:
                    logger.warning(
                        "Project does not exist for segment with dropped spans",
                        extra={"project_id": project_id},
                    )
                else:
                    track_outcome(
                        org_id=project.organization_id,
                        project_id=project_id,
                        key_id=None,
                        outcome=Outcome.INVALID,
                        reason="segment_too_large",
                        category=DataCategory.SPAN_INDEXED,
                        quantity=dropped,
                    )

        for key, spans in payloads.items():
            if not spans:
                # This is a bug, most likely the input topic is not
                # partitioned by trace_id so multiple consumers are writing
                # over each other. The consequence is duplicated segments,
                # worst-case.
                metrics.incr("spans.buffer.empty_segments")

        return payloads

    def done_flush_segments(self, segment_keys: dict[SegmentKey, FlushedSegment]):
        metrics.timing("spans.buffer.done_flush_segments.num_segments", len(segment_keys))
        with metrics.timer("spans.buffer.done_flush_segments"):
            with self.client.pipeline(transaction=False) as p:
                for segment_key, flushed_segment in segment_keys.items():
                    p.delete(b"span-buf:hrs:" + segment_key)
                    p.delete(b"span-buf:ic:" + segment_key)
                    p.delete(b"span-buf:ibc:" + segment_key)
                    p.unlink(segment_key)
                    p.zrem(flushed_segment.queue_key, segment_key)

                    project_id, trace_id, _ = parse_segment_key(segment_key)
                    redirect_map_key = b"span-buf:sr:{%s:%s}" % (project_id, trace_id)

                    for span_batch in itertools.batched(flushed_segment.spans, 100):
                        p.hdel(
                            redirect_map_key,
                            *[output_span.payload["span_id"] for output_span in span_batch],
                        )

                p.execute()
