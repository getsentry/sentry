from __future__ import annotations

import logging
from enum import StrEnum
from time import monotonic

from django.db import router
from django.db.models import F, Func, Max, Value
from django.db.models.fields import IntegerField

from sentry import options
from sentry.debug_files.objectstore_migration.utils import migrate_debug_file
from sentry.models.debugfile import DebugFileObjectstoreMigrationState, ProjectDebugFile

logger = logging.getLogger(__name__)

FILES_PER_BATCH = 30
IDS_PER_QUERY = 10_000


class ShardRunResult(StrEnum):
    COMPLETED = "completed"
    KILLSWITCHED = "killswitched"
    NOT_INITIALIZED = "not_initialized"
    RUNTIME_EXHAUSTED = "runtime_exhausted"


def initialize_migration(*, shard_count: int) -> None:
    """Create one durable cursor per modulo shard."""
    if not options.get("debug-files.objectstore-migration.enabled"):
        logger.info("debug_files.objectstore_migration.killswitched")
        return
    if shard_count < 1:
        raise ValueError("shard_count must be positive")

    state_database = router.db_for_write(DebugFileObjectstoreMigrationState)
    existing_count = DebugFileObjectstoreMigrationState.objects.using(state_database).count()
    if existing_count:
        if existing_count != shard_count:
            raise RuntimeError("Durable migration was initialized with a different shard count")
        return

    debug_file_database = router.db_for_read(ProjectDebugFile)
    max_id = (
        ProjectDebugFile.objects.using(debug_file_database).aggregate(max_id=Max("id"))["max_id"]
        or 0
    )
    states = [
        DebugFileObjectstoreMigrationState(shard_id=shard_id, cursor=max_id)
        for shard_id in range(shard_count)
    ]

    DebugFileObjectstoreMigrationState.objects.using(state_database).bulk_create(states)
    logger.info(
        "debug_files.objectstore_migration.initialized",
        extra={"shard_count": shard_count, "max_id": max_id},
    )


def _process_next_batch(state: DebugFileObjectstoreMigrationState, *, shard_count: int) -> bool:
    """Process and checkpoint one bounded ID window. Return whether work remains."""
    if state.cursor <= 0:
        return False

    query_lower_bound = max(1, state.cursor - IDS_PER_QUERY + 1)
    debug_file_database = router.db_for_read(ProjectDebugFile)
    debug_files = list(
        ProjectDebugFile.objects.using(debug_file_database)
        .filter(
            id__gte=query_lower_bound,
            id__lte=state.cursor,
            file_id__isnull=False,
        )
        .annotate(
            _migration_shard=Func(
                F("id"), Value(shard_count), function="MOD", output_field=IntegerField()
            )
        )
        .filter(_migration_shard=state.shard_id)
        .select_related("file")
        .order_by("-id")[:FILES_PER_BATCH]
    )

    for debug_file in debug_files:
        if not options.get("debug-files.objectstore-migration.enabled"):
            return True
        migrate_debug_file(debug_file)

    next_cursor = (
        debug_files[-1].id - 1 if len(debug_files) == FILES_PER_BATCH else query_lower_bound - 1
    )
    state_database = router.db_for_write(DebugFileObjectstoreMigrationState)
    updated = (
        DebugFileObjectstoreMigrationState.objects.using(state_database)
        .filter(id=state.id, cursor=state.cursor)
        .update(cursor=next_cursor)
    )
    if not updated:
        state.refresh_from_db(using=state_database, fields=["cursor"])
        return state.cursor > 0

    logger.info(
        "debug_files.objectstore_migration.shard_progress",
        extra={
            "shard_id": state.shard_id,
            "processed": len(debug_files),
            "cursor": next_cursor,
        },
    )
    state.cursor = next_cursor
    return next_cursor > 0


def run_migration_shard(
    *,
    shard_id: int,
    shard_count: int,
    max_runtime_seconds: int,
) -> ShardRunResult:
    if shard_count < 1:
        raise ValueError("shard_count must be positive")
    if shard_id < 0 or shard_id >= shard_count:
        raise ValueError("shard_id must be between 0 and shard_count - 1")
    if max_runtime_seconds < 1:
        raise ValueError("max_runtime_seconds must be positive")

    if not options.get("debug-files.objectstore-migration.enabled"):
        logger.info(
            "debug_files.objectstore_migration.killswitched",
            extra={"shard_id": shard_id, "shard_count": shard_count},
        )
        return ShardRunResult.KILLSWITCHED

    state_database = router.db_for_read(DebugFileObjectstoreMigrationState)
    if DebugFileObjectstoreMigrationState.objects.using(state_database).count() != shard_count:
        logger.info(
            "debug_files.objectstore_migration.not_initialized",
            extra={"shard_id": shard_id, "shard_count": shard_count},
        )
        return ShardRunResult.NOT_INITIALIZED

    state = DebugFileObjectstoreMigrationState.objects.using(state_database).get(shard_id=shard_id)
    deadline = monotonic() + max_runtime_seconds
    while monotonic() < deadline:
        if not options.get("debug-files.objectstore-migration.enabled"):
            logger.info(
                "debug_files.objectstore_migration.killswitched",
                extra={"shard_id": shard_id, "shard_count": shard_count},
            )
            return ShardRunResult.KILLSWITCHED
        if not _process_next_batch(state, shard_count=shard_count):
            logger.info(
                "debug_files.objectstore_migration.shard_completed",
                extra={"shard_id": shard_id, "shard_count": shard_count},
            )
            return ShardRunResult.COMPLETED

    return ShardRunResult.RUNTIME_EXHAUSTED
