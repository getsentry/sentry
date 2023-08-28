from __future__ import annotations

from typing import List

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.statistical_detectors.detector import TrendPayload, TrendState
from sentry.utils import redis

STATE_TTL = 24 * 60 * 60  # 1 day TTL


def get_redis_client() -> RedisCluster | StrictRedis:
    return redis.redis_clusters.get(settings.SENTRY_STATISTICAL_DETECTORS_REDIS_CLUSTER)


def fetch_states(
    payloads: List[TrendPayload],
    client: RedisCluster | StrictRedis | None = None,
) -> List[TrendState]:
    if client is None:
        client = get_redis_client()

    with client.pipeline() as pipeline:
        for payload in payloads:
            key = make_key(payload)
            pipeline.hgetall(key)
        results = pipeline.execute()

    # the number of results must match the number of payloads
    assert len(results) == len(payloads)

    return [TrendState.from_dict(result) for result in results]


def update_states(
    states: List[TrendState | None],
    payloads: List[TrendPayload],
    client: RedisCluster | StrictRedis | None = None,
    ttl=STATE_TTL,
) -> None:
    # the number of new states must match the number of payloads
    assert len(states) == len(payloads)

    if client is None:
        client = get_redis_client()

    with client.pipeline() as pipeline:
        for state, payload in zip(states, payloads):
            if state is None:
                continue
            key = make_key(payload)
            pipeline.hmset(key, state.as_dict())
            pipeline.expire(key, ttl)

        pipeline.execute()


def make_key(payload: TrendPayload):
    # sdf = statistical detector functions
    return f"sdf:p:{payload.project_id}:f:{payload.group}"
