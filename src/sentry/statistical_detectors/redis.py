from __future__ import annotations

from collections.abc import Mapping
from datetime import UTC, date, datetime, time, timedelta

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.models.statistical_detectors import RegressionType
from sentry.statistical_detectors.base import DetectorPayload
from sentry.statistical_detectors.store import DetectorStore
from sentry.utils import redis

STATE_TTL = 24 * 60 * 60  # 1 day TTL
FUNCTION_CHANGE_POINT_TTL = 7 * 24 * 60 * 60
FUNCTION_CHANGE_POINT_BATCH_SIZE = 1_000
FUNCTION_CHANGE_POINT_LEASE_DURATION = 5 * 60

claim_function_change_points = redis.load_redis_script(
    "statistical_detectors/claim_function_change_points.lua"
)


class FunctionChangePointQueue:
    ready_key = "sd:fncp:{queue}:ready"

    def __init__(self, client: RedisCluster | StrictRedis | None = None):
        self._client = client

    @property
    def client(self) -> RedisCluster | StrictRedis:
        if self._client is None:
            self._client = RedisDetectorStore.get_redis_client()
        return self._client

    def enqueue(self, project_id: int, function: int | str, ready_at: datetime) -> None:
        self.enqueue_many([(project_id, function, ready_at)])

    def key_for(self, day: date) -> str:
        return f"{self.ready_key}:{day:%Y%m%d}"

    @staticmethod
    def expires_at(day: date) -> int:
        return int(
            datetime.combine(day + timedelta(days=1), time.min, tzinfo=UTC).timestamp()
            + FUNCTION_CHANGE_POINT_TTL
        )

    def enqueue_many(self, candidates: list[tuple[int, int | str, datetime]]) -> None:
        if not candidates:
            return

        with self.client.pipeline() as pipeline:
            days = set()
            for project_id, function, ready_at in candidates:
                day = ready_at.astimezone(UTC).date()
                days.add(day)
                member = f"{project_id}:{ready_at.timestamp()}:{function}"
                pipeline.zadd(self.key_for(day), {member: ready_at.timestamp()}, nx=True)
            for day in days:
                pipeline.expireat(self.key_for(day), self.expires_at(day))
            pipeline.execute()

    def claim_due(self, now: datetime) -> list[tuple[int, str, datetime]]:
        candidates: list[tuple[int, str, datetime]] = []
        today = now.astimezone(UTC).date()
        now_timestamp = now.timestamp()
        for days_ago in range(FUNCTION_CHANGE_POINT_TTL // (24 * 60 * 60), -1, -1):
            day = today - timedelta(days=days_ago)
            members = claim_function_change_points(
                keys=[self.key_for(day)],
                args=[
                    now_timestamp,
                    now_timestamp + FUNCTION_CHANGE_POINT_LEASE_DURATION,
                    FUNCTION_CHANGE_POINT_BATCH_SIZE - len(candidates),
                ],
                client=self.client,
            )
            for member in members:
                member = member.decode() if isinstance(member, bytes) else member
                project_id, timestamp, function = member.split(":", 2)
                candidates.append(
                    (int(project_id), function, datetime.fromtimestamp(float(timestamp), UTC))
                )
            if len(candidates) >= FUNCTION_CHANGE_POINT_BATCH_SIZE:
                break
        return candidates

    def acknowledge(self, candidates: list[tuple[int, str, datetime]]) -> None:
        if not candidates:
            return

        with self.client.pipeline() as pipeline:
            for project_id, function, ready_at in candidates:
                day = ready_at.astimezone(UTC).date()
                member = f"{project_id}:{ready_at.timestamp()}:{function}"
                pipeline.zrem(self.key_for(day), member)
            pipeline.execute()


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
    ) -> RedisCluster | StrictRedis:
        if self._client is None:
            self._client = self.get_redis_client() if client is None else client
        return self._client

    def bulk_read_states(
        self, payloads: list[DetectorPayload]
    ) -> list[Mapping[str | bytes, bytes | float | int | str]]:
        with self.client.pipeline() as pipeline:
            for payload in payloads:
                key = self.make_key(payload)
                pipeline.hgetall(key)
            return pipeline.execute()

    def bulk_write_states(
        self,
        payloads: list[DetectorPayload],
        states: list[Mapping[str | bytes, bytes | float | int | str] | None],
    ) -> None:
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

    def make_key(self, payload: DetectorPayload) -> str:
        return (
            f"sd:p:{payload.project_id}:{self.regression_type.abbreviate()}:{payload.fingerprint}"
        )

    @staticmethod
    def get_redis_client() -> RedisCluster | StrictRedis:
        return redis.redis_clusters.get(settings.SENTRY_STATISTICAL_DETECTORS_REDIS_CLUSTER)
