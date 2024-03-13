from __future__ import annotations

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import json, redis

SEGMENT_TTL = 5 * 60  # 5 min TTL in seconds
TWO_MINUTES = 2 * 60  # 2 min delay in seconds


def get_redis_client() -> RedisCluster | StrictRedis:
    return redis.redis_clusters.get(settings.SENTRY_SPAN_BUFFER_CLUSTER)


def get_segment_key(project_id: str | int, segment_id: str) -> str:
    return f"segment:{segment_id}:{project_id}:process-segment"


def get_last_processed_timestamp_key(partition_index: int) -> str:
    return f"performance-issues:last-processed-timestamp:partition:{partition_index}"


def get_unprocessed_segments_key(partition_index: int) -> str:
    return f"performance-issues:unprocessed-segments:partition:{partition_index}"


class RedisSpansBuffer:
    def __init__(self):
        self.client: RedisCluster | StrictRedis = get_redis_client()

    def _read_key(self, key: str) -> list[str | bytes]:
        return self.client.lrange(key, 0, -1) or []

    def _read_many_keys(self, keys) -> list[str]:
        values = []
        with self.client.pipeline() as p:
            for key in keys:
                p.lrange(key, 0, -1)

            response = p.execute()

        for value in response:
            values.append((key, value))

        return values

    def set_last_processed_timestamp(self, timestamp: int, partition: int):
        key = get_last_processed_timestamp_key(partition)
        self.client.set(key, timestamp)

    def write_span_and_get_last_processed_timestamp(
        self,
        project_id: str | int,
        segment_id: str,
        timestamp: int,
        partition: int,
        span: bytes,
    ) -> int | None:
        segment_key = get_segment_key(project_id, segment_id)
        last_processed_timestamp_key = get_last_processed_timestamp_key(partition)
        now = timestamp

        with self.client.pipeline() as p:
            p.rpush(segment_key, span)
            p.get(last_processed_timestamp_key)
            results = p.execute()

        new_key = results[0] == 1
        last_processed_timestamp = int(results[1]) if results[1] is not None else None

        if new_key:
            bucket = get_unprocessed_segments_key(partition)
            with self.client.pipeline() as p:
                p.expire(segment_key, SEGMENT_TTL)
                p.rpush(bucket, json.dumps([now, segment_key]))
                p.execute()

        return last_processed_timestamp

    def read_segment(self, project_id: str | int, segment_id: str) -> list[str | bytes]:
        key = get_segment_key(project_id, segment_id)

        return self.client.lrange(key, 0, -1) or []

    def read_many_segments(self, keys: list[str]) -> list[tuple[str, list[str | bytes]]]:
        return self._read_many_keys(keys)

    def expire_many_segments(self, keys):
        with self.client.pipeline() as p:
            for key in keys:
                p.expire(key, 0)

            p.execute()

    def get_unprocessed_segments_and_prune_bucket(
        self, timestamp: int, partition: int
    ) -> list[str]:
        key = get_unprocessed_segments_key(partition)
        results = self._read_key(key)

        now = timestamp

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
