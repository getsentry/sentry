from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Collection
from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.utils import timezone
from taskbroker_client.retry import Retry

from sentry import audit_log
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import uptime_tasks
from sentry.uptime.config_drift import check_config_drift
from sentry.uptime.config_producer import produce_config, produce_config_removal
from sentry.uptime.models import (
    UptimeRegionScheduleMode,
    UptimeSubscription,
    UptimeSubscriptionRegion,
)
from sentry.uptime.subscriptions.regions import get_region_config
from sentry.uptime.types import CheckConfig
from sentry.utils import metrics
from sentry.utils.audit import create_system_audit_entry
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)


SUBSCRIPTION_STATUS_MAX_AGE = timedelta(minutes=10)
BROKEN_MONITOR_AGE_LIMIT = timedelta(days=7)
# After a wiped cluster the missing set is the whole cluster, so bound the tasks one run can queue.
CONFIG_REPAIR_MAX_TASKS = 1000


@instrumented_task(
    name="sentry.uptime.subscriptions.tasks.create_uptime_subscription",
    namespace=uptime_tasks,
    retry=Retry(times=5, delay=5),
)
def create_remote_uptime_subscription(uptime_subscription_id, **kwargs):
    try:
        subscription = UptimeSubscription.objects.get(id=uptime_subscription_id)
    except UptimeSubscription.DoesNotExist:
        metrics.incr("uptime.subscriptions.create.subscription_does_not_exist", sample_rate=1.0)
        return

    # May happen if a uptime subscription was created and then immediately disabled
    if subscription.status != UptimeSubscription.Status.CREATING.value:
        metrics.incr("uptime.subscriptions.create.incorrect_status", sample_rate=1.0)
        return

    for region in subscription.regions.all():
        send_uptime_subscription_config(region, subscription)
    subscription.update(
        status=UptimeSubscription.Status.ACTIVE.value,
        subscription_id=subscription.subscription_id,
    )


@instrumented_task(
    name="sentry.uptime.subscriptions.tasks.update_remote_uptime_subscription",
    namespace=uptime_tasks,
    retry=Retry(times=5, delay=5),
)
def update_remote_uptime_subscription(
    uptime_subscription_id, region_slugs: list[str] | None = None, **kwargs
):
    """
    Pushes details of an uptime subscription to uptime subscription regions. When
    ``region_slugs`` is given, only those regions are pushed to.
    """
    if region_slugs is not None:
        unknown = [slug for slug in region_slugs if get_region_config(slug) is None]
        if unknown or not region_slugs:
            # An empty filter would silently publish nothing, and _send_to_redis only logs and
            # skips an unknown slug, so reject both up front.
            logger.error(
                "uptime.subscriptions.update_remote_uptime_subscription.invalid_region_filter",
                extra={
                    "uptime_subscription_id": uptime_subscription_id,
                    "region_slugs": region_slugs,
                    "unknown": unknown,
                },
            )
            metrics.incr("uptime.subscriptions.update.invalid_region_filter", sample_rate=1.0)
            return
    try:
        subscription = UptimeSubscription.objects.get(id=uptime_subscription_id)
    except UptimeSubscription.DoesNotExist:
        metrics.incr("uptime.subscriptions.update.subscription_does_not_exist", sample_rate=1.0)
        return
    if subscription.status not in [
        UptimeSubscription.Status.UPDATING.value,
        UptimeSubscription.Status.ACTIVE.value,
    ]:
        logger.info(
            "uptime.subscriptions.update_remote_uptime_subscription.incorrect_status",
            extra={
                "subscription_id": subscription.subscription_id,
                "subscription_status": subscription.status,
            },
        )
        metrics.incr("uptime.subscriptions.update.incorrect_status", sample_rate=1.0)
        return

    regions = subscription.regions.all()
    if region_slugs is not None:
        regions = regions.filter(region_slug__in=region_slugs)
    for region in regions:
        send_uptime_subscription_config(region, subscription)
    # A filtered publish is a repair, not a state transition: leave a concurrent edit's
    # UPDATING for its own task (or subscription_checker) to finish.
    status = (
        subscription.status if region_slugs is not None else UptimeSubscription.Status.ACTIVE.value
    )
    subscription.update(status=status, subscription_id=subscription.subscription_id)


@instrumented_task(
    name="sentry.uptime.subscriptions.tasks.delete_uptime_subscription",
    namespace=uptime_tasks,
    retry=Retry(times=5, delay=5),
)
def delete_remote_uptime_subscription(uptime_subscription_id, **kwargs):
    try:
        subscription = UptimeSubscription.objects.get(id=uptime_subscription_id)
    except UptimeSubscription.DoesNotExist:
        metrics.incr("uptime.subscriptions.delete.subscription_does_not_exist", sample_rate=1.0)
        return

    if subscription.status not in [
        UptimeSubscription.Status.DELETING.value,
        UptimeSubscription.Status.DISABLED.value,
    ]:
        metrics.incr("uptime.subscriptions.delete.incorrect_status", sample_rate=1.0)
        return

    region_slugs = [s.region_slug for s in subscription.regions.all()]

    subscription_id = subscription.subscription_id
    if subscription.status == UptimeSubscription.Status.DELETING.value:
        subscription.delete()

    if subscription_id is not None:
        for region_slug in region_slugs:
            send_uptime_config_deletion(region_slug, subscription_id)


def send_uptime_subscription_config(
    region: UptimeSubscriptionRegion, subscription: UptimeSubscription
):
    if subscription.subscription_id is None:
        subscription.subscription_id = uuid4().hex
    produce_config(
        region.region_slug,
        uptime_subscription_to_check_config(
            subscription,
            subscription.subscription_id,
            UptimeSubscriptionRegion.RegionMode(region.mode),
        ),
    )


def uptime_subscription_to_check_config(
    subscription: UptimeSubscription,
    subscription_id: str,
    region_mode: UptimeSubscriptionRegion.RegionMode,
) -> CheckConfig:
    config: CheckConfig = {
        "subscription_id": subscription_id,
        "url": subscription.url,
        "interval_seconds": subscription.interval_seconds,
        "timeout_ms": subscription.timeout_ms,
        "request_method": subscription.method,
        "request_headers": subscription.headers,
        "trace_sampling": subscription.trace_sampling,
        "capture_response_on_failure": subscription.capture_response_on_failure,
        "active_regions": [r.region_slug for r in subscription.regions.filter(mode=region_mode)],
        "region_schedule_mode": UptimeRegionScheduleMode.ROUND_ROBIN.value,
        "assertion": subscription.assertion,
    }
    if subscription.body is not None:
        config["request_body"] = subscription.body
    return config


def send_uptime_config_deletion(destination_region_slug: str, subscription_id: str) -> None:
    produce_config_removal(destination_region_slug, subscription_id)


@instrumented_task(
    name="sentry.uptime.tasks.subscription_checker",
    namespace=uptime_tasks,
)
def subscription_checker(**kwargs):
    """
    Checks for subscriptions stuck in a transition status and attempts to repair them. This
    typically happens when we had some kind of error running the task the first time around.
    Usually network or configuration related.
    """
    count = 0
    for subscription in UptimeSubscription.objects.filter(
        status__in=(
            UptimeSubscription.Status.CREATING.value,
            UptimeSubscription.Status.UPDATING.value,
            UptimeSubscription.Status.DELETING.value,
        ),
        date_updated__lt=timezone.now() - SUBSCRIPTION_STATUS_MAX_AGE,
    ):
        count += 1
        if subscription.status == UptimeSubscription.Status.CREATING.value:
            create_remote_uptime_subscription.delay(uptime_subscription_id=subscription.id)
        elif subscription.status == UptimeSubscription.Status.UPDATING.value:
            update_remote_uptime_subscription.delay(uptime_subscription_id=subscription.id)
        elif subscription.status == UptimeSubscription.Status.DELETING.value:
            delete_remote_uptime_subscription.delay(uptime_subscription_id=subscription.id)

    metrics.incr("uptime.subscriptions.repair", amount=count, sample_rate=1.0)


@instrumented_task(
    name="sentry.uptime.tasks.broken_monitor_checker",
    namespace=uptime_tasks,
)
def broken_monitor_checker(**kwargs):
    """
    This checks for auto created uptime monitors that have been broken for a long time and disables them.
    """
    from sentry.uptime.subscriptions.subscriptions import disable_uptime_detector
    from sentry.uptime.types import GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE, UptimeMonitorMode
    from sentry.workflow_engine.models.detector_state import DetectorState
    from sentry.workflow_engine.types import DetectorPriorityLevel

    count = 0
    queryset = DetectorState.objects.filter(
        state=DetectorPriorityLevel.HIGH,
        date_updated__lt=timezone.now() - BROKEN_MONITOR_AGE_LIMIT,
        detector__type=GROUP_TYPE_UPTIME_DOMAIN_CHECK_FAILURE,
        detector__config__mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
        detector__enabled=True,
    ).select_related("detector", "detector__project__organization")

    for detector_state in RangeQuerySetWrapper(queryset):
        detector = detector_state.detector
        try:
            disable_uptime_detector(detector)

            create_system_audit_entry(
                organization=detector.linked_project.organization,
                target_object=detector.id,
                event=audit_log.get_event_id("UPTIME_MONITOR_DISABLE_BROKEN"),
                data={
                    "date_updated": str(detector_state.date_updated),
                    "id": detector.id,
                    "name": detector.name,
                },
            )

            count += 1
        except Exception:
            logger.exception("uptime.subscriptions.disable_broken_failed")

    metrics.incr("uptime.subscriptions.disable_broken", amount=count, sample_rate=1.0)


@instrumented_task(
    name="sentry.uptime.tasks.config_drift_checker",
    namespace=uptime_tasks,
    # Walks the whole region table, so the 10s default deadline is too short.
    processing_deadline_duration=60 * 10,
)
def config_drift_checker(**kwargs):
    """
    Compares the checker configs stored in each config redis cluster against Postgres and
    reports the difference as metrics. This task only reads; repairs happen elsewhere.
    """
    for reading in check_config_drift():
        tags = {"cluster": reading.store.cluster}
        metrics.gauge(
            "uptime.config_drift.missing", len(reading.missing), tags=tags, sample_rate=1.0
        )
        metrics.gauge(
            "uptime.config_drift.orphaned", len(reading.orphaned), tags=tags, sample_rate=1.0
        )
        metrics.gauge(
            "uptime.config_drift.null_subscription_id",
            reading.null_subscription_ids,
            tags=tags,
            sample_rate=1.0,
        )
        logger.info(
            "uptime.config_drift.reading",
            extra={
                "cluster": reading.store.cluster,
                "expected": reading.expected,
                "stored": reading.stored,
                "missing": len(reading.missing),
                "orphaned": len(reading.orphaned),
                "null_subscription_ids": reading.null_subscription_ids,
            },
        )


def repair_missing_configs(
    missing: Collection[tuple[str, str]],
    *,
    limit: int = CONFIG_REPAIR_MAX_TASKS,
    dry_run: bool = False,
) -> int:
    """
    Queues a region-scoped update for each missing (subscription_id, cluster) pair, at most
    ``limit`` per call. Returns the number queued (or reported, in dry run).
    """
    if limit < 0:
        raise ValueError(f"limit must be non-negative, got {limit}")
    slugs_by_cluster: dict[str, set[str]] = defaultdict(set)
    for region in settings.UPTIME_REGIONS:
        slugs_by_cluster[region.config_redis_cluster].add(region.slug)
    unknown = {cluster for _, cluster in missing} - slugs_by_cluster.keys()
    if unknown:
        raise ValueError(f"Unknown config redis clusters: {sorted(unknown)}")

    pairs = sorted(set(missing))[:limit]
    pk_by_subscription_id: dict[str, int] = {}
    slugs_by_subscription_id: dict[str, set[str]] = defaultdict(set)
    for subscription_id, pk, region_slug in UptimeSubscriptionRegion.objects.filter(
        uptime_subscription__subscription_id__in={sid for sid, _ in pairs}
    ).values_list("uptime_subscription__subscription_id", "uptime_subscription_id", "region_slug"):
        assert subscription_id is not None
        pk_by_subscription_id[subscription_id] = pk
        slugs_by_subscription_id[subscription_id].add(region_slug)

    queued = 0
    for subscription_id, cluster in pairs:
        region_slugs = sorted(slugs_by_subscription_id[subscription_id] & slugs_by_cluster[cluster])
        if not region_slugs:
            # Deleted, or no longer on this cluster, since the diff was taken.
            metrics.incr("uptime.config_repair.skipped", tags={"cluster": cluster}, sample_rate=1.0)
            continue
        if not dry_run:
            update_remote_uptime_subscription.delay(
                uptime_subscription_id=pk_by_subscription_id[subscription_id],
                region_slugs=region_slugs,
            )
            metrics.incr("uptime.config_repair.queued", tags={"cluster": cluster}, sample_rate=1.0)
        queued += 1
        logger.info(
            "uptime.config_repair.queued",
            extra={
                "subscription_id": subscription_id,
                "cluster": cluster,
                "region_slugs": region_slugs,
                "dry_run": dry_run,
            },
        )
    return queued
