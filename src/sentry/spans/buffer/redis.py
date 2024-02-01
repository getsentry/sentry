from __future__ import annotations

from typing import List

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import redis

SEGMENT_TTL = 5 * 60  # 5 min TTL in seconds


class RedisSpansBuffer:
    def __init__(
        self,
    ):
        self.client: RedisCluster | StrictRedis = self.get_redis_client()

    def read_segment(self, segment_id: str) -> List[str | bytes]:
        segment = self.client.lrange(segment_id, 0, -1)
        if segment:
            return segment

        return []

    def write_span(self, segment_id: str, span: bytes) -> bool:
        length = self.client.rpush(segment_id, span)
        new_key = length == 1

        if new_key:
            self.client.expire(segment_id, SEGMENT_TTL)

        return new_key

    @staticmethod
    def get_redis_client() -> RedisCluster | StrictRedis:
        return redis.redis_clusters.get(settings.SENTRY_SPAN_BUFFER_CLUSTER)
