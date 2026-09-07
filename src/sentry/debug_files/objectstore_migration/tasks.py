from __future__ import annotations

import logging
import random
from time import monotonic

from django.db.models import F, Func, Value
from django.db.models.fields import IntegerField
from taskbroker_client.retry import Retry
from taskbroker_client.state import current_task
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry import options
from sentry.debug_files.objectstore_migration.utils import migrate_debug_file
from sentry.locks import locks
from sentry.models.debugfile import ProjectDebugFile
from sentry.silo.base import SiloMode
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import debug_files_migration_tasks
from sentry.taskworker.selfchain_idempotency import already_spawned, mark_spawned
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.retries import ConditionalRetryPolicy, exponential_delay

logger = logging.getLogger(__name__)

_SHARD_TASK_KEY = "debug_files_objectstore_migration_shard"
_FILES_PER_ACTIVATION = 30
_PROCESSING_DEADLINE_SECONDS = 10 * 60
_SHARD_LOCK_DURATION_SECONDS = _PROCESSING_DEADLINE_SECONDS


def enqueue_shard(
    *,
    shard_id: int,
    num_shards: int,
    cursor: int,
) -> None:
    def enqueue() -> None:
        delivery = migrate_shard.apply_async_with_future(
            kwargs={
                "shard_id": shard_id,
                "num_shards": num_shards,
                "cursor": cursor,
            },
            headers={"sentry-propagate-traces": False},
        )
        if delivery is not None:
            delivery.result()

    base_delay = exponential_delay(2)
    policy = ConditionalRetryPolicy(
        test_function=lambda attempt_number, _: attempt_number <= 2,
        delay_function=lambda n: random.uniform(base_delay(n), base_delay(n) * 2),
    )
    policy(enqueue)


@instrumented_task(
    name="sentry.debug_files.objectstore_migration.migrate_shard",
    namespace=debug_files_migration_tasks,
    retry=Retry(times=5, delay=30, on=(ProcessingDeadlineExceeded,)),
    processing_deadline_duration=_PROCESSING_DEADLINE_SECONDS,
    silo_mode=SiloMode.CELL,
)
def migrate_shard(
    shard_id: int,
    num_shards: int,
    cursor: int,
    **kwargs: object,
) -> None:
    """Process one page of DIFs for a shard, then self-chain if more remain.

    Walks ids high → low.
    ``cursor`` is the inclusive first id to process on this activation.

    Args:
        shard_id: Partition index in ``0..num_shards-1``.
        num_shards: Number of partitions; a DIF with ID ``id`` is assigned to
            shard ``id % num_shards``.
        cursor: Inclusive upper bound on ``ProjectDebugFile.id``.
    """

    shard_started_at = monotonic()
    task = current_task()
    activation_id = task.id if task else None
    activation_attempt = task.attempt if task else None

    def log_extra(**extra: float | int | None) -> dict[str, float | int | None]:
        return {
            "shard_id": shard_id,
            "num_shards": num_shards,
            "cursor": cursor,
            "activation_attempt": activation_attempt,
            **extra,
        }

    if not options.get("debug-files.objectstore-migration.enabled"):
        logger.info(
            "debug_files.objectstore_migration.killswitched",
            extra=log_extra(),
        )
        return

    if activation_id and already_spawned(_SHARD_TASK_KEY, activation_id):
        metrics.incr(
            "taskworker.selfchain.duplicate_skipped",
            tags={"task": _SHARD_TASK_KEY},
        )
        return

    debug_file: ProjectDebugFile | None = None
    lock = locks.get(
        key=f"debug-files-objectstore-migration:{num_shards}:{shard_id}",
        duration=_SHARD_LOCK_DURATION_SECONDS,
        name="debug_files_objectstore_migration_shard",
    )
    try:
        with lock.acquire():
            to_migrate = list(
                ProjectDebugFile.objects.filter(
                    id__lte=cursor,
                    file_id__isnull=False,
                )
                .annotate(
                    _migration_shard=Func(
                        F("id"), Value(num_shards), function="MOD", output_field=IntegerField()
                    )
                )
                .filter(_migration_shard=shard_id)
                .select_related("file")
                .order_by("-id")[:_FILES_PER_ACTIVATION]
            )
            if not to_migrate:
                logger.info(
                    "debug_files.objectstore_migration.shard_completed",
                    extra=log_extra(),
                )
                return

            for debug_file in to_migrate:
                migrate_debug_file(debug_file)

            lowest_id = to_migrate[-1].id
            duration_seconds = monotonic() - shard_started_at
            logger.info(
                "debug_files.objectstore_migration.shard_progress",
                extra=log_extra(
                    processed_this_activation=len(to_migrate),
                    lowest_id=lowest_id,
                    duration_seconds=duration_seconds,
                ),
            )

            if len(to_migrate) < _FILES_PER_ACTIVATION or lowest_id <= 0:
                logger.info(
                    "debug_files.objectstore_migration.shard_completed",
                    extra=log_extra(lowest_id=lowest_id),
                )
                return

            enqueue_shard(
                shard_id=shard_id,
                num_shards=num_shards,
                cursor=lowest_id - 1,
            )
            if activation_id:
                mark_spawned(_SHARD_TASK_KEY, activation_id)
    except UnableToAcquireLock:
        logger.exception(
            "debug_files.objectstore_migration.shard_already_running",
            extra=log_extra(),
        )
        return
    except Exception:
        logger.exception(
            "debug_files.objectstore_migration.shard_failed",
            extra=log_extra(failed_debug_file_id=debug_file.id if debug_file is not None else None),
        )
        raise
