from __future__ import annotations

from collections import defaultdict
from collections.abc import Collection, Sequence
from functools import partial
from typing import NamedTuple

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import redis

# s:{project_id:trace_id}:span_id
SegmentId = bytes


def get_redis_client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    return redis.redis_clusters.get_binary(settings.SENTRY_SPAN_BUFFER_CLUSTER)


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
        span_buffer_timeout: int = 60,
        span_buffer_root_timeout: int = 10,
        redis_ttl: int = 3600,
    ):
        self.client: RedisCluster[bytes] | StrictRedis[bytes] = get_redis_client()
        self.sharding_factor = sharding_factor
        self.span_buffer_timeout = span_buffer_timeout
        self.span_buffer_root_timeout = span_buffer_root_timeout
        self.max_timeout = redis_ttl

    @staticmethod
    def _segment_id(project_id: int, trace_id: str, span_id: str) -> SegmentId:
        return f"span-buf:s:{{{project_id}:{trace_id}}}:{span_id}".encode("ascii")

    def _queue_key(self, trace_id: str) -> str:
        shard = int(trace_id, 16) % self.sharding_factor
        return f"span-buf:q:{shard}"

    def _is_root_span(self, span: Span) -> bool:
        return span.parent_span_id is None or span.is_segment_span

    def process_spans(self, spans: Sequence[Span], now: int):
        pipelines_to_execute = []

        if isinstance(self.client, RedisCluster):
            # we're hacking around the fact that certain multi-key commands
            # like sunionstore do not work on clustered pipelines
            # (self.client.pipeline()). even though we do talk to nodes
            # directly, this code was written with the intent that cluster
            # resizing still works as expected, and that there are no keys that
            # overlap in name across nodes (unlike some of our redis-blaster
            # based services that also talk to nodes directly)
            pipelines_by_key = {}  # mapping from redis key to pipeline obj
            pipelines_by_node = (
                {}
            )  # mapping from node to pipeline obj, to reuse pipelines across trace_ids if they go to the same node

            for span in spans:
                for key in [
                    self._segment_id(span.project_id, span.trace_id, span.span_id),
                    self._queue_key(span.trace_id),
                ]:
                    node = self.client.get_node_from_key(key)
                    if node not in pipelines_by_node:
                        pipelines_by_node[node] = p = node.pipeline(transaction=False)
                        pipelines_to_execute.append(p)

                    pipelines_by_key[key] = pipelines_by_node[node]
        else:
            p = self.client.pipeline(transaction=False)
            pipelines_by_key = defaultdict(lambda: p)
            pipelines_to_execute.append(p)

        for span in spans:
            # (parent_span_id) -> [Span]
            queue_key = self._queue_key(span.trace_id)
            _key = partial(self._segment_id, span.project_id, span.trace_id)
            parent_span_id = span.parent_span_id or span.span_id
            parent_key = _key(parent_span_id)
            span_key = _key(span.span_id)

            p = pipelines_by_key[span_key]
            queue_p = pipelines_by_key[queue_key]

            is_root_span = self._is_root_span(span)

            if not is_root_span:
                p.sunionstore(
                    parent_key,
                    parent_key,
                    span_key,
                )
                p.delete(span_key)
                queue_p.zrem(queue_key, span_key)

            parent_span_id = span.parent_span_id or span.span_id
            # TODO: shard this set?
            # TODO: do we actually need set operations, maybe array is faster?
            p.sadd(parent_key, span.payload)
            p.expire(parent_key, self.max_timeout)

            if is_root_span:
                pq_timestamp = now + self.span_buffer_root_timeout
            else:
                pq_timestamp = now + self.span_buffer_timeout

            queue_p.zadd(queue_key, {parent_key: pq_timestamp})
            queue_p.expire(queue_key, self.max_timeout)

        for p in pipelines_to_execute:
            p.execute()

    def flush_segments(self, now: int) -> dict[SegmentId, set[bytes]]:
        cutoff = now

        with self.client.pipeline(transaction=False) as p:
            for shard in range(self.sharding_factor):
                key = f"span-buf:q:{shard}"
                p.zrangebyscore(key, 0, cutoff)
                # TODO: delete only when flushing succeeds? maybe use ZRANGESTORE
                p.zremrangebyscore(key, 0, cutoff)

            result = p.execute()
            result = iter(result)

        segment_ids = []

        with self.client.pipeline(transaction=False) as p:
            for segment_span_ids in result:
                # process return value of zrevrangebyscore
                for segment_id in segment_span_ids:
                    # TODO: SSCAN
                    segment_ids.append(segment_id)
                    p.smembers(segment_id)

                # skip remrangebyscore return value
                assert isinstance(next(result), int)

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

            p.execute()
