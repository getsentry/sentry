from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone
from uuid import UUID

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.utils import timezone as django_timezone
from sentry_kafka_schemas.codecs import Codec
from sentry_kafka_schemas.schema_types.snuba_uptime_results_v1 import SnubaUptimeResult
from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_FAILURE,
    CHECKSTATUS_MISSED_WINDOW,
    CHECKSTATUS_SUCCESS,
    CheckResult,
)

from sentry import features, options, quotas
from sentry.conf.types.kafka_definition import Topic, get_topic_codec
from sentry.models.project import Project
from sentry.remote_subscriptions.consumers.result_consumer import (
    ResultProcessor,
    ResultsStrategyFactory,
)
from sentry.uptime.detectors.ranking import _get_cluster
from sentry.uptime.detectors.result_handler import handle_onboarding_result
from sentry.uptime.grouptype import UptimePacketValue
from sentry.uptime.issue_platform import create_issue_platform_occurrence, resolve_uptime_issue
from sentry.uptime.models import (
    UptimeStatus,
    UptimeSubscription,
    UptimeSubscriptionRegion,
    get_detector,
    get_top_hosting_provider_names,
    load_regions_for_uptime_subscription,
)
from sentry.uptime.subscriptions.subscriptions import (
    check_and_update_regions,
    remove_uptime_subscription_if_unused,
)
from sentry.uptime.subscriptions.tasks import (
    send_uptime_config_deletion,
    update_remote_uptime_subscription,
)
from sentry.uptime.types import DATA_SOURCE_UPTIME_SUBSCRIPTION, IncidentStatus, UptimeMonitorMode
from sentry.utils import metrics
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.models.detector import Detector
from sentry.workflow_engine.processors.data_packet import process_data_packets

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


def _get_snuba_uptime_checks_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(Topic.SNUBA_UPTIME_RESULTS)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_snuba_uptime_checks_producer = SingletonProducer(_get_snuba_uptime_checks_producer)


def build_last_update_key(detector: Detector) -> str:
    return f"project-sub-last-update:detector:{detector.id}"


def build_last_seen_interval_key(detector: Detector) -> str:
    return f"project-sub-last-seen-interval:detector:{detector.id}"


def build_active_consecutive_status_key(detector: Detector, status: str) -> str:
    return f"project-sub-active:{status}:detector:{detector.id}"


def get_active_failure_threshold():
    # When in active monitoring mode, overrides how many failures in a row we need to see to mark the monitor as down
    return options.get("uptime.active-failure-threshold")


def get_active_recovery_threshold():
    # When in active monitoring mode, how many successes in a row do we need to mark it as up
    return options.get("uptime.active-recovery-threshold")


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


def has_reached_status_threshold(
    detector: Detector,
    status: str,
    metric_tags: dict[str, str],
) -> bool:
    pipeline = _get_cluster().pipeline()
    key = build_active_consecutive_status_key(detector, status)
    pipeline.incr(key)
    pipeline.expire(key, ACTIVE_THRESHOLD_REDIS_TTL)
    status_count = int(pipeline.execute()[0])
    result = (status == CHECKSTATUS_FAILURE and status_count >= get_active_failure_threshold()) or (
        status == CHECKSTATUS_SUCCESS and status_count >= get_active_recovery_threshold()
    )
    if not result:
        metrics.incr(
            "uptime.result_processor.active.under_threshold",
            sample_rate=1.0,
            tags=metric_tags,
        )
    return result


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
    uptime_subscription: UptimeSubscription,
    project: Project,
    result: CheckResult,
    metric_tags: dict[str, str],
) -> None:
    """
    Produces a message to Snuba's Kafka topic for uptime check results.
    """
    try:
        retention_days = quotas.backend.get_event_retention(organization=project.organization) or 90

        if uptime_subscription.uptime_status == UptimeStatus.FAILED:
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
            "organization_id": project.organization_id,
            "project_id": project.id,
            "retention_days": retention_days,
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
    organization = detector.project.organization

    if features.has("organizations:uptime-detector-handler", organization):
        # XXX(epurkhiser): Enabling the uptime-detector-handler will process
        # check results via the uptime detector handler. However the handler
        # WILL NOT produce issue occurrences (however it will do nearly
        # everything else, including logging that it will produce)
        packet = UptimePacketValue(
            check_result=result,
            subscription=uptime_subscription,
            metric_tags=metric_tags,
        )
        process_data_packets(
            [DataPacket(source_id=str(uptime_subscription.id), packet=packet)],
            DATA_SOURCE_UPTIME_SUBSCRIPTION,
        )

        # Bail if we're doing issue creation via detectors, we don't want to
        # create issues using the legacy system in this case. If this flag is
        # not enabled the detector will still run, but will not produce an
        # issue occurrence.
        #
        # Once we've determined that the detector handler is producing issues
        # the same as the legacy issue creation, we can remove this.
        if features.has("organizations:uptime-detector-create-issues", organization):
            return

    uptime_status = uptime_subscription.uptime_status
    result_status = result["status"]

    redis = _get_cluster()
    delete_status = (
        CHECKSTATUS_FAILURE if result_status == CHECKSTATUS_SUCCESS else CHECKSTATUS_SUCCESS
    )
    # Delete any consecutive results we have for the opposing status, since we received this status
    redis.delete(build_active_consecutive_status_key(detector, delete_status))

    if uptime_status == UptimeStatus.OK and result_status == CHECKSTATUS_FAILURE:
        if not has_reached_status_threshold(detector, result_status, metric_tags):
            return

        issue_creation_flag_enabled = features.has(
            "organizations:uptime-create-issues",
            detector.project.organization,
        )

        restricted_host_provider_ids = options.get(
            "uptime.restrict-issue-creation-by-hosting-provider-id"
        )
        host_provider_id = uptime_subscription.host_provider_id
        issue_creation_restricted_by_provider = host_provider_id in restricted_host_provider_ids

        if issue_creation_restricted_by_provider:
            metrics.incr(
                "uptime.result_processor.restricted_by_provider",
                sample_rate=1.0,
                tags={
                    "host_provider_id": host_provider_id,
                    **metric_tags,
                },
            )

        if issue_creation_flag_enabled and not issue_creation_restricted_by_provider:
            create_issue_platform_occurrence(result, detector)
            metrics.incr(
                "uptime.result_processor.active.sent_occurrence",
                tags=metric_tags,
                sample_rate=1.0,
            )
            logger.info(
                "uptime_active_sent_occurrence",
                extra={
                    "project_id": detector.project_id,
                    "url": uptime_subscription.url,
                    **result,
                },
            )
        uptime_subscription.update(
            uptime_status=UptimeStatus.FAILED,
            uptime_status_update_date=django_timezone.now(),
        )
    elif uptime_status == UptimeStatus.FAILED and result_status == CHECKSTATUS_SUCCESS:
        if not has_reached_status_threshold(detector, result_status, metric_tags):
            return

        if features.has("organizations:uptime-create-issues", detector.project.organization):
            resolve_uptime_issue(detector)
            metrics.incr(
                "uptime.result_processor.active.resolved",
                sample_rate=1.0,
                tags=metric_tags,
            )
            logger.info(
                "uptime_active_resolved",
                extra={
                    "project_id": detector.project_id,
                    "url": uptime_subscription.url,
                    **result,
                },
            )
        uptime_subscription.update(
            uptime_status=UptimeStatus.OK,
            uptime_status_update_date=django_timezone.now(),
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

        detector = get_detector(subscription)

        # Nothing to do if there's an orphaned project subscription
        if not detector:
            remove_uptime_subscription_if_unused(subscription)
            return

        organization = detector.project.organization

        # Detailed logging for specific organizations, useful for if we need to
        # debug a specific organizations checks.
        if features.has("organizations:uptime-detailed-logging", organization):
            logger.info("handle_result_for_project.before_dedupe", extra=result)

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
                num_missed_checks = num_intervals - 1
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
            else:
                logger.info(
                    "uptime.result_processor.false_num_missing_check",
                    extra={**result},
                )
                cluster.set(last_interval_key, subscription_interval_ms, ex=LAST_UPDATE_REDIS_TTL)

        if features.has("organizations:uptime-detailed-logging", organization):
            logger.info("handle_result_for_project.after_dedupe", extra=result)

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
            produce_snuba_uptime_result(subscription, detector.project, result, metric_tags.copy())

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
