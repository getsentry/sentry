"""Each organization's anomaly evaluator state, kept in Redis.

Anomaly detection runs once per organization per minute. Each run evaluates every project
for the same minutes, because anomalies are correlated across projects. The result is
stored as one value per organization: a bookmark for the next minute to evaluate, plus a
checkpoint. The checkpoint holds each project's baselines (keyed by series, and each
series belongs to a project) and the cross-project correlation state. One value means
one atomic write, so all projects always resume from the same minute.

State expires when it stops advancing: its organization stopped evaluating, and a later
run would discard a checkpoint that stale anyway.

Key space
---------
Every anomaly detection key for an organization is `anomaly-detection:{<org_id>}:...`.
The braces are a Redis Cluster hash tag, so all of an organization's keys share one slot
and multi-key reads (`MGET`, `PFCOUNT`, `MULTI`) work across them:

    anomaly-detection:{<org_id>}:state:v1                 this module: next minute + checkpoint
    anomaly-detection:{<org_id>}:shape:v1:<date>          inputs.shapes: daily hour-of-day shapes
    anomaly-detection:{<org_id>}:shape-build:v1:<date>    inputs.shapes: claim on a day's build
    anomaly-detection:{<org_id>}:environments:v1:...      inputs.measurements: scope inventory

These are reserved for the storage layout the minute path will need:

    anomaly-detection:{<org_id>}:m:<minute>      packed minute block, one per org-minute
    anomaly-detection:{<org_id>}:dict:<v>        slice dictionary the blocks reference
    anomaly-detection:{<org_id>}:iu:<group_id>   HyperLogLog of a new issue's users

Rules for adding keys:

- Tag only the organization id. Organizations too large for one slot shard their
  per-minute keys as `{<org_id>:<shard>}`; `state` stays on `{<org_id>}` so a run
  commits every project in one write.
- Put format versions in the suffix (`state:v1`, `dict:<v>`), so a format change
  starts fresh and the old keys expire on their own.
- Give every key a TTL, refreshed by its writer if it must outlive one. A cluster can't
  cheaply list an organization's keys, so cleanup is deleting known names and letting
  the rest expire.
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

_NAMESPACE = "anomaly-detection"

# The stored value is the next minute as big-endian epoch seconds, then the checkpoint.
_NEXT_MINUTE_HEADER = struct.Struct(">q")


@dataclass(frozen=True)
class AnomalyDetectionState:
    next_minute: datetime  # The first minute the evaluator hasn't evaluated, in UTC.
    checkpoint: bytes  # see sentry.anomaly_detection.checkpoint.codec


def client() -> RedisCluster[bytes] | StrictRedis[bytes]:
    return redis.redis_clusters.get_binary(settings.SENTRY_ANOMALY_DETECTION_REDIS_CLUSTER)


def org_key(organization_id: int, *parts: str) -> str:
    """A key in the organization's hash-tagged slot; see "Key space" above."""
    return ":".join((_NAMESPACE, f"{{{organization_id}}}", *parts))


def _key(organization_id: int) -> str:
    return org_key(organization_id, "state", "v1")


def get_state(organization_id: int) -> AnomalyDetectionState | None:
    value = client().get(_key(organization_id))

    if value is None:
        return None

    (seconds,) = _NEXT_MINUTE_HEADER.unpack_from(value)

    return AnomalyDetectionState(
        next_minute=datetime.fromtimestamp(seconds, UTC),
        checkpoint=value[_NEXT_MINUTE_HEADER.size :],
    )


def set_state(organization_id: int, *, next_minute: datetime, checkpoint: bytes) -> None:
    """
    Replace the organization's state and restart its TTL.

    The caller must hold the organization's evaluation lease, so no other worker writes
    between its read and this write.
    """
    if next_minute.tzinfo is None:
        raise ValueError("Anomaly detection state minutes must be timezone-aware")

    client().set(
        _key(organization_id),
        _NEXT_MINUTE_HEADER.pack(int(next_minute.timestamp())) + checkpoint,
        ex=STATE_TTL,
    )


def delete_state(organization_id: int) -> None:
    client().delete(_key(organization_id))
