from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_FAILURE,
    CHECKSTATUS_SUCCESS,
    CheckResult,
)

from sentry.uptime.detectors.ranking import _get_cluster
from sentry.uptime.detectors.tasks import set_failed_url
from sentry.uptime.models import ProjectUptimeSubscription, get_detector
from sentry.uptime.subscriptions.subscriptions import (
    delete_uptime_detector,
    update_project_uptime_subscription,
)
from sentry.uptime.types import ProjectUptimeSubscriptionMode
from sentry.utils import metrics

logger = logging.getLogger(__name__)

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


def build_onboarding_failure_key(project_subscription: ProjectUptimeSubscription) -> str:
    return f"project-sub-onboarding_failure:{project_subscription.id}"


def handle_onboarding_result(
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
            if detector := get_detector(project_subscription.uptime_subscription):
                delete_uptime_detector(detector)
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
            update_project_uptime_subscription(
                project_subscription,
                interval_seconds=int(AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL.total_seconds()),
                mode=ProjectUptimeSubscriptionMode.AUTO_DETECTED_ACTIVE,
            )
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
