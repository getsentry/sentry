from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_DISALLOWED_BY_ROBOTS,
    CHECKSTATUS_MISSED_WINDOW,
    CheckResult,
)

from sentry import features
from sentry.conf.types.kafka_definition import Topic
from sentry.locks import locks
from sentry.remote_subscriptions.consumers.result_consumer import (
    ResultProcessor,
    ResultsStrategyFactory,
)
from sentry.uptime.autodetect.result_handler import handle_onboarding_result
from sentry.uptime.consumers.eap_producer import produce_eap_uptime_result
from sentry.uptime.grouptype import UptimePacketValue
from sentry.uptime.models import (
    UptimeSubscription,
    UptimeSubscriptionRegion,
    get_detector,
    get_top_hosting_provider_names,
    load_regions_for_uptime_subscription,
)
from sentry.uptime.subscriptions.subscriptions import (
    check_and_update_regions,
    delete_uptime_subscription,
    disable_uptime_detector,
)
from sentry.uptime.subscriptions.tasks import (
    send_uptime_config_deletion,
    update_remote_uptime_subscription,
)
from sentry.uptime.types import UptimeMonitorMode
from sentry.uptime.utils import (
    build_backlog_key,
    build_backlog_schedule_lock_key,
    build_backlog_task_scheduled_key,
    build_last_seen_interval_key,
    build_last_update_key,
    get_cluster,
)
from sentry.utils import json, metrics
from sentry.utils.locking import UnableToAcquireLock
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.processors.detector import process_detectors

logger = logging.getLogger(__name__)

LAST_UPDATE_REDIS_TTL = timedelta(days=7)

# The TTL of the redis key used to track consecutive statuses. We need this to be longer than the longest interval we
# support, so that the key doesn't expire between checks. We add an extra hour to account for any backlogs in
# processing.
ACTIVE_THRESHOLD_REDIS_TTL = timedelta(seconds=max(UptimeSubscription.IntervalSeconds)) + timedelta(
    minutes=60
)

# We want to limit cardinality for provider tags. This controls how many tags we should include
TOTAL_PROVIDERS_TO_INCLUDE_AS_TAGS = 30

# The maximum number of missed checks we backfill, upon noticing a gap in our expected check results
MAX_SYNTHETIC_MISSED_CHECKS = 100


def get_host_provider_if_valid(subscription: UptimeSubscription) -> str:
    if subscription.host_provider_name in get_top_hosting_provider_names(
        TOTAL_PROVIDERS_TO_INCLUDE_AS_TAGS
    ):
        return subscription.host_provider_name
    return "other"


def should_run_region_checks(subscription: UptimeSubscription, result: CheckResult) -> bool:
    """
    Probabilistically determine whether we should run region checks. This is set up so that the check is performed
    roughly once an hour for each uptime monitor.
    """
    if not subscription.subscription_id:
        # Edge case where we can have no subscription_id here
        return False

    # XXX: Randomly check for updates once an hour - this is a hack to fix a bug where we're seeing some checks
    # not update correctly.
    chance_to_run = subscription.interval_seconds / timedelta(hours=1).total_seconds()
    if random.random() < chance_to_run:
        return True

    # Run region checks and updates once an hour
    runs_per_hour = UptimeSubscription.IntervalSeconds.ONE_HOUR / subscription.interval_seconds
    subscription_run = UUID(subscription.subscription_id).int % runs_per_hour
    current_run = (
        datetime.fromtimestamp(result["scheduled_check_time_ms"] / 1000, timezone.utc).minute * 60
    ) // subscription.interval_seconds
    if subscription_run == current_run:
        return True

    return False


def try_check_and_update_regions(
    subscription: UptimeSubscription, regions: list[UptimeSubscriptionRegion]
):
    """
    This method will check if regions have been added or removed from our region configuration,
    and updates regions associated with this uptime monitor to reflect the new state.
    """
    if not check_and_update_regions(subscription, regions):
        return

    # Regardless of whether we added or removed regions, we need to send an updated config to all active
    # regions for this subscription so that they all get an update set of currently active regions.
    subscription.update(status=UptimeSubscription.Status.UPDATING.value)
    update_remote_uptime_subscription.delay(subscription.id)


def is_shadow_region_result(result: CheckResult, regions: list[UptimeSubscriptionRegion]) -> bool:
    shadow_region_slugs = {
        region.region_slug
        for region in regions
        if region.mode == UptimeSubscriptionRegion.RegionMode.SHADOW
    }
    return result["region"] in shadow_region_slugs


def record_check_completion_metrics(result: CheckResult, metric_tags: dict[str, str]) -> None:
    """
    Records the amount of time it took for a check result to get from the
    checker to this consumer and be processed
    """
    actual_check_time = result["actual_check_time_ms"]
    duration = result["duration_ms"] if result["duration_ms"] else 0
    completion_time = (datetime.now().timestamp() * 1000) - (actual_check_time + duration)

    metrics.distribution(
        "uptime.result_processor.check_completion_time",
        completion_time,
        sample_rate=1.0,
        unit="millisecond",
        tags=metric_tags,
    )


def record_check_metrics(
    result: CheckResult,
    detector: Detector,
    metric_tags: dict[str, str],
) -> None:
    """
    Records
    """
    if result["status"] == CHECKSTATUS_MISSED_WINDOW:
        logger.info(
            "handle_result_for_project.missed",
            extra={"project_id": detector.project_id, **result},
        )
        # Do not log other metrics for missed_window results, this was a
        # synthetic result
        return

    if result["duration_ms"]:
        metrics.distribution(
            "uptime.result_processor.check_result.duration",
            result["duration_ms"],
            sample_rate=1.0,
            unit="millisecond",
            tags=metric_tags,
        )
    metrics.distribution(
        "uptime.result_processor.check_result.delay",
        result["actual_check_time_ms"] - result["scheduled_check_time_ms"],
        sample_rate=1.0,
        unit="millisecond",
        tags=metric_tags,
    )


def create_backfill_misses(
    detector: Detector,
    subscription: UptimeSubscription,
    result: CheckResult,
    last_update_ms: int,
    metric_tags: dict[str, str],
    cluster,
) -> None:
    """
    Create synthetic missed check results for gaps in the check timeline.

    When a result arrives with a gap (2+ intervals since last update), this
    function creates backfill misses for the intervening time periods, unless
    the subscription interval was recently changed.
    """
    subscription_interval_ms = 1000 * subscription.interval_seconds
    num_intervals = (result["scheduled_check_time_ms"] - last_update_ms) / subscription_interval_ms

    # If the scheduled check is two or more intervals since the last seen check, we can declare the
    # intervening checks missed...
    if num_intervals > 1:
        # ... but it might be the case that the user changed the frequency of the detector.  So, first
        # verify that the interval in postgres is the same as the last-seen interval (in redis).
        # We only store in redis when we encounter a difference like this, which means we won't be able
        # to tell if a missed check is real with the very first missed check.  This is probably okay,
        # and preferable to just writing the interval to redis on every check consumed.
        last_interval_key = build_last_seen_interval_key(detector)

        # If we've never set an interval before, just set this to zero, which will never compare
        # true with any valid interval.
        last_interval_seen: str = cluster.get(last_interval_key) or "0"

        if int(last_interval_seen) == subscription_interval_ms:
            # Bound the number of missed checks we generate--just in case.
            num_missed_checks = min(MAX_SYNTHETIC_MISSED_CHECKS, int(num_intervals - 1))

            metrics.distribution(
                "uptime.result_processer.num_missing_check",
                num_missed_checks,
                tags=metric_tags,
            )
            logger.info(
                "uptime.result_processor.num_missing_check",
                extra={"num_missed_checks": num_missed_checks, **result},
            )
            if num_intervals != int(num_intervals):
                logger.info(
                    "uptime.result_processor.invalid_check_interval",
                    0,
                    extra={
                        "last_update_ms": last_update_ms,
                        "current_update_ms": result["scheduled_check_time_ms"],
                        "interval_ms": subscription_interval_ms,
                        **result,
                    },
                )

            synthetic_metric_tags = metric_tags.copy()
            synthetic_metric_tags["status"] = CHECKSTATUS_MISSED_WINDOW
            for i in range(0, num_missed_checks):
                missed_result: CheckResult = {
                    "guid": uuid.uuid4().hex,
                    "subscription_id": result["subscription_id"],
                    "status": CHECKSTATUS_MISSED_WINDOW,
                    "status_reason": {
                        "type": "miss_backfill",
                        "description": "Miss was never reported for this scheduled check_time",
                    },
                    "trace_id": uuid.uuid4().hex,
                    "span_id": uuid.uuid4().hex,
                    "region": result["region"],
                    "scheduled_check_time_ms": last_update_ms
                    + ((i + 1) * subscription_interval_ms),
                    "actual_check_time_ms": result["actual_check_time_ms"],
                    "duration_ms": 0,
                    "request_info": None,
                }
                produce_eap_uptime_result(
                    detector,
                    missed_result,
                    synthetic_metric_tags.copy(),
                )
        else:
            logger.info(
                "uptime.result_processor.false_num_missing_check",
                extra={**result},
            )
            cluster.set(last_interval_key, subscription_interval_ms, ex=LAST_UPDATE_REDIS_TTL)


def process_result_internal(
    detector: Detector,
    uptime_subscription: UptimeSubscription,
    result: CheckResult,
    metric_tags: dict[str, str],
    cluster,
) -> None:
    """
    Core result processing logic shared by main consumer and retry task.

    Does NOT include: dedup check, backfill detection, queue check.
    Contains: metrics, mode handling, EAP production, state updates.
    """
    mode_name = UptimeMonitorMode(detector.config["mode"]).name.lower()

    # We log the result stats here after the duplicate check so that we
    # know the "true" duration and delay of each check. Since during
    # deploys we might have checks run from both the old/new checker
    # deployments, there will be overlap of when things run. The new
    # deployment will have artificially inflated delay stats, since it may
    # duplicate checks that already ran on time on the old deployment, but
    # will have run them later.
    #
    # Since we process all results for a given uptime monitor in order, we
    # can guarantee that we get the earliest delay stat for each scheduled
    # check for the monitor here, and so this stat will be a more accurate
    # measurement of delay/duration.
    record_check_metrics(result, detector, {"mode": mode_name, **metric_tags})

    Mode = UptimeMonitorMode
    try:
        match detector.config["mode"]:
            case Mode.AUTO_DETECTED_ONBOARDING:
                handle_onboarding_result(detector, uptime_subscription, result, metric_tags.copy())
            case Mode.AUTO_DETECTED_ACTIVE | Mode.MANUAL:
                handle_active_result(detector, uptime_subscription, result, metric_tags.copy())
            case _:
                logger.error(
                    "Unknown subscription mode",
                    extra={"mode": detector.config["mode"]},
                )
    except Exception:
        logger.exception("Failed to process result for uptime project subscription")

    # EAP production _must_ happen after handling the result, since we
    # may mutate the UptimeSubscription when we determine we're in an incident
    produce_eap_uptime_result(detector, result, metric_tags.copy())

    # Track the last update date to allow deduplication
    last_update_key = build_last_update_key(detector)
    cluster.set(
        last_update_key,
        int(result["scheduled_check_time_ms"]),
        ex=LAST_UPDATE_REDIS_TTL,
    )

    record_check_completion_metrics(result, metric_tags)


def handle_active_result(
    detector: Detector,
    uptime_subscription: UptimeSubscription,
    result: CheckResult,
    metric_tags: dict[str, str],
):
    packet = UptimePacketValue(
        check_result=result,
        subscription=uptime_subscription,
        metric_tags=metric_tags,
    )
    process_detectors(
        DataPacket(source_id=str(uptime_subscription.id), packet=packet),
        [detector],
    )


class UptimeResultProcessor(ResultProcessor[CheckResult, UptimeSubscription]):
    subscription_model = UptimeSubscription

    def get_subscription_id(self, result: CheckResult) -> str:
        return result["subscription_id"]

    def queue_result_for_retry(
        self,
        subscription: UptimeSubscription,
        result: CheckResult,
        metric_tags: dict[str, str],
        cluster,
    ) -> None:
        """
        Queue an out-of-order result for retry processing. Adds result to Redis sorted set and schedules task if needed.
        """
        from sentry.uptime.consumers.tasks import process_uptime_backlog

        subscription_id = str(subscription.id)
        backlog_key = build_backlog_key(subscription_id)
        task_scheduled_key = build_backlog_task_scheduled_key(subscription_id)
        schedule_lock_key = build_backlog_schedule_lock_key(subscription_id)
        schedule_lock = locks.get(schedule_lock_key, duration=10, name="uptime.backlog.schedule")
        lock_ctx = None

        try:
            lock_ctx = schedule_lock.blocking_acquire(0.1, 3)
            lock_ctx.__enter__()
        except UnableToAcquireLock:
            # The lock shouldn't fail, but if it does we'd prefer to try and put this in the queue
            # regardless, so that we don't have to drop it
            metrics.incr(
                "uptime.backlog.lock_failed",
                amount=1,
                sample_rate=1.0,
                tags=metric_tags,
            )

        try:
            result_json = json.dumps(result)
            pipeline = cluster.pipeline()
            pipeline.zadd(backlog_key, {result_json: int(result["scheduled_check_time_ms"])})
            pipeline.expire(backlog_key, 600)
            pipeline.exists(task_scheduled_key)
            task_scheduled = pipeline.execute()[2]
            metrics.incr(
                "uptime.backlog.added",
                amount=1,
                sample_rate=1.0,
                tags=metric_tags,
            )
            if not task_scheduled:
                cluster.set(task_scheduled_key, "1", ex=300)
                process_uptime_backlog.apply_async(
                    args=[subscription_id],
                    countdown=10,
                    kwargs={"attempt": 1},
                )
                logger.info(
                    "uptime.backlog.task_scheduled",
                    extra={
                        "subscription_id": subscription_id,
                        "buffer_size": cluster.zcard(backlog_key),
                    },
                )
                metrics.incr(
                    "uptime.backlog.task_scheduled",
                    amount=1,
                    sample_rate=1.0,
                    tags=metric_tags,
                )
        finally:
            if lock_ctx is not None:
                lock_ctx.__exit__(None, None, None)

    def handle_result(self, subscription: UptimeSubscription | None, result: CheckResult):
        if random.random() < 0.01:
            logger.info("process_result", extra=result)

        # If there's no subscription in the database, this subscription has
        # been orphaned. Remove from the checker
        if subscription is None:
            send_uptime_config_deletion(result["region"], result["subscription_id"])
            metrics.incr(
                "uptime.result_processor.subscription_not_found",
                sample_rate=1.0,
                tags={"uptime_region": result.get("region", "default")},
            )
            return

        metric_tags = {
            "host_provider": get_host_provider_if_valid(subscription),
            "status": result["status"],
            "uptime_region": result["region"],
        }
        subscription_regions = load_regions_for_uptime_subscription(subscription.id)

        if result["status"] == CHECKSTATUS_DISALLOWED_BY_ROBOTS:
            try:
                detector = get_detector(subscription)
                logger.info("disallowed_by_robots", extra=result)
                metrics.incr(
                    "uptime.result_processor.disallowed_by_robots",
                    sample_rate=1.0,
                    tags={"uptime_region": result.get("region", "default")},
                )
                disable_uptime_detector(detector)
            except Exception as e:
                logger.exception("disallowed_by_robots.error", extra={"error": e, "result": result})
            return

        # Discard shadow mode region results
        if is_shadow_region_result(result, subscription_regions):
            metrics.incr(
                "uptime.result_processor.dropped_shadow_result",
                sample_rate=1.0,
                tags=metric_tags,
            )
            return

        if should_run_region_checks(subscription, result):
            try_check_and_update_regions(subscription, subscription_regions)

        try:
            detector = get_detector(subscription, prefetch_workflow_data=True)
        except Detector.DoesNotExist:
            # Nothing to do if there's an orphaned uptime subscription
            delete_uptime_subscription(subscription)
            return

        organization = detector.project.organization

        # Nothing to do if this subscription is disabled.
        if not detector.enabled:
            return

        # Nothing to do if the feature isn't enabled
        if not features.has("organizations:uptime", organization):
            metrics.incr("uptime.result_processor.dropped_no_feature")
            return

        mode_name = UptimeMonitorMode(detector.config["mode"]).name.lower()

        status_reason = "none"
        if result["status_reason"]:
            status_reason = result["status_reason"]["type"]

        metrics.incr(
            "uptime.result_processor.handle_result_for_project",
            tags={"mode": mode_name, "status_reason": status_reason, **metric_tags},
            sample_rate=1.0,
        )

        cluster = get_cluster()
        last_update_key = build_last_update_key(detector)
        last_update_raw: str | None = cluster.get(last_update_key)
        last_update_ms = 0 if last_update_raw is None else int(last_update_raw)

        # Nothing to do if we've already processed this result at an earlier time
        if result["scheduled_check_time_ms"] <= last_update_ms:
            # If the scheduled check time is older than the most recent update then we've already processed it.
            # We can end up with duplicates due to Kafka replaying tuples, or due to the uptime checker processing
            # the same check multiple times and sending duplicate results.
            # We only ever want to process the first value related to each check, so we just skip and log here
            metrics.incr(
                "uptime.result_processor.skipping_already_processed_update",
                tags={"mode": mode_name, **metric_tags},
                sample_rate=1.0,
            )

            # Don't log too much; this codepath can get used when the consumer is doing increased
            # work, which can further increase its work, and so make a bad situation even worse.
            if random.random() < 0.01:
                logger.info(
                    "uptime.result_processor.skipping_already_processed_update",
                    extra={
                        "guid": result["guid"],
                        "region": result["region"],
                        "subscription_id": result["subscription_id"],
                    },
                )
            return

        if last_update_ms > 0:
            subscription_interval_ms = subscription.interval_seconds * 1000
            expected_next_ms = last_update_ms + subscription_interval_ms
            is_out_of_order = result["scheduled_check_time_ms"] != expected_next_ms

            if is_out_of_order:
                if features.has("organizations:uptime-backlog-retry", organization):
                    self.queue_result_for_retry(subscription, result, metric_tags, cluster)
                    return

                create_backfill_misses(
                    detector, subscription, result, last_update_ms, metric_tags, cluster
                )

        process_result_internal(detector, subscription, result, metric_tags, cluster)


class UptimeResultsStrategyFactory(ResultsStrategyFactory[CheckResult, UptimeSubscription]):
    result_processor_cls = UptimeResultProcessor
    topic_for_codec = Topic.UPTIME_RESULTS
    identifier = "uptime"

    def build_payload_grouping_key(self, result: CheckResult) -> str:
        return self.result_processor.get_subscription_id(result)
