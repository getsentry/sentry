from __future__ import annotations

import math
from datetime import datetime

from django.conf import settings
from django.utils import timezone as django_timezone
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import json, redis
from sentry.utils.dates import to_timestamp

SEGMENT_TTL = 5 * 60  # 5 min TTL in seconds
TWO_MINUTES = 2 * 60  # 2 min delay in seconds


def get_redis_client() -> RedisCluster | StrictRedis:
    return redis.redis_clusters.get(settings.SENTRY_SPAN_BUFFER_CLUSTER)


def get_segment_key(project_id: str | int, segment_id: str) -> str:
    return f"segment:{segment_id}:{project_id}:process-segment"


def get_unprocessed_segments_key() -> str:
    return "unprocessed-segments"


def rounded_down_to_nearest_ten_seconds(value: datetime) -> datetime:
    return value.replace(second=math.floor(value.second / 10) * 10)


class RedisSpansBuffer:
    def __init__(self):
        self.client: RedisCluster | StrictRedis = get_redis_client()

    def _read_key(self, key: str, batch_size: int = None) -> list[str | bytes]:
        if batch_size:
            return self.client.lrange(key, 0, batch_size) or []
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

    def write_span(self, project_id: str | int, segment_id: str, span: bytes) -> bool:
        segment_key = get_segment_key(project_id, segment_id)
        length = self.client.rpush(segment_key, span)
        new_key = length == 1

        if new_key:
            with self.client.pipeline() as p:
                p.expire(segment_key, SEGMENT_TTL)

                now = to_timestamp(django_timezone.now())
                bucket = get_unprocessed_segments_key()
                p.rpush(bucket, json.dumps([now, segment_key]))
                p.execute()

    def read_many_segments(self, keys: list[str]) -> list[tuple[str, list[str | bytes]]]:
        return self._read_many_keys(keys)

    def expire_many_segments(self, keys):
        with self.client.pipeline() as p:
            for key in keys:
                p.expire(key, 0)

            p.execute()

    def get_segment_keys_and_prune(self, batch_size=100) -> list[str]:
        key = get_unprocessed_segments_key()
        results = self._read_key(key, batch_size)

        now = to_timestamp(django_timezone.now())

        i = 0
        segment_keys = []
        for i, result in enumerate(results):
            timestamp, key = json.loads(result)

            if now - timestamp < TWO_MINUTES:
                break

            segment_keys.append((timestamp, key))

        self.client.lpop(key, 0, i)

        return segment_keys
