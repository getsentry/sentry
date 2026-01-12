from __future__ import annotations

import logging
import math
from datetime import datetime, timedelta
from typing import Literal, TypedDict, TypeVar

from django.conf import settings
from sentry_redis_tools.retrying_cluster import RetryingRedisCluster

from sentry import features
from sentry.constants import ObjectStatus
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.process_update_helpers import (
    get_comparison_aggregation_value,
    get_crash_rate_alert_metrics_aggregation_value_helper,
)
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
from sentry.workflow_engine.models import DataPacket, Detector
from sentry.workflow_engine.processors.data_packet import process_data_packet
from sentry.workflow_engine.types import DetectorEvaluationResult, DetectorGroupKey

logger = logging.getLogger(__name__)
REDIS_TTL = int(timedelta(days=7).total_seconds())
# Stores a minimum threshold that represents a session count under which we don't evaluate crash
# rate alert, and the update is just dropped. If it is set to None, then no minimum threshold
# check is applied
# ToDo(ahmed): This is still experimental. If we decide that it makes sense to keep this
#  functionality, then maybe we should move this to constants
CRASH_RATE_ALERT_MINIMUM_THRESHOLD: int | None = None

T = TypeVar("T")


class MetricIssueDetectorConfig(TypedDict):
    """
    Schema for Metric Issue Detector.config.
    """

    comparison_delta: int | None
    detection_type: Literal["static", "percent", "dynamic"]


class SubscriptionProcessor:
    """
    Class for processing subscription updates for workflow engine. Accepts a subscription
    and then can process one or more updates via `process_update`.
    """

    def __init__(self, subscription: QuerySubscription) -> None:
        self.subscription = subscription
        self.detector: Detector | None = None
        self.last_update = to_datetime(0)

        detector_ids = Detector.get_detector_ids_by_data_source(
            source_id=str(self.subscription.id),
            source_type=DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION,
        )
        if not detector_ids:
            logger.info("Detector not found", extra={"subscription_id": self.subscription.id})
            self.detector = None
        else:
            self.detector = Detector.objects.get(id=detector_ids[0])
            self.last_update = get_detector_last_update(self.detector, self.subscription.project_id)

    def get_crash_rate_alert_metrics_aggregation_value(
        self, subscription_update: QuerySubscriptionUpdate
    ) -> float | None:
        """
        Handles validation and extraction of Crash Rate Alerts subscription updates values over
        metrics dataset.
        The subscription update looks like
        [
            {'project_id': 8, 'tags[5]': 6, 'count': 2.0, 'crashed': 1.0}
        ]
        - `count` represents sessions or users sessions that were started, hence to get the crash
        free percentage, we would need to divide number of crashed sessions by that number,
        and subtract that value from 1. This is also used when CRASH_RATE_ALERT_MINIMUM_THRESHOLD is
        set in the sense that if the minimum threshold is greater than the session count,
        then the update is dropped. If the minimum threshold is not set then the total sessions
        count is just ignored
        - `crashed` represents the total sessions or user counts that crashed.
        """
        aggregation_value = get_crash_rate_alert_metrics_aggregation_value_helper(
            subscription_update
        )
        return aggregation_value

    def get_aggregation_value(
        self, subscription_update: QuerySubscriptionUpdate, comparison_delta: int | None = None
    ) -> float | None:
        if self.subscription.snuba_query.dataset == Dataset.Metrics.value:
            aggregation_value = self.get_crash_rate_alert_metrics_aggregation_value(
                subscription_update
            )
        else:
            aggregation_value = get_comparison_aggregation_value(
                subscription_update=subscription_update,
                snuba_query=self.subscription.snuba_query,
                organization_id=self.subscription.project.organization.id,
                project_ids=[self.subscription.project_id],
                comparison_delta=comparison_delta,
                alert_rule_id=None,
            )

        return aggregation_value

    def get_comparison_delta(self, detector: Detector | None) -> int | None:
        if detector:
            detector_cfg: MetricIssueDetectorConfig = detector.config
            return detector_cfg.get("comparison_delta")
        return None

    def process_results_workflow_engine(
        self,
        detector: Detector,
        subscription_update: QuerySubscriptionUpdate,
        aggregation_value: float,
    ) -> list[tuple[Detector, dict[DetectorGroupKey, DetectorEvaluationResult]]]:
        detector_cfg: MetricIssueDetectorConfig = detector.config
        if detector_cfg["detection_type"] == AlertRuleDetectionType.DYNAMIC.value:
            anomaly_detection_packet = AnomalyDetectionUpdate(
                entity=subscription_update.get("entity", ""),
                subscription_id=subscription_update["subscription_id"],
                values={
                    "value": aggregation_value,
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
                values={"value": aggregation_value},
                timestamp=self.last_update,
            )
            metric_data_packet = DataPacket[ProcessedSubscriptionUpdate](
                source_id=str(self.subscription.id), packet=metric_packet
            )
            results = process_data_packet(metric_data_packet, DATA_SOURCE_SNUBA_QUERY_SUBSCRIPTION)

        if features.has(
            "organizations:workflow-engine-metric-alert-dual-processing-logs",
            self.subscription.project.organization,
        ):
            logger.info(
                "incidents.workflow_engine.results",
                extra={
                    "results": results,
                    "num_results": len(results),
                    "value": aggregation_value,
                    "detector_id": detector.id,
                    "subscription_update": subscription_update,
                },
            )
        return results

    def has_downgraded(self, dataset: str, organization: Organization) -> bool:
        """
        Check if the organization has downgraded since the subscription was created, return early if True
        """
        if dataset == "events" and not features.has("organizations:incidents", organization):
            metrics.incr("incidents.alert_rules.ignore_update_missing_incidents")
            return True

        elif dataset == "transactions" and not features.has(
            "organizations:performance-view", organization
        ):
            metrics.incr("incidents.alert_rules.ignore_update_missing_incidents_performance")
            return True

        elif dataset == "generic_metrics" and not features.has(
            "organizations:on-demand-metrics-extraction", organization
        ):
            metrics.incr("incidents.alert_rules.ignore_update_missing_on_demand")
            return True

        return False

    def process_update(self, subscription_update: QuerySubscriptionUpdate) -> bool:
        """
        This is the core processing method utilized when Query Subscription Consumer fetches updates from kafka
        """
        dataset = self.subscription.snuba_query.dataset
        try:
            # Check that the project exists
            self.subscription.set_cached_field_value(
                "project",
                Project.objects.get_from_cache(id=self.subscription.project_id),
            )
        except Project.DoesNotExist:
            metrics.incr("incidents.alert_rules.ignore_deleted_project")
            return False
        if self.subscription.project.status != ObjectStatus.ACTIVE:
            metrics.incr("incidents.alert_rules.ignore_deleted_project")
            return False

        self.subscription.project.set_cached_field_value(
            "organization",
            Organization.objects.get_from_cache(id=self.subscription.project.organization_id),
        )

        organization = self.subscription.project.organization

        if self.has_downgraded(dataset, organization):
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

        comparison_delta = None
        with (
            metrics.timer("incidents.alert_rules.process_update"),
            track_memory_usage("incidents.alert_rules.process_update_memory"),
        ):
            metrics.incr("incidents.alert_rules.process_update.start")
            if self.detector is None:
                logger.error(
                    "No detector found for subscription, skipping subscription processing",
                    extra={
                        "subscription_id": self.subscription.id,
                        "project_id": self.subscription.project.id,
                    },
                )
                return False

            comparison_delta = self.get_comparison_delta(self.detector)
            aggregation_value = self.get_aggregation_value(subscription_update, comparison_delta)

            if aggregation_value is None or math.isnan(aggregation_value):
                metrics.incr("incidents.alert_rules.skipping_update_invalid_aggregation_value")
                # We have an invalid aggregate, but we _did_ process the update, so we store
                # last_update to reflect that and avoid reprocessing.
                store_detector_last_update(
                    self.detector, self.subscription.project.id, self.last_update
                )
                return False

            self.process_results_workflow_engine(
                self.detector, subscription_update, aggregation_value
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
