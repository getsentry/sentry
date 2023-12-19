from __future__ import annotations

from typing import List, Mapping

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.models.statistical_detectors import RegressionType
from sentry.statistical_detectors.base import DetectorPayload
from sentry.statistical_detectors.store import DetectorStore
from sentry.utils import redis

STATE_TTL = 24 * 60 * 60  # 1 day TTL


class RedisDetectorStore(DetectorStore):
    def __init__(
        self,
        regression_type: RegressionType,
        client: RedisCluster | StrictRedis | None = None,
        ttl=STATE_TTL,
    ):
        self.regression_type = regression_type
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
        return (
            f"sd:p:{payload.project_id}:{self.regression_type.abbreviate()}:{payload.fingerprint}"
        )

    @staticmethod
    def get_redis_client() -> RedisCluster | StrictRedis:
        return redis.redis_clusters.get(settings.SENTRY_STATISTICAL_DETECTORS_REDIS_CLUSTER)
