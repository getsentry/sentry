from __future__ import annotations

import logging
from collections import defaultdict
from collections.abc import Collection
from datetime import timedelta
from uuid import uuid4

from django.conf import settings
from django.utils import timezone
from taskbroker_client.retry import Retry
from taskbroker_client.worker.workerchild import ProcessingDeadlineExceeded

from sentry import audit_log, options
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import uptime_tasks
from sentry.uptime.config_drift import (
    SUBSCRIPTION_ID_PREFIX_BUCKETS,
    SWEEP_RUN_INTERVAL,
    ConfigStore,
    find_missing_configs,
    find_orphaned_configs,
    get_config_stores,
    sweep_slice,
)
from sentry.uptime.config_producer import produce_config, produce_config_removal
from sentry.uptime.models import (
    UptimeRegionScheduleMode,
    UptimeSubscription,
    UptimeSubscriptionRegion,
)
from sentry.uptime.types import CheckConfig
from sentry.utils import metrics
from sentry.utils.audit import create_system_audit_entry
from sentry.utils.query import RangeQuerySetWrapper

logger = logging.getLogger(__name__)


SUBSCRIPTION_STATUS_MAX_AGE = timedelta(minutes=10)
BROKEN_MONITOR_AGE_LIMIT = timedelta(days=7)
# After a wiped store the missing set is the whole slice, so bound the tasks queued per store.
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
    # A filtered publish is a repair, not a state transition, so it leaves the row alone.
    if region_slugs is None:
        subscription.update(
            status=UptimeSubscription.Status.ACTIVE.value,
            subscription_id=subscription.subscription_id,
        )


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
    name="sentry.uptime.tasks.config_drift_dispatcher",
    namespace=uptime_tasks,
    processing_deadline_duration=60,
)
def config_drift_dispatcher(**kwargs):
    """
    Fans out this hour's slice of the Redis/Postgres config drift sweep; see sweep_slice for
    how a slice is chosen.
    """
    if not options.get("uptime.config-drift.enabled"):
        return

    cycle_hours = options.get("uptime.config-drift.cycle-hours")
    now = timezone.now()
    stores = get_config_stores()

    # One task per (prefix, store) so a failing store doesn't take the others down with it.
    for bucket in sweep_slice(SUBSCRIPTION_ID_PREFIX_BUCKETS, cycle_hours, now):
        for store in stores:
            check_missing_configs.delay(
                subscription_id_prefix=f"{bucket:02x}",
                cluster=store.cluster,
                key_prefix=store.key_prefix,
            )

    partitions = sweep_slice(settings.UPTIME_CONFIG_PARTITIONS, cycle_hours, now)
    for store in stores:
        for partition in partitions:
            check_orphaned_configs.delay(
                cluster=store.cluster, key_prefix=store.key_prefix, partition=partition
            )


def _find_store(cluster: str, key_prefix: str) -> ConfigStore | None:
    stores = get_config_stores()
    store = next((s for s in stores if (s.cluster, s.key_prefix) == (cluster, key_prefix)), None)
    if store is None:
        logger.warning(
            "uptime.config_drift.unknown_store",
            extra={"cluster": cluster, "key_prefix": key_prefix},
        )
    return store


@instrumented_task(
    name="sentry.uptime.tasks.check_missing_configs",
    namespace=uptime_tasks,
    processing_deadline_duration=60,
    expires=SWEEP_RUN_INTERVAL,
    retry=Retry(times=3, delay=120, on=(Exception, ProcessingDeadlineExceeded)),
)
def check_missing_configs(subscription_id_prefix: str, cluster: str, key_prefix: str, **kwargs):
    """
    Postgres → Redis direction of the drift sweep: for ACTIVE subscriptions in this
    subscription_id prefix, count those whose config is absent from one store, and
    republish them when repair is on.
    """
    store = _find_store(cluster, key_prefix)
    if store is None:
        return

    result = find_missing_configs(store, subscription_id_prefix)
    missing = len(result.drifted_ids)
    tags = {"cluster": store.cluster, "direction": "missing"}
    metrics.incr("uptime.config_drift.checked", amount=result.checked, tags=tags, sample_rate=1.0)
    metrics.incr("uptime.config_drift.missing", amount=missing, tags=tags, sample_rate=1.0)
    if missing:
        logger.warning(
            "uptime.config_drift.missing",
            extra={
                "subscription_id_prefix": subscription_id_prefix,
                "cluster": store.cluster,
                "count": missing,
            },
        )
        if options.get("uptime.config-drift.repair"):
            repair_missing_configs(store, result.drifted_ids)


@instrumented_task(
    name="sentry.uptime.tasks.check_orphaned_configs",
    namespace=uptime_tasks,
    processing_deadline_duration=60,
    expires=SWEEP_RUN_INTERVAL,
    retry=Retry(times=3, delay=120, on=(Exception, ProcessingDeadlineExceeded)),
)
def check_orphaned_configs(cluster: str, key_prefix: str, partition: int, **kwargs):
    """
    Redis → Postgres direction of the drift sweep: for one config partition in one store,
    count configs that no ACTIVE, CREATING or UPDATING subscription owns in a region served
    by that store.
    """
    store = _find_store(cluster, key_prefix)
    if store is None:
        return

    result = find_orphaned_configs(store, partition)
    orphaned = len(result.drifted_ids)
    tags = {"cluster": store.cluster, "direction": "orphaned"}
    metrics.incr("uptime.config_drift.checked", amount=result.checked, tags=tags, sample_rate=1.0)
    metrics.incr("uptime.config_drift.orphaned", amount=orphaned, tags=tags, sample_rate=1.0)
    if orphaned:
        logger.warning(
            "uptime.config_drift.orphaned",
            extra={"partition": partition, "cluster": store.cluster, "count": orphaned},
        )


def repair_missing_configs(
    store: ConfigStore, subscription_ids: Collection[str], *, limit: int = CONFIG_REPAIR_MAX_TASKS
) -> int:
    """
    Queues a region-scoped update for each subscription whose config is missing from ``store``,
    at most ``limit`` per call. Returns the number queued.
    """
    ids = sorted(set(subscription_ids))[:limit]
    slugs_by_subscription: dict[tuple[int, str], set[str]] = defaultdict(set)
    for subscription_id, pk, region_slug in UptimeSubscriptionRegion.objects.filter(
        uptime_subscription__subscription_id__in=ids,
        uptime_subscription__status=UptimeSubscription.Status.ACTIVE.value,
        region_slug__in=store.region_slugs,
    ).values_list("uptime_subscription__subscription_id", "uptime_subscription_id", "region_slug"):
        assert subscription_id is not None
        slugs_by_subscription[(pk, subscription_id)].add(region_slug)

    for (pk, subscription_id), slugs in slugs_by_subscription.items():
        region_slugs = sorted(slugs)
        update_remote_uptime_subscription.delay(
            uptime_subscription_id=pk, region_slugs=region_slugs
        )
        logger.info(
            "uptime.config_repair.queued",
            extra={
                "subscription_id": subscription_id,
                "cluster": store.cluster,
                "region_slugs": region_slugs,
            },
        )
    queued = len(slugs_by_subscription)
    tags = {"cluster": store.cluster}
    metrics.incr("uptime.config_repair.queued", amount=queued, tags=tags, sample_rate=1.0)
    # Skipped: deleted, disabled, or no longer on this store, since the sweep read it.
    metrics.incr(
        "uptime.config_repair.skipped", amount=len(ids) - queued, tags=tags, sample_rate=1.0
    )
    return queued
