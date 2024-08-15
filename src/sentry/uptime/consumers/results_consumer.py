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
    delete_uptime_subscriptions_for_project,
    remove_uptime_subscription_if_unused,
)
from sentry.uptime.subscriptions.tasks import send_uptime_config_deletion
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
AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL = timedelta(minutes=1)
# When in active monitoring mode, how many failures in a row do we need to see to mark the monitor as down, or how many
# successes in a row do we need to mark it up
ACTIVE_FAILURE_THRESHOLD = 3
ACTIVE_RECOVERY_THRESHOLD = 1
# The TTL of the redis key used to track consecutive statuses
ACTIVE_THRESHOLD_REDIS_TTL = timedelta(minutes=60)


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
    topic_for_codec = Topic.UPTIME_RESULTS

    def get_subscription_id(self, result: CheckResult) -> str:
        return result["subscription_id"]

    def handle_result(self, subscription: UptimeSubscription | None, result: CheckResult):
        logger.info("process_result", extra=result)

        if subscription is None:
            # If no subscription in the Postgres, this subscription has been orphaned. Remove
            # from the checker
            send_uptime_config_deletion(result["subscription_id"])
            metrics.incr("uptime.result_processor.subscription_not_found", sample_rate=1.0)
            return

        project_subscriptions = list(subscription.projectuptimesubscription_set.all())

        cluster = _get_cluster()
        last_updates: list[str | None] = cluster.mget(
            build_last_update_key(sub) for sub in project_subscriptions
        )

        for last_update_raw, project_subscription in zip(last_updates, project_subscriptions):
            last_update_ms = 0 if last_update_raw is None else int(last_update_raw)
            self.handle_result_for_project(project_subscription, result, last_update_ms)

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

        status_reason = "none"
        if result["status_reason"]:
            status_reason = result["status_reason"]["type"]

        metrics.incr(
            "uptime.result_processor.handle_result_for_project",
            tags={"status_reason": status_reason, **metric_tags},
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
                    tags=metric_tags,
                    sample_rate=1.0,
                )
                return

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
                    )
                metrics.distribution(
                    "uptime.result_processor.check_result.delay",
                    result["actual_check_time_ms"] - result["scheduled_check_time_ms"],
                    sample_rate=1.0,
                    unit="millisecond",
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
        cluster = _get_cluster()
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
                    tags={"failure_reason": status_reason},
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
                metrics.incr(
                    "uptime.result_processor.autodetection.graduated_onboarding", sample_rate=1.0
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
        self, project_subscription: ProjectUptimeSubscription, result: CheckResult
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
            if not self.has_reached_status_threshold(project_subscription, result["status"]):
                return

            if features.has(
                "organizations:uptime-create-issues", project_subscription.project.organization
            ):
                create_issue_platform_occurrence(result, project_subscription)
                metrics.incr("uptime.result_processor.active.sent_occurrence", sample_rate=1.0)
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
            if not self.has_reached_status_threshold(project_subscription, result["status"]):
                return

            if features.has(
                "organizations:uptime-create-issues", project_subscription.project.organization
            ):
                resolve_uptime_issue(project_subscription)
                metrics.incr("uptime.result_processor.active.resolved", sample_rate=1.0)
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
        self, project_subscription: ProjectUptimeSubscription, status: str
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
                tags={"status": status},
            )
        return result


class UptimeResultsStrategyFactory(ResultsStrategyFactory[CheckResult, UptimeSubscription]):
    result_processor_cls = UptimeResultProcessor
