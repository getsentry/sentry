from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_FAILURE,
    CHECKSTATUS_MISSED_WINDOW,
    CHECKSTATUS_SUCCESS,
    CheckResult,
)

from sentry import features
from sentry.conf.types.kafka_definition import Topic
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
)
from sentry.uptime.subscriptions.subscriptions import (
    create_uptime_subscription,
    delete_project_uptime_subscription,
    remove_uptime_subscription_if_unused,
)
from sentry.utils import metrics

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
AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL = timedelta(minutes=5)


def build_last_update_key(project_subscription: ProjectUptimeSubscription) -> str:
    return f"project-sub-last-update:{project_subscription.id}"


def build_onboarding_failure_key(project_subscription: ProjectUptimeSubscription) -> str:
    return f"project-sub-onboarding_failure:{project_subscription.id}"


class UptimeResultProcessor(ResultProcessor[CheckResult, UptimeSubscription]):
    subscription_model = UptimeSubscription
    topic_for_codec = Topic.UPTIME_RESULTS

    def get_subscription_id(self, result: CheckResult) -> str:
        return result["subscription_id"]

    def handle_result(self, subscription: UptimeSubscription | None, result: CheckResult):
        if subscription is None:
            # TODO: We probably want to want to publish a tombstone
            # subscription here
            metrics.incr("uptime.result_processor.subscription_not_found")
            return

        project_subscriptions = list(subscription.projectuptimesubscription_set.all())

        cluster = _get_cluster()
        last_updates: list[str | None] = cluster.mget(
            build_last_update_key(sub) for sub in project_subscriptions
        )

        for last_update_raw, project_subscription in zip(last_updates, project_subscriptions):
            last_update_ms = 0 if last_update_raw is None else int(last_update_raw)
            self.handle_result_for_project(project_subscription, result, last_update_ms)

        logger.info("process_result", extra=result)

    def handle_result_for_project(
        self,
        project_subscription: ProjectUptimeSubscription,
        result: CheckResult,
        last_update_ms: int,
    ):
        metric_tags = {
            "status": result["status"],
            "mode": ProjectUptimeSubscriptionMode(project_subscription.mode).name.lower(),
        }
        metrics.incr("uptime.result_processor.handle_result_for_project", tags=metric_tags)
        cluster = _get_cluster()
        try:
            if result["scheduled_check_time_ms"] <= last_update_ms:
                # If the scheduled check time is older than the most recent update then we've already processed it.
                # We can end up with duplicates due to Kafka replaying tuples, or due to the uptime checker processing
                # the same check multiple times and sending duplicate results.
                # We only ever want to process the first value related to each check, so we just skip and log here
                metrics.incr(
                    "uptime.result_processor.skipping_already_processed_update", tags=metric_tags
                )
                return

            if result["status"] == CHECKSTATUS_MISSED_WINDOW:
                logger.info(
                    "handle_result_for_project.missed",
                    extra={"project_id": project_subscription.project_id, **result},
                )

            if project_subscription.mode == ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING:
                self.handle_result_for_project_auto_onboarding_mode(project_subscription, result)
            elif project_subscription.mode in (
                ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
                ProjectUptimeSubscriptionMode.MANUAL,
            ):
                self.handle_result_for_project_active_mode(project_subscription, result)
        except Exception:
            logger.exception("Failed to process result for uptime project subscription")

        # Now that we've processed the result for this project subscription we track the last update date
        cluster.set(
            build_last_update_key(project_subscription),
            int(result["scheduled_check_time_ms"]),
            ex=LAST_UPDATE_REDIS_TTL,
        )

    def handle_result_for_project_auto_onboarding_mode(
        self, project_subscription: ProjectUptimeSubscription, result: CheckResult
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
                delete_project_uptime_subscription(
                    project_subscription.project,
                    project_subscription.uptime_subscription,
                    modes=[ProjectUptimeSubscriptionMode.AUTO_DETECTED_ONBOARDING],
                )
                # Mark the url as failed so that we don't attempt to auto-detect it for a while
                set_failed_url(project_subscription.uptime_subscription.url)
                redis.delete(key)
                metrics.incr("uptime.result_processor.autodetection.failed_onboarding")
        elif result["status"] == CHECKSTATUS_SUCCESS:
            assert project_subscription.date_added is not None
            scheduled_check_time = datetime.fromtimestamp(
                result["scheduled_check_time_ms"] / 1000, timezone.utc
            )
            if scheduled_check_time - ONBOARDING_MONITOR_PERIOD > project_subscription.date_added:
                # If we've had mostly successes throughout the onboarding period then we can graduate the subscription
                # to active.
                onboarding_subscription = project_subscription.uptime_subscription
                active_subscription = create_uptime_subscription(
                    onboarding_subscription.url,
                    int(AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL.total_seconds()),
                    onboarding_subscription.timeout_ms,
                )
                project_subscription.update(
                    uptime_subscription=active_subscription,
                    mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
                )
                remove_uptime_subscription_if_unused(onboarding_subscription)
                metrics.incr("uptime.result_processor.autodetection.graduated_onboarding")

    def handle_result_for_project_active_mode(
        self, project_subscription: ProjectUptimeSubscription, result: CheckResult
    ):
        if (
            project_subscription.uptime_status == UptimeStatus.OK
            and result["status"] == CHECKSTATUS_FAILURE
        ):
            if features.has(
                "organizations:uptime-create-issues", project_subscription.project.organization
            ):
                create_issue_platform_occurrence(result, project_subscription)
            project_subscription.update(uptime_status=UptimeStatus.FAILED)
        elif (
            project_subscription.uptime_status == UptimeStatus.FAILED
            and result["status"] == CHECKSTATUS_SUCCESS
        ):
            if features.has(
                "organizations:uptime-create-issues", project_subscription.project.organization
            ):
                resolve_uptime_issue(project_subscription)
            project_subscription.update(uptime_status=UptimeStatus.OK)


class UptimeResultsStrategyFactory(ResultsStrategyFactory[CheckResult, UptimeSubscription]):
    result_processor_cls = UptimeResultProcessor
