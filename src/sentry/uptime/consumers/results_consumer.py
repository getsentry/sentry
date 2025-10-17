from __future__ import annotations

import logging
import random
import uuid
from datetime import datetime, timedelta, timezone
from uuid import UUID

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_uptime_results_v1 import SnubaUptimeResult
from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_DISALLOWED_BY_ROBOTS,
    CHECKSTATUS_MISSED_WINDOW,
    CheckResult,
)

from sentry import features, options
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.remote_subscriptions.consumers.result_consumer import (
    ResultProcessor,
    ResultsStrategyFactory,
)
from sentry.uptime.autodetect.ranking import _get_cluster
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
    disable_uptime_detector,
    remove_uptime_subscription_if_unused,
)
from sentry.uptime.subscriptions.tasks import (
    send_uptime_config_deletion,
    update_remote_uptime_subscription,
)
from sentry.uptime.types import IncidentStatus, UptimeMonitorMode
from sentry.utils import metrics
from sentry.utils.arroyo_producer import SingletonProducer, get_arroyo_producer
from sentry.utils.kafka_config import get_topic_definition
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

SNUBA_UPTIME_RESULTS_CODEC: Codec[SnubaUptimeResult] = get_topic_codec(Topic.SNUBA_UPTIME_RESULTS)

# We want to limit cardinality for provider tags. This controls how many tags we should include
TOTAL_PROVIDERS_TO_INCLUDE_AS_TAGS = 30


def _get_snuba_uptime_checks_producer():
    return get_arroyo_producer(
        "sentry.uptime.consumers.results_consumer",
        Topic.SNUBA_UPTIME_RESULTS,
        exclude_config_keys=["compression.type", "message.max.bytes"],
    )


_snuba_uptime_checks_producer = SingletonProducer(_get_snuba_uptime_checks_producer)


def build_last_update_key(detector: Detector) -> str:
    return f"project-sub-last-update:detector:{detector.id}"


def build_last_seen_interval_key(detector: Detector) -> str:
    return f"project-sub-last-seen-interval:detector:{detector.id}"


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


def produce_snuba_uptime_result(
    detector: Detector,
    result: CheckResult,
    metric_tags: dict[str, str],
) -> None:
    """
    Produces a message to Snuba's Kafka topic for uptime check results.
    """
    try:
        detector_state = detector.detectorstate_set.first()
        if detector_state and detector_state.is_triggered:
            incident_status = IncidentStatus.IN_INCIDENT
        else:
            incident_status = IncidentStatus.NO_INCIDENT

        snuba_message: SnubaUptimeResult = {
            # Copy over fields from original result
            "guid": result["guid"],
            "subscription_id": result["subscription_id"],
            "status": result["status"],
            "status_reason": result["status_reason"],
            "trace_id": result["trace_id"],
            "span_id": result["span_id"],
            "scheduled_check_time_ms": result["scheduled_check_time_ms"],
            "actual_check_time_ms": result["actual_check_time_ms"],
            "duration_ms": result["duration_ms"],
            "request_info": result["request_info"],
            # Add required Snuba-specific fields
            "organization_id": detector.project.organization_id,
            "project_id": detector.project.id,
            "retention_days": 90,
            "incident_status": incident_status.value,
            "region": result["region"],
        }

        topic = get_topic_definition(Topic.SNUBA_UPTIME_RESULTS)["real_topic_name"]
        payload = KafkaPayload(None, SNUBA_UPTIME_RESULTS_CODEC.encode(snuba_message), [])

        _snuba_uptime_checks_producer.produce(ArroyoTopic(topic), payload)

        metrics.incr(
            "uptime.result_processor.snuba_message_produced",
            sample_rate=1.0,
            tags=metric_tags,
        )

    except Exception:
        logger.exception("Failed to produce Snuba message for uptime result")
        metrics.incr(
            "uptime.result_processor.snuba_message_failed",
            sample_rate=1.0,
            tags=metric_tags,
        )


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
            remove_uptime_subscription_if_unused(subscription)
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

        cluster = _get_cluster()
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

        subscription_interval_ms = 1000 * subscription.interval_seconds
        num_intervals = (
            result["scheduled_check_time_ms"] - last_update_ms
        ) / subscription_interval_ms

        # If the scheduled check is two or more intervals since the last seen check, we can declare the
        # intervening checks missed...
        if last_update_raw is not None and num_intervals > 1:
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
                num_missed_checks = int(num_intervals - 1)
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
                        "guid": str(uuid.uuid4()),
                        "subscription_id": result["subscription_id"],
                        "status": CHECKSTATUS_MISSED_WINDOW,
                        "status_reason": None,
                        "trace_id": str(uuid.uuid4()),
                        "span_id": str(uuid.uuid4()),
                        "region": result["region"],
                        "scheduled_check_time_ms": last_update_ms
                        + ((i + 1) * subscription_interval_ms),
                        "actual_check_time_ms": result["actual_check_time_ms"],
                        "duration_ms": 0,
                        "request_info": None,
                    }

                    if options.get("uptime.snuba_uptime_results.enabled"):
                        produce_snuba_uptime_result(
                            detector,
                            missed_result,
                            synthetic_metric_tags.copy(),
                        )

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
                    handle_onboarding_result(detector, subscription, result, metric_tags.copy())
                case Mode.AUTO_DETECTED_ACTIVE | Mode.MANUAL:
                    handle_active_result(detector, subscription, result, metric_tags.copy())
                case _:
                    logger.error(
                        "Unknown subscription mode",
                        extra={"mode": detector.config["mode"]},
                    )
        except Exception:
            logger.exception("Failed to process result for uptime project subscription")

        # Snuba production _must_ happen after handling the result, since we
        # may mutate the UptimeSubscription when we determine we're in an incident
        if options.get("uptime.snuba_uptime_results.enabled"):
            produce_snuba_uptime_result(detector, result, metric_tags.copy())

        produce_eap_uptime_result(detector, result, metric_tags.copy())

        # Track the last update date to allow deduplication
        cluster.set(
            last_update_key,
            int(result["scheduled_check_time_ms"]),
            ex=LAST_UPDATE_REDIS_TTL,
        )

        record_check_completion_metrics(result, metric_tags)


class UptimeResultsStrategyFactory(ResultsStrategyFactory[CheckResult, UptimeSubscription]):
    result_processor_cls = UptimeResultProcessor
    topic_for_codec = Topic.UPTIME_RESULTS
    identifier = "uptime"

    def build_payload_grouping_key(self, result: CheckResult) -> str:
        return self.result_processor.get_subscription_id(result)
