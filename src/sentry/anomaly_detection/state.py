"""Each organization's anomaly evaluator checkpoint, kept in Redis.

One key per organization holds the first minute the evaluator hasn't evaluated, followed
by the evaluator checkpoint. Writes don't compare-and-set: callers must hold the
organization's evaluation lease. State expires when it stops advancing: its organization
stopped evaluating, and a later run would discard a checkpoint that stale anyway.
"""

from __future__ import annotations

import struct
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from django.conf import settings
from sentry_redis_tools.clients import RedisCluster, StrictRedis

from sentry.utils import redis

# How long state is kept after its last write.
STATE_TTL = timedelta(days=1)

# The stored value is the next minute as big-endian epoch seconds, then the checkpoint.
_MINUTE = struct.Struct(">q")
ANOMALY_KEY_PREFIX = "anomaly-detection:state:v1"


@dataclass(frozen=True)
class AnomalyDetectionState:
    next_minute: datetime  # The first minute the evaluator hasn't evaluated, in UTC.
    checkpoint: bytes  # see sentry.anomaly_detection.checkpoint.codec


def _client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    return redis.redis_clusters.get_binary(settings.SENTRY_ANOMALY_DETECTION_REDIS_CLUSTER)


def _key(organization_id: int) -> str:
    return f"{ANOMALY_KEY_PREFIX}:{organization_id}"


def get_state(organization_id: int) -> AnomalyDetectionState | None:
    value = _client().get(_key(organization_id))
    if value is None:
        return None
    (seconds,) = _MINUTE.unpack_from(value)
    return AnomalyDetectionState(
        next_minute=datetime.fromtimestamp(seconds, UTC), checkpoint=value[_MINUTE.size :]
    )


def set_state(organization_id: int, *, next_minute: datetime, checkpoint: bytes) -> None:
    """
    Replace the organization's state and restart its TTL.

    The caller must hold the organization's evaluation lease, so no other worker writes
    between its read and this write.
    """
    if next_minute.tzinfo is None:
        raise ValueError("Anomaly detection state minutes must be timezone-aware")

    _client().set(
        _key(organization_id),
        _MINUTE.pack(int(next_minute.timestamp())) + checkpoint,
        ex=STATE_TTL,
    )


def delete_state(organization_id: int) -> None:
    _client().delete(_key(organization_id))
