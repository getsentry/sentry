from __future__ import annotations

import logging
import time
import uuid

from sentry import features
from sentry.locks import locks
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import uptime_tasks
from sentry.taskworker.retry import Retry
from sentry.uptime.consumers.results_consumer import (
    create_backfill_misses,
    create_uptime_response_capture,
    get_host_provider_if_valid,
    is_shadow_region_result,
    process_result_internal,
)
from sentry.uptime.models import (
    UptimeSubscription,
    get_detector,
    load_regions_for_uptime_subscription,
)
from sentry.uptime.subscriptions.subscriptions import (
    delete_uptime_subscription,
    disable_uptime_detector,
)
from sentry.uptime.subscriptions.tasks import send_uptime_config_deletion
from sentry.uptime.utils import (
    BACKFILL_DELAY_SECONDS,
    RESULT_DATA_TTL_SECONDS,
    build_backlog_key,
    build_backlog_schedule_lock_key,
    build_backlog_task_scheduled_key,
    build_incoming_key,
    build_last_update_key,
    build_pending_key,
    generate_scheduled_check_times_ms,
    get_cluster,
)
from sentry.utils import json, metrics
from sentry.workflow_engine.models.detector import Detector

logger = logging.getLogger(__name__)

MAX_SYNTHETIC_MISSED_CHECKS = 100

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
    subscription_regions = load_regions_for_uptime_subscription(subscription.id)

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
            subscription_regions,
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
                subscription_regions,
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


PENDING_RESULT_KEY = "__pending__"


def _drain_incoming(cluster, subscription_id: str) -> list[tuple[bytes, float]]:
    # Atomically drain all results from a subscription's incoming sorted set
    # using RENAME.
    incoming_key = build_incoming_key(subscription_id)
    temp_key = f"{incoming_key}:draining"
    try:
        cluster.rename(incoming_key, temp_key)
    except Exception:
        return []
    results: list[tuple[bytes, float]] = cluster.zrange(temp_key, 0, -1, withscores=True)
    cluster.delete(temp_key)
    return results


@instrumented_task(
    name="sentry.uptime.consumers.tasks.process_subscription",
    namespace=uptime_tasks,
    retry=Retry(times=3, delay=1, on=(Exception,)),
)
def process_subscription(subscription_id: str):
    from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
        CHECKSTATUS_DISALLOWED_BY_ROBOTS,
        CHECKSTATUS_FAILURE,
    )

    pending_key = build_pending_key(subscription_id)

    cluster = get_cluster()

    incoming_results = _drain_incoming(cluster, subscription_id)
    incoming_results = sorted(incoming_results, key=lambda r: r[1])

    try:
        subscription: UptimeSubscription = UptimeSubscription.objects.get_from_cache(
            subscription_id=subscription_id
        )
    except UptimeSubscription.DoesNotExist:
        first_result = json.loads(incoming_results[0][0])
        send_uptime_config_deletion(first_result["region"], subscription_id)
        metrics.incr("uptime.processor.subscription_not_found", sample_rate=1.0)
        return

    try:
        detector = get_detector(subscription, prefetch_workflow_data=True)
    except Detector.DoesNotExist:
        delete_uptime_subscription(subscription)
        metrics.incr("uptime.processor.detector_not_found", sample_rate=1.0)
        return

    if not detector.enabled:
        return

    organization = detector.project.organization
    if not features.has("organizations:uptime", organization):
        metrics.incr("uptime.processor.dropped_no_feature", sample_rate=1.0)
        return

    host_provider = get_host_provider_if_valid(subscription)
    subscription_regions = load_regions_for_uptime_subscription(subscription.id)
    subscription_interval_ms = subscription.interval_seconds * 1000

    last_update_key = build_last_update_key(detector)
    last_update_raw: str | None = cluster.get(last_update_key)
    last_update_ms = 0 if last_update_raw is None else int(last_update_raw)

    pending_to_store: list[tuple[bytes, float]] = []

    for i, (result_json, score) in enumerate(incoming_results):
        result = json.loads(result_json)
        metric_tags = {
            "status": result["status"],
            "uptime_region": result["region"],
            "host_provider": host_provider,
        }

        # Handle DISALLOWED_BY_ROBOTS: disable detector, drop everything
        if result["status"] == CHECKSTATUS_DISALLOWED_BY_ROBOTS:
            logger.info("uptime.processor.disallowed_by_robots", extra=result)
            metrics.incr(
                "uptime.processor.disallowed_by_robots",
                sample_rate=1.0,
                tags={"uptime_region": result.get("region", "default")},
            )
            disable_uptime_detector(detector)
            return

        # Skip shadow region results
        if is_shadow_region_result(result, subscription_regions):
            metrics.incr(
                "uptime.processor.dropped_shadow_result",
                sample_rate=1.0,
                tags=metric_tags,
            )
            continue

        # Dedup: skip if already processed
        if result["scheduled_check_time_ms"] <= last_update_ms:
            metrics.incr(
                "uptime.processor.skipping_already_processed",
                sample_rate=1.0,
                tags=metric_tags,
            )
            continue

        if last_update_ms > 0:
            expected_next_ms = last_update_ms + subscription_interval_ms
            if result["scheduled_check_time_ms"] != expected_next_ms:
                # This is out of expected order--add it to the pending set
                process_subscription_pending.apply_async(
                    args=[subscription_id],
                    countdown=BACKFILL_DELAY_SECONDS,
                )
                pending_to_store.append((result_json, score))
                metrics.incr(
                    "uptime.processor.gap_detected",
                    sample_rate=1.0,
                    tags=metric_tags,
                )
                logger.info(
                    "uptime.processor.gap_detected",
                    extra={
                        "subscription_id": subscription_id,
                        "expected_ms": expected_next_ms,
                        "found_ms": result["scheduled_check_time_ms"],
                    },
                )
                # No matter what, stop processing this check, and move on to the next one.
                continue

        # If we got here, this is a valid and timely check.  Process it.

        if result["status"] == CHECKSTATUS_FAILURE and features.has(
            "organizations:uptime-response-capture", organization
        ):
            create_uptime_response_capture(subscription, result)

        process_result_internal(
            detector,
            subscription,
            result,
            metric_tags.copy(),
            cluster,
            subscription_regions,
        )

        # Update local tracking so consecutive results chain correctly
        last_update_ms = result["scheduled_check_time_ms"]

    # Update pending, and adding newly-pending results
    if pending_to_store:
        pipeline = cluster.pipeline()

        for result_json, score in pending_to_store:
            pipeline.zadd(pending_key, {result_json: score})

        pipeline.expire(pending_key, RESULT_DATA_TTL_SECONDS)

        pipeline.execute()


@instrumented_task(
    name="sentry.uptime.consumers.tasks.process_subscription_pending",
    namespace=uptime_tasks,
    retry=Retry(times=3, delay=1, on=(Exception,)),
)
def process_subscription_pending(subscription_id: str):
    from sentry_kafka_schemas.schema_types.uptime_results_v1 import CHECKSTATUS_MISSED_WINDOW

    cluster = get_cluster()
    pending_key = build_pending_key(subscription_id)
    incoming_key = build_incoming_key(subscription_id)

    results: list[tuple[bytes, float]] = cluster.zrange(pending_key, 0, -1, withscores=True)
    if not results:
        return

    try:
        subscription: UptimeSubscription = UptimeSubscription.objects.get_from_cache(
            subscription_id=subscription_id
        )
        detector = get_detector(subscription, prefetch_workflow_data=True)
    except (UptimeSubscription.DoesNotExist, Detector.DoesNotExist):
        cluster.delete(pending_key)
        return

    if not detector.enabled:
        return

    organization = detector.project.organization
    if not features.has("organizations:uptime", organization):
        return

    last_update_key = build_last_update_key(detector)
    last_update_raw: str | None = cluster.get(last_update_key)
    last_update_ms = 0 if last_update_raw is None else int(last_update_raw)
    if last_update_ms <= 0:
        return
    subscription_interval_ms = subscription.interval_seconds * 1000

    host_provider = get_host_provider_if_valid(subscription)
    now_ms = int(time.time() * 1000)

    to_add: list[tuple[bytes, float]] = []
    to_remove: list[tuple[bytes, float]] = []

    for result_json, _ in results:
        result = json.loads(result_json)

        # If the result has already been processed, skip (we are racing with the processor,
        # so this can happen.)
        if result["scheduled_check_time_ms"] <= last_update_ms:
            continue

        expected_next_ms = last_update_ms + subscription_interval_ms

        if result["scheduled_check_time_ms"] == expected_next_ms:
            # We've encountered a now-valid result, move it from pending to incoming,
            # so that the incoming processor can handle it.
            last_update_ms = expected_next_ms
            to_add.append((result_json, result["scheduled_check_time_ms"]))
            to_remove.append((result_json, result["scheduled_check_time_ms"]))
            continue

        # There's a gap between last_update_ms and this result.
        check_until_ms = expected_next_ms + (BACKFILL_DELAY_SECONDS * 1000)

        if now_ms < check_until_ms:
            # Gap hasn't expired yet; another backfill task will check this
            break

        # Gap has expired — create synthetic misses
        metric_tags = {
            "status": result["status"],
            "uptime_region": result["region"],
            "host_provider": host_provider,
        }
        num_missed = min(
            MAX_SYNTHETIC_MISSED_CHECKS,
            int(
                (result["scheduled_check_time_ms"] - last_update_ms) / subscription_interval_ms - 1
            ),
        )
        if num_missed > 0:
            # Add synthetic misses + result to incoming; they can be processed now.
            missed_times = generate_scheduled_check_times_ms(
                last_update_ms + subscription_interval_ms,
                subscription_interval_ms,
                num_missed,
            )
            for scheduled_time_ms in missed_times:
                missed_result = {
                    "guid": uuid.uuid4().hex,
                    "subscription_id": subscription_id,
                    "status": CHECKSTATUS_MISSED_WINDOW,
                    "status_reason": {
                        "type": "miss_backfill",
                        "description": "Miss was never reported for this scheduled check_time",
                    },
                    "trace_id": uuid.uuid4().hex,
                    "span_id": uuid.uuid4().hex,
                    "region": result["region"],
                    "scheduled_check_time_ms": scheduled_time_ms,
                    "actual_check_time_ms": result["actual_check_time_ms"],
                    "duration_ms": 0,
                    "request_info": None,
                    "assertion_failure_data": None,
                }
                to_add.append((json.dumps(missed_result), scheduled_time_ms))

            # Move the provoking result from pending to incoming, as well
            to_add.append((result_json, result["scheduled_check_time_ms"]))
            to_remove.append((result_json, result["scheduled_check_time_ms"]))

            # Because we have generated results, push our last_update_ms forward, in case
            # we can continue checking results
            last_update_ms = expected_next_ms
            metrics.incr(
                "uptime.backfill.misses_created",
                amount=num_missed,
                sample_rate=1.0,
                tags=metric_tags,
            )

    if to_add:
        incoming_pipeline = cluster.pipeline()
        for result_json, scheduled_check_time_ms in to_add:
            incoming_pipeline.zadd(incoming_key, {result_json: scheduled_check_time_ms})

        incoming_pipeline.expire(incoming_key, RESULT_DATA_TTL_SECONDS)
        incoming_pipeline.execute()

    if to_remove:
        pending_pipeline = cluster.pipeline()
        for result_json, scheduled_check_time_ms in to_remove:
            pending_pipeline.zrem(pending_key, {result_json: scheduled_check_time_ms})

        pending_pipeline.expire(pending_key, RESULT_DATA_TTL_SECONDS)
        pending_pipeline.execute()

    if to_remove or to_add:
        # Spawn a processor task — it will drain pending and process the
        # synthetic misses followed by the original gap-blocked results.
        process_subscription.delay(subscription_id)
