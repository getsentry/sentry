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
  a. We look up any "redirects" from the span buffer's parent_span_id (key "span-buf:sr:{project_id:trace_id}:span_id") to another key.
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

"""

from __future__ import annotations

from collections.abc import Collection, Sequence
from typing import NamedTuple

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import redis

# This SegmentId is an internal identifier used by the redis buffer that is
# also directly used as raw redis key. the format is
# "span-buf:s:{project_id:trace_id}:span_id", and the type is bytes because our redis
# client is bytes.
#
# The segment ID in the Kafka protocol is actually only the span ID.
SegmentId = bytes


def get_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    return redis.redis_clusters.get_binary(settings.SENTRY_SPAN_BUFFER_CLUSTER)


add_buffer_script = redis.load_redis_script("spans/add-buffer.lua")


# fun fact: namedtuples are faster to construct than dataclasses
class Span(NamedTuple):
    trace_id: str
    span_id: str
    parent_span_id: str | None
    project_id: int
    payload: bytes
    is_segment_span: bool = False


class RedisSpansBufferV2:
    def __init__(
        self,
        sharding_factor: int = 32,
        span_buffer_timeout_secs: int = 60,
        span_buffer_root_timeout_secs: int = 10,
        redis_ttl: int = 3600,
    ):
        self.client: RedisCluster[bytes] | StrictRedis[bytes] = get_redis_client()
        self.sharding_factor = sharding_factor
        self.span_buffer_timeout = span_buffer_timeout_secs
        self.span_buffer_root_timeout = span_buffer_root_timeout_secs
        self.max_timeout = redis_ttl

    def _is_root_span(self, span: Span) -> bool:
        return span.parent_span_id is None or span.is_segment_span

    def process_spans(self, spans: Sequence[Span], now: int):
        queue_keys = []
        queue_items = []
        queue_item_has_root_span = []

        with self.client.pipeline(transaction=False) as p:
            for span in spans:
                # (parent_span_id) -> [Span]
                shard = int(span.trace_id, 16) % self.sharding_factor
                queue_key = f"span-buf:q:{shard}"
                parent_span_id = span.parent_span_id or span.span_id

                is_root_span = self._is_root_span(span)

                # hack to make redis-cluster-py pipelines work well with
                # scripts. we cannot use EVALSHA or "the normal way to do
                # scripts in sentry" easily until we get rid of
                # redis-cluster-py sentrywide. this probably leaves a bit of
                # perf on the table as we send the full lua sourcecode with every span.
                p.eval(
                    add_buffer_script.script,
                    1,
                    f"{span.project_id}:{span.trace_id}",
                    span.payload,
                    "true" if is_root_span else "false",
                    span.span_id,
                    parent_span_id,
                    self.max_timeout,
                )

                queue_keys.append(queue_key)

            results = iter(p.execute())
            for item, has_root_span in results:
                queue_items.append(item)
                queue_item_has_root_span.append(has_root_span)

        with self.client.pipeline(transaction=False) as p:
            for key, item, has_root_span in zip(queue_keys, queue_items, queue_item_has_root_span):
                # if the currently processed span is a root span, OR the buffer
                # already had a root span inside, use a different timeout than
                # usual.
                if has_root_span:
                    timestamp = now + self.span_buffer_root_timeout
                else:
                    timestamp = now + self.span_buffer_timeout

                p.zadd(key, {item: timestamp})
                p.expire(key, self.max_timeout)

            p.execute()

    def flush_segments(self, now: int, max_segments: int = 0) -> dict[SegmentId, set[bytes]]:
        cutoff = now

        with self.client.pipeline(transaction=False) as p:
            for shard in range(self.sharding_factor):
                key = f"span-buf:q:{shard}"
                p.zrangebyscore(key, 0, cutoff)

            result = p.execute()

        segment_ids = []

        with self.client.pipeline(transaction=False) as p:
            for segment_span_ids in result:
                # process return value of zrevrangebyscore
                for segment_id in segment_span_ids:
                    # TODO: SSCAN
                    segment_ids.append(segment_id)
                    p.smembers(segment_id)

                    if max_segments > 0 and len(segment_ids) >= max_segments:
                        break

                if max_segments > 0 and len(segment_ids) >= max_segments:
                    break

            segments = p.execute()

        return_segments = {}

        for segment_id, segment in zip(segment_ids, segments):
            return_segment = set()
            for payload in segment:
                return_segment.add(payload)

            return_segments[segment_id] = return_segment

        return return_segments

    def done_flush_segments(self, segment_ids: Collection[SegmentId]):
        with self.client.pipeline(transaction=False) as p:
            for segment_id in segment_ids:
                p.delete(segment_id)
                p.delete(f"span-buf:hrs:{segment_id}".encode("ascii"))

                # parse trace_id out of SegmentId, then remove from queue
                trace_id = segment_id.split(b":")[3][:-1]
                shard = int(trace_id, 16) % self.sharding_factor
                p.zrem(f"span-buf:q:{shard}".encode("ascii"), segment_id)

            p.execute()
