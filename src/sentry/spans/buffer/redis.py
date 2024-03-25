from __future__ import annotations

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import json, redis

SEGMENT_TTL = 5 * 60  # 5 min TTL in seconds
TWO_MINUTES = 2 * 60  # 2 min delay in seconds


def get_redis_client() -> RedisCluster | StrictRedis:
    return redis.redis_clusters.get(settings.SENTRY_SPAN_BUFFER_CLUSTER, decode_responses=False)


def get_segment_key(project_id: str | int, segment_id: str) -> str:
    return f"segment:{segment_id}:{project_id}:process-segment"


def get_last_processed_timestamp_key(partition_index: int) -> str:
    return f"performance-issues:last-processed-timestamp:partition:{partition_index}"


def get_unprocessed_segments_key(partition_index: int) -> str:
    return f"performance-issues:unprocessed-segments:partition:{partition_index}"


class RedisSpansBuffer:
    def __init__(self):
        self.client: RedisCluster | StrictRedis = get_redis_client()

    def write_span_and_check_processing(
        self,
        project_id: str | int,
        segment_id: str,
        timestamp: int,
        partition: int,
        span: bytes,
    ) -> bool:
        segment_key = get_segment_key(project_id, segment_id)
        timestamp_key = get_last_processed_timestamp_key(partition)

        with self.client.pipeline() as p:
            # RPUSH is atomic
            p.rpush(segment_key, span)
            # GETSET is atomic
            p.getset(timestamp_key, timestamp)
            results = p.execute()

        new_key = results[0] == 1
        last_processed_timestamp: bytes | None = results[1]

        if new_key:
            bucket = get_unprocessed_segments_key(partition)
            with self.client.pipeline() as p:
                p.expire(segment_key, SEGMENT_TTL)
                p.rpush(bucket, json.dumps([timestamp, segment_key]))
                p.execute()

        if last_processed_timestamp is None:
            return False

        return timestamp > int(last_processed_timestamp)

    def read_and_expire_many_segments(self, keys: list[str]) -> list[tuple[str, list[str | bytes]]]:
        values = []
        with self.client.pipeline() as p:
            for key in keys:
                p.lrange(key, 0, -1)

            p.delete(*keys)
            response = p.execute()

        for value in response[:-1]:
            values.append(value)

        return values

    def get_unprocessed_segments_and_prune_bucket(self, now: int, partition: int) -> list[str]:
        key = get_unprocessed_segments_key(partition)
        results = self.client.lrange(key, 0, -1) or []

        ltrim_index = 0
        segment_keys = []
        for result in results:
            segment_timestamp, segment_key = json.loads(result)
            if now - segment_timestamp < TWO_MINUTES:
                break

            ltrim_index += 1
            segment_keys.append(segment_key)

        self.client.ltrim(key, ltrim_index, -1)

        return segment_keys
