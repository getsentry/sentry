from __future__ import annotations

from collections.abc import Collection, Sequence
from functools import partial
from typing import NamedTuple

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import redis

# This SegmentId is an internal identifier used by the redis buffer that is
# also directly used as raw redis key. the format is
# "s:{project_id:trace_id}:span_id", and the type is bytes because our redis
# client is bytes.
#
# The segment ID in the Kafka protocol is actually only the span ID.
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

    def _is_root_span(self, span: Span) -> bool:
        return span.parent_span_id is None or span.is_segment_span

    def process_spans(self, spans: Sequence[Span], now: int):
        with self.client.pipeline(transaction=False) as p:
            for span in spans:
                # (parent_span_id) -> [Span]
                shard = int(span.trace_id, 16) % self.sharding_factor
                queue_key = f"span-buf:q:{shard}"
                _key = partial(self._segment_id, span.project_id, span.trace_id)
                parent_span_id = span.parent_span_id or span.span_id
                parent_key = _key(parent_span_id)
                span_key = _key(span.span_id)

                is_root_span = self._is_root_span(span)

                if not is_root_span:
                    # redis-py-cluster thinks that SUNIONSTORE is not safe to
                    # run, but we know better. we can guarantee that all
                    # affected keys are hashed into the same slot, as they all
                    # have the same trace and project id
                    p.pipeline_execute_command("SUNIONSTORE", parent_key, parent_key, span_key)
                    p.delete(span_key)
                    p.zrem(queue_key, span_key)

                parent_span_id = span.parent_span_id or span.span_id
                # TODO: shard this set?
                # TODO: do we actually need set operations, maybe array is faster?
                p.sadd(parent_key, span.payload)
                p.expire(parent_key, self.max_timeout)

                if is_root_span:
                    pq_timestamp = now + self.span_buffer_root_timeout
                else:
                    pq_timestamp = now + self.span_buffer_timeout

                p.zadd(queue_key, {parent_key: pq_timestamp})
                p.expire(queue_key, self.max_timeout)

            p.execute()

    def flush_segments(self, max_segments: int, now: int) -> dict[SegmentId, set[bytes]]:
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

                    if len(segment_ids) >= max_segments:
                        break

                if len(segment_ids) >= max_segments:
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

                # parse trace_id out of SegmentId, then remove from queue
                trace_id = segment_id.split(b":")[2][:-1]
                shard = int(trace_id, 16) % self.sharding_factor
                p.zrem(f"span-buf:q:{shard}", segment_id)

            p.execute()
