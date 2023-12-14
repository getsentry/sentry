from __future__ import annotations

from enum import Enum
from typing import List, Mapping

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.statistical_detectors.detector import DetectorPayload, DetectorStore
from sentry.utils import redis

STATE_TTL = 24 * 60 * 60  # 1 day TTL


class DetectorType(Enum):
    ENDPOINT = "e"
    FUNCTION = "f"


class RedisDetectorStore(DetectorStore):
    def __init__(
        self,
        detector_type: DetectorType,
        client: RedisCluster | StrictRedis | None = None,
        ttl=STATE_TTL,
    ):
        self.detector_type = detector_type
        self.ttl = ttl
        self._client: RedisCluster | StrictRedis | None = None

    @property
    def client(
        self,
        client: RedisCluster | StrictRedis | None = None,
    ):
        if self._client is None:
            self._client = self.get_redis_client() if client is None else client
        return self._client

    def bulk_read_states(
        self, payloads: List[DetectorPayload]
    ) -> List[Mapping[str | bytes, bytes | float | int | str]]:
        with self.client.pipeline() as pipeline:
            for payload in payloads:
                key = self.make_key(payload)
                pipeline.hgetall(key)
            return pipeline.execute()

    def bulk_write_states(
        self,
        payloads: List[DetectorPayload],
        states: List[Mapping[str | bytes, bytes | float | int | str] | None],
    ):
        # the number of new states must match the number of payloads
        assert len(states) == len(payloads)

        with self.client.pipeline() as pipeline:
            for state, payload in zip(states, payloads):
                if state is None:
                    continue
                key = self.make_key(payload)
                pipeline.hmset(key, state)
                pipeline.expire(key, self.ttl)

            pipeline.execute()

    def make_key(self, payload: DetectorPayload):
        return f"sd:p:{payload.project_id}:{self.detector_type.value}:{payload.fingerprint}"

    @staticmethod
    def get_redis_client() -> RedisCluster | StrictRedis:
        return redis.redis_clusters.get(settings.SENTRY_STATISTICAL_DETECTORS_REDIS_CLUSTER)
