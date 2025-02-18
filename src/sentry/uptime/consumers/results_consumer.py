from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone
from uuid import UUID

from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
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
from sentry.uptime.detectors.tasks import set_failed_url
from sentry.uptime.issue_platform import create_issue_platform_occurrence, resolve_uptime_issue
from sentry.uptime.models import (
    ProjectUptimeSubscription,
    ProjectUptimeSubscriptionMode,
    UptimeStatus,
    UptimeSubscription,
    UptimeSubscriptionRegion,
    get_top_hosting_provider_names,
)
from sentry.uptime.subscriptions.regions import get_active_region_configs
from sentry.uptime.subscriptions.subscriptions import (
    delete_uptime_subscriptions_for_project,
    get_or_create_uptime_subscription,
    remove_uptime_subscription_if_unused,
)
from sentry.uptime.subscriptions.tasks import (
    send_uptime_config_deletion,
    update_remote_uptime_subscription,
)
from sentry.uptime.types import IncidentStatus
from sentry.utils import metrics
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)
LAST_UPDATE_REDIS_TTL = timedelta(days=7)
ONBOARDING_MONITOR_PERIOD = timedelta(days=3)
# When onboarding a new subscription how many total failures are allowed to happen during
# the ONBOARDING_MONITOR_PERIOD before we consider the subscription to have failed onboarding.
ONBOARDING_FAILURE_THRESHOLD = 3
# The TTL of the redis key used to track the failure counts for a subscription in
# `ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING` mode. Must be >= the
# ONBOARDING_MONITOR_PERIOD.
ONBOARDING_FAILURE_REDIS_TTL = ONBOARDING_MONITOR_PERIOD
# How frequently we should run active auto-detected subscriptions
AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL = timedelta(minutes=1)
# When in active monitoring mode, how many failures in a row do we need to see to mark the monitor as down, or how many
# successes in a row do we need to mark it up
ACTIVE_FAILURE_THRESHOLD = 3
ACTIVE_RECOVERY_THRESHOLD = 1
# The TTL of the redis key used to track consecutive statuses
ACTIVE_THRESHOLD_REDIS_TTL = timedelta(minutes=60)
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


def build_onboarding_failure_key(project_subscription: ProjectUptimeSubscription) -> str:
    return f"project-sub-onboarding_failure:{project_subscription.id}"


def build_active_consecutive_status_key(
    project_subscription: ProjectUptimeSubscription, status: str
) -> str:
    return f"project-sub-active:{status}:{project_subscription.id}"


class UptimeResultProcessor(ResultProcessor[CheckResult, UptimeSubscription]):
    subscription_model = UptimeSubscription

    def get_subscription_id(self, result: CheckResult) -> str:
        return result["subscription_id"]

    def check_and_update_regions(self, subscription: UptimeSubscription, result: CheckResult):
        """
        This method will check if regions have been added or removed from our region configuration,
        and updates regions associated with this uptime monitor to reflect the new state. This is
        done probabilistically, so that the check is performed roughly once an hour for each uptime
        monitor.
        """
        if not subscription.subscription_id:
            # Edge case where we can have no subscription_id here
            return
        # Run region checks and updates once an hour
        runs_per_hour = UptimeSubscription.IntervalSeconds.ONE_HOUR / subscription.interval_seconds
        subscription_run = UUID(subscription.subscription_id).int % runs_per_hour
        current_run = (
            datetime.fromtimestamp(result["scheduled_check_time_ms"] / 1000, timezone.utc).minute
            * 60
        ) // subscription.interval_seconds
        if subscription_run != current_run:
            return

        subscription_region_slugs = {r.region_slug for r in subscription.regions.all()}
        active_region_slugs = {c.slug for c in get_active_region_configs()}
        if subscription_region_slugs == active_region_slugs:
            # Regions haven't changed, exit early.
            return

        new_region_slugs = active_region_slugs - subscription_region_slugs
        removed_region_slugs = subscription_region_slugs - active_region_slugs
        if new_region_slugs:
            new_regions = [
                UptimeSubscriptionRegion(uptime_subscription=subscription, region_slug=slug)
                for slug in new_region_slugs
            ]
            UptimeSubscriptionRegion.objects.bulk_create(new_regions, ignore_conflicts=True)

        if removed_region_slugs:
            for deleted_region in UptimeSubscriptionRegion.objects.filter(
                uptime_subscription=subscription, region_slug__in=removed_region_slugs
            ):
                if subscription.subscription_id:
                    # We need to explicitly send deletes here before we remove the region
                    send_uptime_config_deletion(
                        deleted_region.region_slug, subscription.subscription_id
                    )
                deleted_region.delete()

        # Regardless of whether we added or removed regions, we need to send an updated config to all active
        # regions for this subscription so that they all get an update set of currently active regions.
        subscription.update(status=UptimeSubscription.Status.UPDATING.value)
        update_remote_uptime_subscription.delay(subscription.id)

    def get_host_provider_if_valid(self, subscription: UptimeSubscription) -> str:
        if subscription.host_provider_name in get_top_hosting_provider_names(
            TOTAL_PROVIDERS_TO_INCLUDE_AS_TAGS
        ):
            return subscription.host_provider_name
        return "other"

    def handle_result(self, subscription: UptimeSubscription | None, result: CheckResult):
        if random.random() < 0.01:
            logger.info("process_result", extra=result)

        if subscription is None:
            # If no subscription in the Postgres, this subscription has been orphaned. Remove
            # from the checker
            # TODO: Send to region specifically from this check result once we update the schema
            send_uptime_config_deletion(
                get_active_region_configs()[0].slug, result["subscription_id"]
            )
            metrics.incr(
                "uptime.result_processor.subscription_not_found",
                sample_rate=1.0,
                tags={"uptime_region": result.get("region", "default")},
            )
            return

        metric_tags = {
            "host_provider": self.get_host_provider_if_valid(subscription),
            "status": result["status"],
            "uptime_region": result.get("region", "default"),
        }

        self.check_and_update_regions(subscription, result)

        project_subscriptions = list(
            subscription.projectuptimesubscription_set.select_related(
                "project", "project__organization"
            ).all()
        )

        cluster = _get_cluster()
        last_updates: list[str | None] = cluster.mget(
            build_last_update_key(sub) for sub in project_subscriptions
        )

        for last_update_raw, project_subscription in zip(last_updates, project_subscriptions):
            last_update_ms = 0 if last_update_raw is None else int(last_update_raw)
            self.handle_result_for_project(
                project_subscription,
                result,
                last_update_ms,
                metric_tags.copy(),
            )

    def handle_result_for_project(
        self,
        project_subscription: ProjectUptimeSubscription,
        result: CheckResult,
        last_update_ms: int,
        metric_tags: dict[str, str],
    ):
        if features.has(
            "organizations:uptime-detailed-logging", project_subscription.project.organization
        ):
            logger.info("handle_result_for_project.before_dedupe", extra=result)

        # Nothing to do if this subscription is disabled. Should mean there are
        # other ProjectUptimeSubscription's that are not disabled that will use
        # this result.
        if project_subscription.status == ObjectStatus.DISABLED:
            return

        if not features.has("organizations:uptime", project_subscription.project.organization):
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
        try:
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

            if features.has(
                "organizations:uptime-detailed-logging", project_subscription.project.organization
            ):
                logger.info("handle_result_for_project.after_dedupe", extra=result)

            if result["status"] == CHECKSTATUS_MISSED_WINDOW:
                logger.info(
                    "handle_result_for_project.missed",
                    extra={"project_id": project_subscription.project_id, **result},
                )
            else:
                # We log the result stats here after the duplicate check so that we know the "true" duration and delay
                # of each check. Since during deploys we might have checks run from both the old/new checker
                # deployments, there will be overlap of when things run. The new deployment will have artificially
                # inflated delay stats, since it may duplicate checks that already ran on time on the old deployment,
                # but will have run them later.
                # Since we process all results for a given uptime monitor in order, we can guarantee that we get the
                # earliest delay stat for each scheduled check for the monitor here, and so this stat will be a more
                # accurate measurement of delay/duration.
                if result["duration_ms"]:
                    metrics.distribution(
                        "uptime.result_processor.check_result.duration",
                        result["duration_ms"],
                        sample_rate=1.0,
                        unit="millisecond",
                        tags={"mode": mode_name, **metric_tags},
                    )
                metrics.distribution(
                    "uptime.result_processor.check_result.delay",
                    result["actual_check_time_ms"] - result["scheduled_check_time_ms"],
                    sample_rate=1.0,
                    unit="millisecond",
                    tags={"mode": mode_name, **metric_tags},
                )

            if project_subscription.mode == ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING:
                self.handle_result_for_project_auto_onboarding_mode(
                    project_subscription, result, metric_tags.copy()
                )
            elif project_subscription.mode in (
                ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
                ProjectUptimeSubscriptionMode.MANUAL,
            ):
                self.handle_result_for_project_active_mode(
                    project_subscription, result, metric_tags.copy()
                )
        except Exception:
            logger.exception("Failed to process result for uptime project subscription")

        # Now that we've processed the result for this project subscription we track the last update date
        cluster = _get_cluster()
        cluster.set(
            build_last_update_key(project_subscription),
            int(result["scheduled_check_time_ms"]),
            ex=LAST_UPDATE_REDIS_TTL,
        )

        # After processing the result and updating Redis, produce message to Kafka
        if options.get("uptime.snuba_uptime_results.enabled"):
            self._produce_snuba_uptime_result(project_subscription, result, metric_tags.copy())

        # The amount of time it took for a check result to get from the checker to this consumer and be processed
        metrics.distribution(
            "uptime.result_processor.check_completion_time",
            (datetime.now().timestamp() * 1000)
            - (
                result["actual_check_time_ms"] + result["duration_ms"]
                if result["duration_ms"]
                else 0
            ),
            sample_rate=1.0,
            unit="millisecond",
            tags=metric_tags,
        )

    def handle_result_for_project_auto_onboarding_mode(
        self,
        project_subscription: ProjectUptimeSubscription,
        result: CheckResult,
        metric_tags: dict[str, str],
    ):
        if result["status"] == CHECKSTATUS_FAILURE:
            redis = _get_cluster()
            key = build_onboarding_failure_key(project_subscription)
            pipeline = redis.pipeline()
            pipeline.incr(key)
            pipeline.expire(key, ONBOARDING_FAILURE_REDIS_TTL)
            failure_count = pipeline.execute()[0]
            if failure_count >= ONBOARDING_FAILURE_THRESHOLD:
                # If we've hit too many failures during the onboarding period we stop monitoring
                delete_uptime_subscriptions_for_project(
                    project_subscription.project,
                    project_subscription.uptime_subscription,
                    modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING],
                )
                # Mark the url as failed so that we don't attempt to auto-detect it for a while
                set_failed_url(project_subscription.uptime_subscription.url)
                redis.delete(key)
                status_reason = "unknown"
                if result["status_reason"]:
                    status_reason = result["status_reason"]["type"]
                metrics.incr(
                    "uptime.result_processor.autodetection.failed_onboarding",
                    tags={"failure_reason": status_reason, **metric_tags},
                    sample_rate=1.0,
                )
                logger.info(
                    "uptime_onboarding_failed",
                    extra={
                        "project_id": project_subscription.project_id,
                        "url": project_subscription.uptime_subscription.url,
                        **result,
                    },
                )
        elif result["status"] == CHECKSTATUS_SUCCESS:
            assert project_subscription.date_added is not None
            scheduled_check_time = datetime.fromtimestamp(
                result["scheduled_check_time_ms"] / 1000, timezone.utc
            )
            if scheduled_check_time - ONBOARDING_MONITOR_PERIOD > project_subscription.date_added:
                # If we've had mostly successes throughout the onboarding period then we can graduate the subscription
                # to active.
                onboarding_subscription = project_subscription.uptime_subscription
                active_subscription = get_or_create_uptime_subscription(
                    onboarding_subscription.url,
                    int(AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL.total_seconds()),
                    onboarding_subscription.timeout_ms,
                )
                project_subscription.update(
                    uptime_subscription=active_subscription,
                    mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
                )
                remove_uptime_subscription_if_unused(onboarding_subscription)
                metrics.incr(
                    "uptime.result_processor.autodetection.graduated_onboarding",
                    sample_rate=1.0,
                    tags=metric_tags,
                )
                logger.info(
                    "uptime_onboarding_graduated",
                    extra={
                        "project_id": project_subscription.project_id,
                        "url": project_subscription.uptime_subscription.url,
                        **result,
                    },
                )

    def handle_result_for_project_active_mode(
        self,
        project_subscription: ProjectUptimeSubscription,
        result: CheckResult,
        metric_tags: dict[str, str],
    ):
        redis = _get_cluster()
        delete_status = (
            CHECKSTATUS_FAILURE if result["status"] == CHECKSTATUS_SUCCESS else CHECKSTATUS_SUCCESS
        )
        # Delete any consecutive results we have for the opposing status, since we received this status
        redis.delete(build_active_consecutive_status_key(project_subscription, delete_status))

        if (
            project_subscription.uptime_status == UptimeStatus.OK
            and result["status"] == CHECKSTATUS_FAILURE
        ):
            if not self.has_reached_status_threshold(
                project_subscription, result["status"], metric_tags
            ):
                return

            issue_creation_flag_enabled = features.has(
                "organizations:uptime-create-issues",
                project_subscription.project.organization,
            )

            # Do not create uptime issue occurences for
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
            project_subscription.update(uptime_status=UptimeStatus.FAILED)
        elif (
            project_subscription.uptime_status == UptimeStatus.FAILED
            and result["status"] == CHECKSTATUS_SUCCESS
        ):
            if not self.has_reached_status_threshold(
                project_subscription, result["status"], metric_tags
            ):
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
            project_subscription.update(uptime_status=UptimeStatus.OK)

    def has_reached_status_threshold(
        self,
        project_subscription: ProjectUptimeSubscription,
        status: str,
        metric_tags: dict[str, str],
    ) -> bool:
        pipeline = _get_cluster().pipeline()
        key = build_active_consecutive_status_key(project_subscription, status)
        pipeline.incr(key)
        pipeline.expire(key, ACTIVE_THRESHOLD_REDIS_TTL)
        status_count = int(pipeline.execute()[0])
        result = (status == CHECKSTATUS_FAILURE and status_count >= ACTIVE_FAILURE_THRESHOLD) or (
            status == CHECKSTATUS_SUCCESS and status_count >= ACTIVE_RECOVERY_THRESHOLD
        )
        if not result:
            metrics.incr(
                "uptime.result_processor.active.under_threshold",
                sample_rate=1.0,
                tags=metric_tags,
            )
        return result

    def _produce_snuba_uptime_result(
        self,
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
            retention_days = (
                quotas.backend.get_event_retention(organization=project.organization) or 90
            )

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


class UptimeResultsStrategyFactory(ResultsStrategyFactory[CheckResult, UptimeSubscription]):
    result_processor_cls = UptimeResultProcessor
    topic_for_codec = Topic.UPTIME_RESULTS
    identifier = "uptime"

    def build_payload_grouping_key(self, result: CheckResult) -> str:
        return self.result_processor.get_subscription_id(result)
