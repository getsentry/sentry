"""Each organization's anomaly evaluator checkpoint, kept in Redis.

One hash per organization holds the evaluator checkpoint and the first minute it hasn't
evaluated. Writes compare-and-set on that minute, so a worker that lost a race can't roll
the state back. State expires when it stops advancing: its organization stopped
evaluating, and a later run would discard a checkpoint that stale anyway.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import redis

STATE_TTL = timedelta(days=1)
"""How long state is kept after its last write."""

_set_state = redis.load_redis_script("anomaly_detection/set_state.lua")


@dataclass(frozen=True)
class AnomalyDetectionState:
    next_minute: datetime  # The first minute the evaluator hasn't evaluated, in UTC.
    checkpoint: bytes  # see sentry.anomaly_detection.checkpoint.codec


def _client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    return redis.redis_clusters.get_binary(settings.SENTRY_ANOMALY_DETECTION_REDIS_CLUSTER)


def _key(organization_id: int) -> str:
    return f"anomaly-detection:state:v1:{organization_id}"


def _encode_minute(minute: datetime) -> int:
    if minute.tzinfo is None:
        raise ValueError("Anomaly detection state minutes must be timezone-aware")

    return int(minute.timestamp())


def get_state(organization_id: int) -> AnomalyDetectionState | None:
    next_minute, checkpoint = _client().hmget(_key(organization_id), ["next_minute", "checkpoint"])

    if next_minute is None or checkpoint is None:
        return None

    return AnomalyDetectionState(
        next_minute=datetime.fromtimestamp(int(next_minute), UTC), checkpoint=checkpoint
    )


def compare_and_set_state(
    organization_id: int,
    *,
    expected_minute: datetime | None,
    next_minute: datetime,
    checkpoint: bytes,
) -> bool:
    """
    Store the state if its minute is still `expected_minute`; return whether it was stored.

    `expected_minute` is the `next_minute` read before evaluating, or None if there was no
    state. Every successful write restarts the TTL.
    """
    expected = "" if expected_minute is None else _encode_minute(expected_minute)

    return bool(
        _set_state(
            [_key(organization_id)],
            [expected, _encode_minute(next_minute), checkpoint, int(STATE_TTL.total_seconds())],
            _client(),
        )
    )


def delete_state(organization_id: int) -> None:
    _client().delete(_key(organization_id))
