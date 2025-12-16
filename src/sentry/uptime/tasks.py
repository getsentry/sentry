from __future__ import annotations

import logging
from datetime import datetime, timezone

from sentry.locks import locks
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import uptime_tasks
from sentry.taskworker.retry import Retry
from sentry.uptime.consumers.eap_producer import produce_eap_uptime_result
from sentry.uptime.utils import build_pending_misses_key, get_cluster
from sentry.utils import json, metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.workflow_engine.models.detector import Detector

logger = logging.getLogger(__name__)


@instrumented_task(
    name="sentry.uptime.tasks.write_pending_missed_checks",
    namespace=uptime_tasks,
    retry=Retry(times=3, delay=60),
)
def write_pending_missed_checks(**kwargs):
    """
    Background task that writes backfilled missed checks to EAP after their TTL expires.
    This task runs periodically and processes pending misses.
    """
    lock = locks.get(
        "uptime:write_pending_missed_checks",
        duration=600,
        routing_key=None,
    )

    try:
        with lock.acquire():
            _write_pending_missed_checks()
    except UnableToAcquireLock:
        logger.info("write_pending_missed_checks.unable_to_acquire_lock")
        return


def _write_pending_missed_checks():
    cluster = get_cluster()
    pending_misses_key = build_pending_misses_key()
    current_time_ms = datetime.now(timezone.utc).timestamp() * 1000

    ready_entries = cluster.zrangebyscore(
        pending_misses_key, "-inf", current_time_ms, withscores=True
    )

    total_written = 0
    total_skipped = 0

    for backfill_key, write_time in ready_entries:
        try:
            parts = backfill_key.split(":")
            detector_id = int(parts[2])
            scheduled_time_ms = int(parts[3])
        except (IndexError, ValueError):
            logger.exception(
                "write_pending_missed_checks.invalid_key_format",
                extra={"backfill_key": backfill_key},
            )
            cluster.zrem(pending_misses_key, backfill_key)
            continue

        try:
            detector = Detector.objects.select_related("project").get(id=detector_id)
        except Detector.DoesNotExist:
            logger.warning(
                "write_pending_missed_checks.detector_not_found",
                extra={"detector_id": detector_id, "backfill_key": backfill_key},
            )
            cluster.zrem(pending_misses_key, backfill_key)
            cluster.delete(backfill_key)
            continue

        miss_data_json = cluster.get(backfill_key)

        if miss_data_json is None:
            logger.info(
                "write_pending_missed_checks.miss_already_handled",
                extra={
                    "detector_id": detector_id,
                    "scheduled_time_ms": scheduled_time_ms,
                    "backfill_key": backfill_key,
                },
            )
            total_skipped += 1
        else:
            try:
                produce_eap_uptime_result(
                    detector,
                    json.loads(miss_data_json),
                    {},
                )
                total_written += 1
            except Exception:
                logger.exception(
                    "write_pending_missed_checks.write_failed",
                    extra={
                        "detector_id": detector_id,
                        "scheduled_time_ms": scheduled_time_ms,
                        "backfill_key": backfill_key,
                    },
                )

            cluster.delete(backfill_key)

        # Remove from sorted set
        cluster.zrem(pending_misses_key, backfill_key)

    if total_written > 0 or total_skipped > 0:
        metrics.incr(
            "uptime.write_pending_missed_checks.processed",
            amount=total_written,
            tags={"result": "written"},
            sample_rate=1.0,
        )
        metrics.incr(
            "uptime.write_pending_missed_checks.processed",
            amount=total_skipped,
            tags={"result": "skipped"},
            sample_rate=1.0,
        )
