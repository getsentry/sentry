from __future__ import annotations
from typing import int

import logging
from datetime import datetime, timedelta, timezone

from sentry_kafka_schemas.schema_types.uptime_results_v1 import (
    CHECKSTATUS_FAILURE,
    CHECKSTATUS_SUCCESS,
    CheckResult,
)

from sentry import audit_log
from sentry.uptime.autodetect.notifications import send_auto_detected_notifications
from sentry.uptime.autodetect.tasks import set_failed_url
from sentry.uptime.models import UptimeSubscription, get_audit_log_data
from sentry.uptime.subscriptions.subscriptions import (
    UptimeMonitorNoSeatAvailable,
    delete_uptime_detector,
    update_uptime_detector,
)
from sentry.uptime.types import UptimeMonitorMode
from sentry.uptime.utils import get_cluster
from sentry.utils import metrics
from sentry.utils.audit import create_system_audit_entry
from sentry.workflow_engine.models.detector import Detector

logger = logging.getLogger(__name__)

ONBOARDING_MONITOR_PERIOD = timedelta(days=3)

# When onboarding a new subscription how many total failures are allowed to happen during
# the ONBOARDING_MONITOR_PERIOD before we consider the subscription to have failed onboarding.
ONBOARDING_FAILURE_THRESHOLD = 3

# The TTL of the redis key used to track the failure counts for a subscription in
# `UptimeMonitorMode.AUTO_DETECTED_ONBOARDING` mode. Must be >= the
# ONBOARDING_MONITOR_PERIOD.
ONBOARDING_FAILURE_REDIS_TTL = ONBOARDING_MONITOR_PERIOD

# How frequently we should run active auto-detected subscriptions
AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL = timedelta(minutes=1)


def build_onboarding_failure_key(detector: Detector) -> str:
    return f"project-sub-onboarding_failure:detector:{detector.id}"


def handle_onboarding_result(
    detector: Detector,
    uptime_subscription: UptimeSubscription,
    result: CheckResult,
    metric_tags: dict[str, str],
) -> None:
    if result["status"] == CHECKSTATUS_FAILURE:
        redis = get_cluster()
        key = build_onboarding_failure_key(detector)
        pipeline = redis.pipeline()
        pipeline.incr(key)
        pipeline.expire(key, ONBOARDING_FAILURE_REDIS_TTL)
        failure_count = pipeline.execute()[0]
        if failure_count >= ONBOARDING_FAILURE_THRESHOLD:
            # If we've hit too many failures during the onboarding period we stop monitoring
            delete_uptime_detector(detector)
            # Mark the url as failed so that we don't attempt to autodetect it for a while
            set_failed_url(uptime_subscription.url)
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
                    "project_id": detector.project_id,
                    "url": uptime_subscription.url,
                    **result,
                },
            )
    elif result["status"] == CHECKSTATUS_SUCCESS:
        assert detector.date_added is not None
        scheduled_check_time = datetime.fromtimestamp(
            result["scheduled_check_time_ms"] / 1000, timezone.utc
        )
        if scheduled_check_time - ONBOARDING_MONITOR_PERIOD > detector.date_added:
            # If we've had mostly successes throughout the onboarding period then we can graduate the subscription
            # to active.
            try:
                update_uptime_detector(
                    detector,
                    interval_seconds=int(
                        AUTO_DETECTED_ACTIVE_SUBSCRIPTION_INTERVAL.total_seconds()
                    ),
                    mode=UptimeMonitorMode.AUTO_DETECTED_ACTIVE,
                    ensure_assignment=True,
                )
            except UptimeMonitorNoSeatAvailable:
                # If we're out of seats, we should just delete this detector so that we don't keep attempting
                # to process it
                delete_uptime_detector(detector)
                metrics.incr(
                    "uptime.result_processor.autodetection.graduated_onboarding_no_seat",
                    tags={**metric_tags},
                    sample_rate=1.0,
                )
                logger.info(
                    "uptime_onboarding_graduated_no_seat",
                    extra={
                        "project_id": detector.project_id,
                        "url": uptime_subscription.url,
                        **result,
                    },
                )
                return
            create_system_audit_entry(
                organization=detector.project.organization,
                target_object=detector.id,
                event=audit_log.get_event_id("UPTIME_MONITOR_ADD"),
                data=get_audit_log_data(detector),
            )

            send_auto_detected_notifications.delay(detector.id)

            metrics.incr(
                "uptime.result_processor.autodetection.graduated_onboarding",
                sample_rate=1.0,
                tags=metric_tags,
            )
            logger.info(
                "uptime_onboarding_graduated",
                extra={
                    "project_id": detector.project_id,
                    "url": uptime_subscription.url,
                    **result,
                },
            )
