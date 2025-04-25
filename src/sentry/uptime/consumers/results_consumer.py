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
from sentry.constants import ObjectStatus
from sentry.remote_subscriptions.consumers.result_consumer import (
    ResultProcessor,
    ResultsStrategyFactory,
)
from sentry.uptime.detectors.ranking import _get_cluster
from sentry.uptime.detectors.result_handler import handle_onboarding_result
from sentry.uptime.issue_platform import create_issue_platform_occurrence, resolve_uptime_issue
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    UptimeStatus,
    UptimeSubscription,
    UptimeSubscriptionRegion,
    get_project_subscription_for_uptime_subscription,
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
from sentry.uptime.types import IncidentStatus, ProjectUptimeSubscriptionMode
from sentry.utils import metrics
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

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


def build_last_update_key(project_subscription: ProjectUptimeSubscription) -> str:
    return f"project-sub-last-update:{project_subscription.id}"


def build_active_consecutive_status_key(
    project_subscription: ProjectUptimeSubscription, status: str
) -> str:
    return f"project-sub-active:{status}:{project_subscription.id}"


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
    project_subscription: ProjectUptimeSubscription,
    status: str,
    metric_tags: dict[str, str],
) -> bool:
    pipeline = _get_cluster().pipeline()
    key = build_active_consecutive_status_key(project_subscription, status)
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
    subscription: UptimeSubscription,
    result: CheckResult,
    regions: list[UptimeSubscriptionRegion],
):
    """
    This method will check if regions have been added or removed from our region configuration,
    and updates regions associated with this uptime monitor to reflect the new state. This is
    done probabilistically, so that the check is performed roughly once an hour for each uptime
    monitor.
    """
    if not should_run_region_checks(subscription, result):
        return

    if not check_and_update_regions(subscription, regions):
        return

    # Regardless of whether we added or removed regions, we need to send an updated config to all active
    # regions for this subscription so that they all get an update set of currently active regions.
    subscription.update(status=UptimeSubscription.Status.UPDATING.value)
    update_remote_uptime_subscription.delay(subscription.id)


def produce_snuba_uptime_result(
    project_subscription: ProjectUptimeSubscription,
    result: CheckResult,
    metric_tags: dict[str, str],
) -> None:
    """
    Produces a message to Snuba's Kafka topic for uptime check results.

    Args:
        project_subscription: The project subscription associated with the result
        result: The check result to be sent to Snuba
    """
    try:
        project = project_subscription.project
        retention_days = quotas.backend.get_event_retention(organization=project.organization) or 90

        if project_subscription.uptime_status == UptimeStatus.FAILED:
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
    project_subscription: ProjectUptimeSubscription,
    metric_tags: dict[str, str],
) -> None:
    """
    Records
    """
    if result["status"] == CHECKSTATUS_MISSED_WINDOW:
        logger.info(
            "handle_result_for_project.missed",
            extra={"project_id": project_subscription.project_id, **result},
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
    project_subscription: ProjectUptimeSubscription,
    result: CheckResult,
    metric_tags: dict[str, str],
):
    uptime_status = project_subscription.uptime_status
    result_status = result["status"]

    redis = _get_cluster()
    delete_status = (
        CHECKSTATUS_FAILURE if result_status == CHECKSTATUS_SUCCESS else CHECKSTATUS_SUCCESS
    )
    # Delete any consecutive results we have for the opposing status, since we received this status
    redis.delete(build_active_consecutive_status_key(project_subscription, delete_status))

    if uptime_status == UptimeStatus.OK and result_status == CHECKSTATUS_FAILURE:
        if not has_reached_status_threshold(project_subscription, result_status, metric_tags):
            return

        issue_creation_flag_enabled = features.has(
            "organizations:uptime-create-issues",
            project_subscription.project.organization,
        )

        restricted_host_provider_ids = options.get(
            "uptime.restrict-issue-creation-by-hosting-provider-id"
        )
        host_provider_id = project_subscription.uptime_subscription.host_provider_id
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
            create_issue_platform_occurrence(result, project_subscription)
            metrics.incr(
                "uptime.result_processor.active.sent_occurrence",
                tags=metric_tags,
                sample_rate=1.0,
            )
            logger.info(
                "uptime_active_sent_occurrence",
                extra={
                    "project_id": project_subscription.project_id,
                    "url": project_subscription.uptime_subscription.url,
                    **result,
                },
            )
        # TODO(epurkhiser): Dual until we're only reading the uptime_status
        # from the uptime_subscription.
        now = django_timezone.now()
        project_subscription.update(
            uptime_status=UptimeStatus.FAILED,
            uptime_status_update_date=now,
        )
        project_subscription.uptime_subscription.update(
            uptime_status=UptimeStatus.FAILED,
            uptime_status_update_date=now,
        )
    elif uptime_status == UptimeStatus.FAILED and result_status == CHECKSTATUS_SUCCESS:
        if not has_reached_status_threshold(project_subscription, result_status, metric_tags):
            return

        if features.has(
            "organizations:uptime-create-issues", project_subscription.project.organization
        ):
            resolve_uptime_issue(project_subscription)
            metrics.incr(
                "uptime.result_processor.active.resolved",
                sample_rate=1.0,
                tags=metric_tags,
            )
            logger.info(
                "uptime_active_resolved",
                extra={
                    "project_id": project_subscription.project_id,
                    "url": project_subscription.uptime_subscription.url,
                    **result,
                },
            )
        # TODO(epurkhiser): Dual until we're only reading the uptime_status
        # from the uptime_subscription.
        now = django_timezone.now()
        project_subscription.update(
            uptime_status=UptimeStatus.OK,
            uptime_status_update_date=now,
        )
        project_subscription.uptime_subscription.update(
            uptime_status=UptimeStatus.OK,
            uptime_status_update_date=now,
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

        try_check_and_update_regions(subscription, result, subscription_regions)

        project_subscription = get_project_subscription_for_uptime_subscription(subscription.id)

        # Nothing to do if there's an orphaned project subscription
        if not project_subscription:
            remove_uptime_subscription_if_unused(subscription)
            return

        organization = project_subscription.project.organization

        # Detailed logging for specific organizations, useful for if we need to
        # debug a specific organizations checks.
        if features.has("organizations:uptime-detailed-logging", organization):
            logger.info("handle_result_for_project.before_dedupe", extra=result)

        # Nothing to do if this subscription is disabled.
        if project_subscription.status == ObjectStatus.DISABLED:
            return

        # Nothing to do if the feature isn't enabled
        if not features.has("organizations:uptime", organization):
            metrics.incr("uptime.result_processor.dropped_no_feature")
            return

        mode_name = ProjectUptimeSubscriptionMode(project_subscription.mode).name.lower()

        status_reason = "none"
        if result["status_reason"]:
            status_reason = result["status_reason"]["type"]

        metrics.incr(
            "uptime.result_processor.handle_result_for_project",
            tags={"mode": mode_name, "status_reason": status_reason, **metric_tags},
            sample_rate=1.0,
        )

        cluster = _get_cluster()
        last_update_key = build_last_update_key(project_subscription)
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
        record_check_metrics(result, project_subscription, {"mode": mode_name, **metric_tags})

        Mode = ProjectUptimeSubscriptionMode
        try:
            match project_subscription.mode:
                case Mode.AUTO_DETECTED_ONBOARDING:
                    handle_onboarding_result(project_subscription, result, metric_tags.copy())
                case Mode.AUTO_DETECTED_ACTIVE | Mode.MANUAL:
                    handle_active_result(project_subscription, result, metric_tags.copy())
                case _:
                    logger.error(
                        "Unknown subscription mode",
                        extra={"mode": project_subscription.mode},
                    )
        except Exception:
            logger.exception("Failed to process result for uptime project subscription")

        # Snuba production _must_ happen after handling the result, since we
        # may mutate the project_subscription when we determine we're in an incident
        if options.get("uptime.snuba_uptime_results.enabled"):
            produce_snuba_uptime_result(project_subscription, result, metric_tags.copy())

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
