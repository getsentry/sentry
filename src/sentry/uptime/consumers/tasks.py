from __future__ import annotations

import logging

from sentry.locks import locks
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import uptime_tasks
from sentry.taskworker.retry import Retry
from sentry.uptime.consumers.results_consumer import (
    create_backfill_misses,
    get_host_provider_if_valid,
    process_result_internal,
)
from sentry.uptime.models import UptimeSubscription, get_detector
from sentry.uptime.utils import (
    build_backlog_key,
    build_backlog_schedule_lock_key,
    build_backlog_task_scheduled_key,
    build_last_update_key,
    get_cluster,
)
from sentry.utils import json, metrics
from sentry.workflow_engine.models.detector import Detector

logger = logging.getLogger(__name__)

# 7 attempts over 180 seconds
BACKOFF_SCHEDULE = [10, 20, 30, 30, 30, 30, 30, 30, 30, 30, 30]


@instrumented_task(
    name="sentry.uptime.consumers.tasks.process_uptime_backlog",
    namespace=uptime_tasks,
    retry=Retry(times=3, delay=1, on=(Exception,)),
)
def process_uptime_backlog(subscription_id: str, attempt: int = 1):
    """
    Process buffered out-of-order results for a subscription.

    Attempts to process results in scheduled_check_time order. If gaps remain, reschedules with backoff.
    After max attempts, processes all results and allows normal backfill.
    """
    cluster = get_cluster()
    backlog_key = build_backlog_key(subscription_id)
    task_scheduled_key = build_backlog_task_scheduled_key(subscription_id)
    schedule_lock_key = build_backlog_schedule_lock_key(subscription_id)

    try:
        subscription = UptimeSubscription.objects.get(id=subscription_id)
        detector = get_detector(subscription, prefetch_workflow_data=True)
    except (UptimeSubscription.DoesNotExist, Detector.DoesNotExist):
        logger.warning(
            "uptime.backlog.subscription_not_found",
            extra={"subscription_id": subscription_id},
        )
        schedule_lock = locks.get(schedule_lock_key, duration=10, name="uptime.backlog.schedule")
        with schedule_lock.acquire():
            cluster.delete(backlog_key)
            cluster.delete(task_scheduled_key)
        return

    last_update_key = build_last_update_key(detector)
    last_update_ms = int(cluster.get(last_update_key) or 0)
    subscription_interval_ms = subscription.interval_seconds * 1000
    expected_next_ms = last_update_ms + subscription_interval_ms
    processed_count = 0
    queued_results_raw: list[tuple[bytes, float]] = cluster.zrange(
        backlog_key, 0, -1, withscores=True
    )
    host_provider = get_host_provider_if_valid(subscription)

    for result_json, scheduled_time_ms in queued_results_raw:
        if int(scheduled_time_ms) != expected_next_ms:
            logger.info(
                "uptime.backlog.gap_detected",
                extra={
                    "subscription_id": subscription_id,
                    "expected_ms": expected_next_ms,
                    "found_ms": int(scheduled_time_ms),
                },
            )
            break

        result = json.loads(result_json)
        metric_tags = {
            "status": result["status"],
            "uptime_region": result["region"],
            "host_provider": host_provider,
        }
        process_result_internal(
            detector,
            subscription,
            result,
            {**metric_tags},
            cluster,
        )
        cluster.zrem(backlog_key, result_json)
        metrics.incr("uptime.backlog.removed", amount=1, sample_rate=1.0, tags=metric_tags)
        expected_next_ms += subscription_interval_ms
        processed_count += 1

    # If we've hit max attempts process all remaining with backfill
    if attempt >= len(BACKOFF_SCHEDULE):
        logger.warning(
            "uptime.backlog.timeout",
            extra={
                "subscription_id": subscription_id,
                "attempt": attempt,
                "total_wait_seconds": sum(BACKOFF_SCHEDULE[: attempt - 1]),
            },
        )
        metrics.incr("uptime.backlog.timeout", amount=1, sample_rate=1.0)

        for result_json, _ in cluster.zrange(backlog_key, 0, -1, withscores=True):
            result = json.loads(result_json)
            metric_tags = {
                "status": result["status"],
                "uptime_region": result["region"],
                "host_provider": host_provider,
            }
            last_update_ms = int(cluster.get(last_update_key) or 0)
            create_backfill_misses(
                detector,
                subscription,
                result,
                last_update_ms,
                metric_tags,
                cluster,
            )
            process_result_internal(
                detector,
                subscription,
                result,
                metric_tags,
                cluster,
            )
            cluster.zrem(backlog_key, result_json)
            metrics.incr("uptime.backlog.removed", amount=1, sample_rate=1.0, tags=metric_tags)
            last_update_ms = result["scheduled_check_time_ms"]
            processed_count += 1

    schedule_lock = locks.get(schedule_lock_key, duration=10, name="uptime.backlog.schedule")
    with schedule_lock.acquire():
        remaining = cluster.zcard(backlog_key)

        if remaining == 0:
            # Queue cleared - clean up and exit
            cluster.delete(task_scheduled_key)
            logger.info(
                "uptime.backlog.cleared",
                extra={"subscription_id": subscription_id, "processed_count": processed_count},
            )
            metrics.incr("uptime.backlog.cleared", amount=1, sample_rate=1.0)
            return

        if processed_count > 0:
            next_attempt = 1
            logger.info(
                "uptime.backlog.progress_made",
                extra={
                    "subscription_id": subscription_id,
                    "processed_count": processed_count,
                    "remaining_items": remaining,
                },
            )
        else:
            # No progress - reschedule with backoff
            next_attempt = attempt + 1
            logger.info(
                "uptime.backlog.rescheduling",
                extra={
                    "subscription_id": subscription_id,
                    "attempt": attempt,
                    "next_attempt": next_attempt,
                    "remaining_items": remaining,
                },
            )
            metrics.incr("uptime.backlog.rescheduling", amount=1, sample_rate=1.0)

        next_backoff = BACKOFF_SCHEDULE[next_attempt - 1]
        remaining_time_seconds = sum(BACKOFF_SCHEDULE[next_attempt - 1 :]) + 60
        cluster.expire(task_scheduled_key, remaining_time_seconds)
        process_uptime_backlog.apply_async(
            args=[subscription_id], countdown=next_backoff, kwargs={"attempt": next_attempt}
        )
