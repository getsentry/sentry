from __future__ import annotations

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import redis

SEGMENT_TTL = 5 * 60  # 5 min TTL in seconds


def get_redis_client() -> RedisCluster | StrictRedis:
    return redis.redis_clusters.get(settings.SENTRY_SPAN_BUFFER_CLUSTER)


def get_segment_key(project_id: str | int, segment_id: str) -> str:
    return f"segment:{segment_id}:{project_id}:process-segment"


class RedisSpansBuffer:
    def __init__(self):
        self.client: RedisCluster | StrictRedis = get_redis_client()

    def read_segment(self, project_id: str | int, segment_id: str) -> list[str | bytes]:
        key = get_segment_key(project_id, segment_id)

        return self.client.lrange(key, 0, -1) or []

    def write_span(self, project_id: str | int, segment_id: str, span: bytes) -> bool:
        key = get_segment_key(project_id, segment_id)
        length = self.client.rpush(key, span)
        new_key = length == 1

        if new_key:
            self.client.expire(key, SEGMENT_TTL)

        return new_key
