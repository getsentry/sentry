"""
Whether Sentry is still adding an organization integration's repositories.

A sync records each step it reaches:

1. Requested: an install, a "repositories added" webhook or "Sync now" queues a sync.
2. Synced: the sync read the provider's repositories and queued batches to add the new ones.
3. Finished or failed: each batch finished, or the sync stopped early, such as when rate limited.

The daily sync records steps 2 and 3 too, but with no request there's no status.

A record lasts an hour after its last write. A Redis error is logged, never raised, so it can't
fail an install, webhook or job.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping, Sequence
from enum import StrEnum
from typing import Annotated, Literal

from django.utils import timezone
from pydantic import BaseModel, Field

from sentry.utils import redis

logger = logging.getLogger(__name__)

RECORD_TTL_SECONDS = 60 * 60


class RepoSyncTrigger(StrEnum):
    INSTALL = "install"
    WEBHOOK = "webhook"
    MANUAL = "manual"


class RepoSyncOk(BaseModel):
    state: Literal["syncing", "done"]
    trigger: RepoSyncTrigger


class RepoSyncFailed(BaseModel):
    state: Literal["failed"] = "failed"
    trigger: RepoSyncTrigger
    # Such as "rate_limited".
    reason: str


RepoSyncStatus = Annotated[RepoSyncOk | RepoSyncFailed, Field(discriminator="state")]


# Recording, in the order a sync reaches each step.


def record_sync_requested(
    organization_id: int, integration_id: int, trigger: RepoSyncTrigger
) -> None:
    """1. Requested: call right before queueing a sync."""
    _update_record(
        organization_id,
        integration_id,
        set_fields={"requested_at": timezone.now().timestamp(), "trigger": trigger.value},
        delete_fields=["failure"],
    )


def record_synced(organization_id: int, integration_id: int, *, batches: int = 0) -> None:
    """2. Synced: call once the sync has read the provider's repositories, with the number of
    batches it's about to queue to add them."""
    _update_record(
        organization_id,
        integration_id,
        set_fields={"synced_at": timezone.now().timestamp()},
        delete_fields=["failure"],
        increment_fields={"batches_left": batches},
    )


def record_batch_finished(organization_id: int, integration_id: int) -> None:
    """3. Finished: call at the end of each batch `record_synced` counted."""
    _update_record(organization_id, integration_id, increment_fields={"batches_left": -1})


def record_sync_failed(organization_id: int, integration_id: int, reason: str) -> None:
    """3. Or failed: call when the sync stops early."""
    _update_record(organization_id, integration_id, set_fields={"failure": reason})


# Reading.


def get_status(organization_id: int, integration_id: int) -> RepoSyncStatus | None:
    """None when no sync was requested in the last hour."""
    return get_statuses(organization_id, [integration_id]).get(integration_id)


def get_statuses(organization_id: int, integration_ids: Sequence[int]) -> dict[int, RepoSyncStatus]:
    """By integration ID, leaving out those with no sync requested in the last hour."""
    statuses = {}
    for integration_id, record in _read_records(organization_id, integration_ids).items():
        status = _status_of(record)
        if status is not None:
            statuses[integration_id] = status
    return statuses


def _status_of(record: _Record) -> RepoSyncStatus | None:
    if record.requested_at is None or record.trigger is None:
        return None
    if record.failure is not None:
        return RepoSyncFailed(trigger=record.trigger, reason=record.failure)

    synced_since_request = record.synced_at is not None and record.synced_at >= record.requested_at
    batches_finished = record.batches_left <= 0
    if synced_since_request and batches_finished:
        return RepoSyncOk(state="done", trigger=record.trigger)
    return RepoSyncOk(state="syncing", trigger=record.trigger)


# Storage: one Redis hash per organization integration.


class _Record(BaseModel):
    requested_at: float | None = None
    trigger: RepoSyncTrigger | None = None
    synced_at: float | None = None
    # Batches that were queued and haven't finished.
    batches_left: int = 0
    # Why the sync stopped early, such as "rate_limited".
    failure: str | None = None


def _key(organization_id: int, integration_id: int) -> str:
    return f"scm-repo-sync:{organization_id}:{integration_id}"


def _update_record(
    organization_id: int,
    integration_id: int,
    *,
    set_fields: Mapping[str, str | float] | None = None,
    delete_fields: Sequence[str] = (),
    increment_fields: Mapping[str, int] | None = None,
) -> None:
    """Makes the changes and renews the TTL in one pipeline."""
    key = _key(organization_id, integration_id)
    try:
        with redis.redis_clusters.get("default").pipeline() as pipeline:
            for field, value in (set_fields or {}).items():
                pipeline.hset(key, field, value)
            if delete_fields:
                pipeline.hdel(key, *delete_fields)
            for field, amount in (increment_fields or {}).items():
                pipeline.hincrby(key, field, amount)
            pipeline.expire(key, RECORD_TTL_SECONDS)
            pipeline.execute()
    except Exception:
        logger.warning(
            "scm_repo_sync_status.write_failed",
            extra={"organization_id": organization_id, "integration_id": integration_id},
            exc_info=True,
        )


def _read_records(organization_id: int, integration_ids: Sequence[int]) -> dict[int, _Record]:
    """Empty if Redis fails, so callers see no syncs instead of an error."""
    if not integration_ids:
        return {}
    try:
        with redis.redis_clusters.get("default").pipeline() as pipeline:
            for integration_id in integration_ids:
                pipeline.hgetall(_key(organization_id, integration_id))
            hashes = pipeline.execute()
    except Exception:
        logger.warning(
            "scm_repo_sync_status.read_failed",
            extra={"organization_id": organization_id},
            exc_info=True,
        )
        return {}
    return {
        integration_id: _Record.parse_obj(fields)
        for integration_id, fields in zip(integration_ids, hashes)
    }
