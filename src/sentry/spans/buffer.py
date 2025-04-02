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
    * span-buf:sr:* -- redirect mappings so that each incoming span ID can be mapped to the right span-buf:s: set.
"""

from __future__ import annotations

import itertools
from collections.abc import Sequence
from typing import Any, NamedTuple

import rapidjson
from django.conf import settings
from django.utils.functional import cached_property
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import metrics, redis

# SegmentKey is an internal identifier used by the redis buffer that is also
# directly used as raw redis key. the format is
# "span-buf:s:{project_id:trace_id}:span_id", and the type is bytes because our
# redis client is bytes.
#
# The segment ID in the Kafka protocol is only the span ID.
SegmentKey = bytes


def _segment_key_to_span_id(segment_key: SegmentKey) -> bytes:
    return parse_segment_key(segment_key)[2]


def parse_segment_key(segment_key: SegmentKey) -> tuple[bytes, bytes, bytes]:
    segment_key_parts = segment_key.split(b":")
    project_id = segment_key_parts[2][1:]
    trace_id = segment_key_parts[3][:-1]
    span_id = segment_key_parts[4]

    return project_id, trace_id, span_id


def get_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    return redis.redis_clusters.get_binary(settings.SENTRY_SPAN_BUFFER_CLUSTER)


add_buffer_script = redis.load_redis_script("spans/add-buffer.lua")


# NamedTuples are faster to construct than dataclasses
class Span(NamedTuple):
    trace_id: str
    span_id: str
    parent_span_id: str | None
    project_id: int
    payload: bytes
    is_segment_span: bool = False

    def effective_parent_id(self):
        # Note: For the case where the span's parent is in another project, we
        # will still flush the segment-without-root-span as one unit, just
        # after span_buffer_timeout_secs rather than
        # span_buffer_root_timeout_secs.
        if self.is_segment_span:
            return self.span_id
        else:
            return self.parent_span_id or self.span_id


class OutputSpan(NamedTuple):
    payload: dict[str, Any]


class SpansBuffer:
    def __init__(
        self,
        assigned_shards: list[int],
        span_buffer_timeout_secs: int = 60,
        span_buffer_root_timeout_secs: int = 10,
        redis_ttl: int = 3600,
    ):
        self.assigned_shards = list(assigned_shards)
        self.span_buffer_timeout_secs = span_buffer_timeout_secs
        self.span_buffer_root_timeout_secs = span_buffer_root_timeout_secs
        self.redis_ttl = redis_ttl

    @cached_property
    def client(self) -> RedisCluster[bytes] | StrictRedis[bytes]:
        return get_redis_client()

    # make it pickleable
    def __reduce__(self):
        return (
            SpansBuffer,
            (
                self.assigned_shards,
                self.span_buffer_timeout_secs,
                self.span_buffer_root_timeout_secs,
                self.redis_ttl,
            ),
        )

    def process_spans(self, spans: Sequence[Span], now: int):
        """
        :param spans: List of to-be-ingested spans.
        :param now: The current time to be used for setting expiration/flush
            deadlines. Used for unit-testing and managing backlogging behavior.
        """

        queue_keys = []
        queue_delete_items = []
        queue_items = []
        queue_item_has_root_span = []

        is_root_span_count = 0
        has_root_span_count = 0
        min_redirect_depth = float("inf")
        max_redirect_depth = float("-inf")

        trees = self._group_by_parent(spans)

        with metrics.timer("spans.buffer.process_spans.push_payloads"):
            with self.client.pipeline(transaction=False) as p:
                for (project_and_trace, parent_span_id), subsegment in trees.items():
                    set_key = f"span-buf:s:{{{project_and_trace}}}:{parent_span_id}"
                    p.sadd(set_key, *[span.payload for span in subsegment])

                p.execute()

        with metrics.timer("spans.buffer.process_spans.insert_spans"):
            with self.client.pipeline(transaction=False) as p:
                for (project_and_trace, parent_span_id), subsegment in trees.items():
                    for span in subsegment:
                        # hack to make redis-cluster-py pipelines work well with
                        # scripts. we cannot use EVALSHA or "the normal way to do
                        # scripts in sentry" easily until we get rid of
                        # redis-cluster-py sentrywide. this probably leaves a bit of
                        # perf on the table as we send the full lua sourcecode with every span.
                        p.eval(
                            add_buffer_script.script,
                            1,
                            project_and_trace,
                            "true" if span.is_segment_span else "false",
                            span.span_id,
                            parent_span_id,
                            self.redis_ttl,
                        )

                        shard = self.assigned_shards[
                            int(span.trace_id, 16) % len(self.assigned_shards)
                        ]
                        queue_keys.append(f"span-buf:q:{shard}")

                    results = iter(p.execute())
                    for redirect_depth, delete_item, item, has_root_span in results:
                        # For each span, redirect_depth measures how long it took to
                        # find the corresponding intermediate segment. Larger
                        # numbers loosely correlate with fewer siblings per tree
                        # level.
                        min_redirect_depth = min(min_redirect_depth, redirect_depth)
                        max_redirect_depth = max(max_redirect_depth, redirect_depth)
                        queue_delete_items.append(delete_item)
                        queue_items.append(item)
                        queue_item_has_root_span.append(has_root_span)

        with metrics.timer("spans.buffer.process_spans.update_queue"):
            with self.client.pipeline(transaction=False) as p:
                for key, delete_item, item, has_root_span in zip(
                    queue_keys, queue_delete_items, queue_items, queue_item_has_root_span
                ):
                    # if the currently processed span is a root span, OR the buffer
                    # already had a root span inside, use a different timeout than
                    # usual.
                    if has_root_span:
                        has_root_span_count += 1
                        timestamp = now + self.span_buffer_root_timeout_secs
                    else:
                        timestamp = now + self.span_buffer_timeout_secs

                    if delete_item != item:
                        p.zrem(key, delete_item)
                    p.zadd(key, {item: timestamp})
                    p.expire(key, self.redis_ttl)

                p.execute()

        metrics.timing("spans.buffer.process_spans.num_spans", len(spans))
        metrics.timing("spans.buffer.process_spans.num_is_root_spans", is_root_span_count)
        metrics.timing("spans.buffer.process_spans.num_has_root_spans", has_root_span_count)
        metrics.timing("span.buffer.hole_size.min", min_redirect_depth)
        metrics.timing("span.buffer.hole_size.max", max_redirect_depth)

    # TODO: type aliases
    def _group_by_parent(self, spans: Sequence[Span]) -> dict[tuple[str, str], list[Span]]:
        # TODO: Doc
        trees = {}
        redirects = {}

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

    def flush_segments(
        self, now: int, max_segments: int = 0
    ) -> tuple[int, dict[SegmentKey, list[OutputSpan]]]:
        cutoff = now

        with metrics.timer("spans.buffer.flush_segments.load_segment_ids"):
            with self.client.pipeline(transaction=False) as p:
                for shard in self.assigned_shards:
                    key = f"span-buf:q:{shard}"
                    p.zrangebyscore(
                        key, 0, cutoff, start=0 if max_segments else None, num=max_segments or None
                    )
                    p.zcard(key)

                result = iter(p.execute())

        segment_keys = []
        queue_sizes = []

        with metrics.timer("spans.buffer.flush_segments.load_segment_data"):
            with self.client.pipeline(transaction=False) as p:
                # ZRANGEBYSCORE output
                for segment_span_ids in result:
                    # process return value of zrevrangebyscore
                    for segment_key in segment_span_ids:
                        segment_keys.append(segment_key)
                        p.smembers(segment_key)

                    # ZCARD output
                    queue_sizes.append(next(result))

                segments = p.execute()

        for shard_i, queue_size in zip(self.assigned_shards, queue_sizes):
            metrics.timing(
                "spans.buffer.flush_segments.queue_size",
                queue_size,
                tags={"shard_i": shard_i},
            )

        return_segments = {}

        for segment_key, segment in zip(segment_keys, segments):
            segment_span_id = _segment_key_to_span_id(segment_key).decode("ascii")

            return_segment = []
            metrics.timing("spans.buffer.flush_segments.num_spans_per_segment", len(segment))
            for payload in segment:
                val = rapidjson.loads(payload)
                old_segment_id = val.get("segment_id")
                if old_segment_id:
                    val_data = val.setdefault("data", {})
                    if isinstance(val_data, dict):
                        val_data["__sentry_internal_old_segment_id"] = old_segment_id
                val["segment_id"] = segment_span_id
                is_segment = val["is_segment"] = segment_span_id == val["span_id"]

                outcome = "same" if old_segment_id == segment_span_id else "different"

                metrics.incr(
                    "spans.buffer.flush_segments.is_same_segment",
                    tags={
                        "outcome": outcome,
                        "is_segment_span": is_segment,
                        "old_segment_is_null": "true" if old_segment_id is None else "false",
                    },
                )

                return_segment.append(OutputSpan(payload=val))

            return_segments[segment_key] = return_segment
        metrics.timing("spans.buffer.flush_segments.num_segments", len(return_segments))

        return sum(queue_sizes), return_segments

    def done_flush_segments(self, segment_keys: dict[SegmentKey, list[OutputSpan]]):
        num_hdels = []
        metrics.timing("spans.buffer.done_flush_segments.num_segments", len(segment_keys))
        with metrics.timer("spans.buffer.done_flush_segments"):
            with self.client.pipeline(transaction=False) as p:
                for segment_key, output_spans in segment_keys.items():
                    hrs_key = b"span-buf:hrs:" + segment_key
                    p.get(hrs_key)
                    p.delete(hrs_key)
                    p.unlink(segment_key)

                    project_id, trace_id, _ = parse_segment_key(segment_key)
                    redirect_map_key = b"span-buf:sr:{%s:%s}" % (project_id, trace_id)
                    shard = self.assigned_shards[int(trace_id, 16) % len(self.assigned_shards)]
                    p.zrem(f"span-buf:q:{shard}".encode("ascii"), segment_key)

                    i = 0
                    for span_batch in itertools.batched(output_spans, 100):
                        i += 1
                        p.hdel(
                            redirect_map_key,
                            *[output_span.payload["span_id"] for output_span in span_batch],
                        )

                    num_hdels.append(i)

                results = iter(p.execute())

            has_root_span_count = 0
            for result, num_hdel in zip(results, num_hdels):
                if result:
                    has_root_span_count += 1

                next(results)  # DEL hrs_key
                next(results)  # DEL segment_key
                next(results)  # ZREM ...
                for _ in range(num_hdel):  # HDEL ...
                    next(results)

            metrics.timing("spans.buffer.done_flush_segments.has_root_span", has_root_span_count)
