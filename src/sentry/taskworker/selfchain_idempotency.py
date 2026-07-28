"""Idempotency guard for self-chaining taskworker tasks.

Self-chaining tasks (e.g. ``merge_groups``, ``unmerge``) produce their next activation via
``.delay()`` before the worker records the current one COMPLETE. Because taskbroker is
at-least-once, an activation whose COMPLETE does not reach the broker before its processing
deadline is re-pent (redelivered). A re-pend of an activation that already produced its child
yields a *duplicate* child, turning a linear chain into an exponential branching process.

This module records "this activation has already produced its chained child" keyed on the broker
activation id (stable across a re-pend). A redelivered activation that finds its marker skips
re-spawning, so at most one child is produced per activation while the chain is never lost (the
marker is only written *after* the child is enqueued).

The guard is best-effort de-amplification, not exactly-once: it fails open (never blocks or drops a
chain) on Redis errors or when disabled.
"""

from __future__ import annotations

import logging

from django.conf import settings
from redis.client import StrictRedis
from redis.exceptions import RedisError
from sentry_redis_tools.clients import RedisCluster

from sentry import options
from sentry.utils import redis

logger = logging.getLogger(__name__)


def _client() -> RedisCluster[str] | StrictRedis[str]:
    # Named setting (defaults to "default") so ops can point ephemeral markers at the
    # appropriate per-cell cluster without a code change, matching the other
    # SENTRY_*_REDIS_CLUSTER settings.
    return redis.redis_clusters.get(settings.SENTRY_SELFCHAIN_IDEMPOTENCY_REDIS_CLUSTER)


def _key(task_key: str, activation_id: str) -> str:
    return f"tw:selfchain:{task_key}:{activation_id}"


def already_spawned(task_key: str, activation_id: str) -> bool:
    """Return True if this activation already produced its chained child in a prior delivery.

    A True result means the current execution is a broker re-pend of an activation that already did
    its work and enqueued its continuation, so it should be a no-op. Fails open (returns False) on
    any Redis error or when disabled, so the chain is never blocked.
    """
    if not options.get("taskworker.selfchain_idempotency.enabled"):
        return False
    try:
        return _client().get(_key(task_key, activation_id)) is not None
    except RedisError:
        logger.warning("taskworker.selfchain.redis_error", exc_info=True)
        return False


def mark_spawned(task_key: str, activation_id: str) -> None:
    """Record that this activation has produced its chained child.

    Must be called immediately after the child is enqueued so that a later re-pend of this same
    activation becomes a no-op. Fails open (no-op) on any Redis error or when disabled.
    """
    if not options.get("taskworker.selfchain_idempotency.enabled"):
        return
    ttl = options.get("taskworker.selfchain_idempotency.ttl")
    try:
        _client().set(_key(task_key, activation_id), "1", nx=True, ex=ttl)
    except RedisError:
        logger.warning("taskworker.selfchain.redis_error", exc_info=True)
