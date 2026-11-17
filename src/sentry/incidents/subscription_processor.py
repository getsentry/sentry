from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta
from typing import Any

from django.conf import settings
from sentry_redis_tools.retrying_cluster import RetryingRedisCluster

from sentry.constants import ObjectStatus
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.query_helpers import (
    coerce_aggregation_value,
    run_query_for_window,
)
from sentry.incidents.utils.subscription_limits import is_metric_subscription_allowed
from sentry.incidents.utils.types import (
    DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
    AnomalyDetectionUpdate,
    ProcessedSubscriptionUpdate,
    QuerySubscriptionUpdate,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.snuba.dataset import Dataset
from sentry.snuba.models import QuerySubscription
from sentry.utils import metrics, redis
from sentry.utils.dates import to_datetime
from sentry.utils.memory import track_memory_usage
from sentry.workflow_engine.generated_schema_types import MetricIssueDetectorConfig
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors import DetectorEvaluation
from sentry.workflow_engine.processors.data_packet import process_data_packet
from sentry.workflow_engine.types import DetectorGroupKey

logger = logging.getLogger(__name__)

REDIS_TTL = int(timedelta(days=7).total_seconds())
# Minimum sessions/users needed before crash rate detection will apply. Setting it to `None`
# disables it.
CRASH_RATE_ALERT_MINIMUM_THRESHOLD: int | None = None


class SubscriptionProcessor:
    """
    Class for processing subscription updates for workflow engine.
    Use the `process` classmethod as the entry point.
    """

    def __init__(self, subscription: QuerySubscription, detector: Detector) -> None:
        """
        Initialize with pre-validated subscription and detector.
        Use the `process` classmethod rather than calling this directly.
        """
        self.subscription = subscription
        self.detector = detector
        self.last_update = get_detector_last_update(detector, subscription.project_id)

    @classmethod
    def process(
        cls, subscription: QuerySubscription, subscription_update: QuerySubscriptionUpdate
    ) -> bool:
        """
        Entry point for processing a subscription update.
        Returns False if required objects don't exist or are invalid.
        """
        try:
            detector = Detector.objects.get(
                data_sources__source_id=str(subscription.id),
                data_sources__type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
            )
        except Detector.DoesNotExist:
            logger.info("Detector not found", extra={"subscription_id": subscription.id})
            metrics.incr(
                "incidents.subscription_processor.detector_lookup",
                tags={"found": "False"},
            )
            return False

        metrics.incr(
            "incidents.subscription_processor.detector_lookup",
            tags={"found": "True"},
        )

        # Fetch and cache Project
        try:
            project = Project.objects.get_from_cache(id=subscription.project_id)
            subscription.set_cached_field_value("project", project)
        except Project.DoesNotExist:
            metrics.incr("incidents.alert_rules.ignore_deleted_project")
            return False

        if project.status != ObjectStatus.ACTIVE:
            metrics.incr("incidents.alert_rules.ignore_deleted_project")
            return False

        # Fetch and cache Organization
        organization = Organization.objects.get_from_cache(id=project.organization_id)
        project.set_cached_field_value("organization", organization)

        # Create processor and run
        processor = cls(subscription, detector)
        return processor.process_update(subscription_update)

    def _get_crash_free_rate(self, raw_data: dict[str, Any]) -> float | None:
        """
        Get the crash free rate, which depending on the query either means the percentage of release
        health sessions without a crash or the percentage of users active in the time window with no
        crashed sessions. Returns None if there are no sessions (or too few, if the minimum
        threshold is set).
        """
        total_count = raw_data.get("count", 0)
        crash_count = raw_data.get("crashed", 0)

        if total_count == 0:
            metrics.incr("incidents.alert_rules.ignore_update_no_session_data")
            return None

        if (
            CRASH_RATE_ALERT_MINIMUM_THRESHOLD is not None
            and total_count < CRASH_RATE_ALERT_MINIMUM_THRESHOLD
        ):
            metrics.incr("incidents.alert_rules.ignore_update_count_lower_than_min_threshold")
            return None

        return round((1 - crash_count / total_count) * 100, 3)

    def _get_percent_detector_value(
        self, current_value: float, subscription_update: QuerySubscriptionUpdate
    ) -> float | None:
        """
        Calculate the ratio between the query's current value and its value for the time window
        `comparison_delta` seconds earlier. Expressed as a percentage (so a 200% increase results in
        a return value of 300, while a 75% decrease results in a return value of 25). Returns None
        if the baseline is invalid or 0.

        Note: Only the current value is included in the subscription update, so this requires a
        snuba query in order to get the baseline value.
        """
        detector_config: MetricIssueDetectorConfig = self.detector.config
        snuba_query = self.subscription.snuba_query

        baseline_window_end = subscription_update["timestamp"] - timedelta(
            seconds=detector_config["comparison_delta"]
        )
        baseline_window_start = baseline_window_end - timedelta(seconds=snuba_query.time_window)
        baseline_value = run_query_for_window(
            snuba_query=snuba_query,
            subscription_id=subscription_update["subscription_id"],
            org_id=self.subscription.project.organization.id,
            project_ids=[self.subscription.project_id],
            window_start=baseline_window_start,
            window_end=baseline_window_end,
            referrer="subscription_processor.comparison_query",
        )

        if not baseline_value:
            metrics.incr("incidents.alert_rules.skipping_update_comparison_value_invalid")
            return None

        return (current_value / baseline_value) * 100

    def get_evaluation_value(self, subscription_update: QuerySubscriptionUpdate) -> float | None:
        raw_data = subscription_update["values"]["data"][0]

        # This comes before the percent check, so a percent detector on the crash-rate dataset
        # (which the UI doesn't offer, but the API allows) runs as static
        if self.subscription.snuba_query.dataset == Dataset.Metrics.value:
            return self._get_crash_free_rate(raw_data)

        current_value = coerce_aggregation_value(
            list(raw_data.values())[0], none_defaults_to_zero=True
        )
        if current_value is None:
            return None

        if self.detector.config["detection_type"] == AlertRuleDetectionType.PERCENT.value:
            return self._get_percent_detector_value(current_value, subscription_update)

        # Static and dynamic detectors use the current value as is
        return current_value

    def process_results_workflow_engine(
        self,
        detector: Detector,
        subscription_update: QuerySubscriptionUpdate,
        evaluation_value: float,
    ) -> list[tuple[Detector, dict[DetectorGroupKey, DetectorEvaluation]]]:
        detector_cfg: MetricIssueDetectorConfig = detector.config
        if detector_cfg["detection_type"] == AlertRuleDetectionType.DYNAMIC.value:
            anomaly_detection_packet = AnomalyDetectionUpdate(
                entity=subscription_update.get("entity", ""),
                subscription_id=subscription_update["subscription_id"],
                values={
                    "value": evaluation_value,
                    "source_id": str(self.subscription.id),
                    "subscription_id": subscription_update["subscription_id"],
                    "timestamp": self.last_update,
                },
                timestamp=self.last_update,
            )
            anomaly_detection_data_packet = DataPacket[AnomalyDetectionUpdate](
                source_id=str(self.subscription.id), packet=anomaly_detection_packet
            )
            results = process_data_packet(
                anomaly_detection_data_packet, DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION
            )
        else:
            metric_packet = ProcessedSubscriptionUpdate(
                entity=subscription_update.get("entity", ""),
                subscription_id=subscription_update["subscription_id"],
                values={"value": evaluation_value},
                timestamp=self.last_update,
            )
            metric_data_packet = DataPacket[ProcessedSubscriptionUpdate](
                source_id=str(self.subscription.id), packet=metric_packet
            )
            results = process_data_packet(metric_data_packet, DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION)

        return results

    def process_update(self, subscription_update: QuerySubscriptionUpdate) -> bool:
        """
        Core processing method. Assumes subscription has cached project/organization and detector
        exists (enforced by the `process` classmethod).
        """
        dataset = self.subscription.snuba_query.dataset
        organization = self.subscription.project.organization

        if not is_metric_subscription_allowed(dataset, organization):
            metrics.incr(
                "incidents.alert_rules.ignore_update_not_enabled",
                tags={"dataset": dataset},
            )
            return False

        if subscription_update["timestamp"] <= self.last_update:
            metrics.incr("incidents.alert_rules.skipping_already_processed_update")
            return False

        self.last_update = subscription_update["timestamp"]

        if (
            len(subscription_update["values"]["data"]) > 1
            and self.subscription.snuba_query.dataset != Dataset.Metrics.value
        ):
            logger.warning(
                "Subscription returned more than 1 row of data",
                extra={
                    "subscription_id": self.subscription.id,
                    "dataset": self.subscription.snuba_query.dataset,
                    "snuba_subscription_id": self.subscription.subscription_id,
                    "result": subscription_update,
                },
            )

        with (
            metrics.timer("incidents.alert_rules.process_update"),
            track_memory_usage("incidents.alert_rules.process_update_memory"),
        ):
            metrics.incr("incidents.alert_rules.process_update.start")
            evaluation_value = self.get_evaluation_value(subscription_update)

            # `get_evaluation_value` already normalizes Snuba values to float | None
            if evaluation_value is None or math.isnan(evaluation_value):
                metrics.incr("incidents.alert_rules.skipping_update_invalid_aggregation_value")
                # We have an invalid aggregate, but we _did_ process the update, so we bump the last
                # update time to reflect that and avoid reprocessing
                store_detector_last_update(
                    self.detector, self.subscription.project.id, self.last_update
                )
                return False

            self.process_results_workflow_engine(
                self.detector, subscription_update, evaluation_value
            )
            # Ensure that we have last_update stored for all Detector evaluations.
            store_detector_last_update(
                self.detector, self.subscription.project.id, self.last_update
            )
            return True


def build_detector_last_update_key(detector: Detector, project_id: int) -> str:
    return f"detector:{detector.id}:project:{project_id}:last_update"


def get_detector_last_update(detector: Detector, project_id: int) -> datetime:
    return to_datetime(
        int(get_redis_client().get(build_detector_last_update_key(detector, project_id)) or "0")
    )


def store_detector_last_update(detector: Detector, project_id: int, last_update: datetime) -> None:
    get_redis_client().set(
        build_detector_last_update_key(detector, project_id),
        int(last_update.timestamp()),
        ex=REDIS_TTL,
    )


def get_redis_client() -> RetryingRedisCluster:
    cluster_key = settings.SENTRY_INCIDENT_RULES_REDIS_CLUSTER
    return redis.redis_clusters.get(cluster_key)  # type: ignore[return-value]
