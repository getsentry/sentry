from __future__ import annotations

import logging
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Literal

from sentry import features
from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.handlers.condition import *  # noqa
from sentry.incidents.metric_issue_detector import MetricIssueDetectorValidator
from sentry.incidents.models.alert_rule import AlertRuleDetectionType, ComparisonDeltaChoices
from sentry.incidents.utils.format_duration import format_duration_idiomatic
from sentry.incidents.utils.types import AnomalyDetectionUpdate, ProcessedSubscriptionUpdate
from sentry.integrations.metric_alerts import TEXT_COMPARISON_DELTA
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.models.organization import Organization
from sentry.ratelimits.sliding_windows import Quota
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics import format_mri_field, is_mri_field
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.types.actor import parse_and_validate_actor
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector import DetectorOccurrence, StatefulDetectorHandler
from sentry.workflow_engine.handlers.detector.base import EventData, EvidenceData
from sentry.workflow_engine.models.alertrule_detector import AlertRuleDetector
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.processors.data_condition_group import ProcessedDataConditionGroup
from sentry.workflow_engine.types import DetectorException, DetectorPriorityLevel, DetectorSettings

logger = logging.getLogger(__name__)

COMPARISON_DELTA_CHOICES: list[None | int] = [choice.value for choice in ComparisonDeltaChoices]
COMPARISON_DELTA_CHOICES.append(None)

QUERY_AGGREGATION_DISPLAY = {
    "count()": "Number of events",
    "count_unique(tags[sentry:user])": "Number of users affected",
    "percentage(sessions_crashed, sessions)": "Crash free session rate",
    "percentage(users_crashed, users)": "Crash free user rate",
    "failure_rate()": "Failure rate",
    "apdex()": "Apdex score",
}


MetricUpdate = ProcessedSubscriptionUpdate | AnomalyDetectionUpdate
MetricResult = float | dict


@dataclass
class MetricIssueEvidenceData(EvidenceData[MetricResult]):
    alert_id: int


class SessionsAggregate(StrEnum):
    CRASH_FREE_SESSIONS = "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate"
    CRASH_FREE_USERS = "percentage(users_crashed, users) AS _crash_rate_alert_aggregate"


# Define all possible alert type values as a literal type
MetricAlertType = Literal[
    "num_errors",
    "users_experiencing_errors",
    "throughput",
    "trans_duration",
    "apdex",
    "failure_rate",
    "lcp",
    "fid",
    "cls",
    "crash_free_sessions",
    "crash_free_users",
    "trace_item_throughput",
    "trace_item_duration",
    "trace_item_apdex",
    "trace_item_failure_rate",
    "trace_item_lcp",
    "custom_transactions",
    "eap_metrics",
]

AggregateIdentifier = Literal[
    "count()",
    "count_unique(user)",
    "transaction.duration",
    "apdex",
    "failure_rate()",
    "measurements.lcp",
    "measurements.fid",
    "measurements.cls",
    "percentage(sessions_crashed, sessions) AS _crash_rate_alert_aggregate",
    "percentage(users_crashed, users) AS _crash_rate_alert_aggregate",
    "count(span.duration)",
    "span.duration",
]

ALERT_TYPE_IDENTIFIERS: dict[Dataset, dict[MetricAlertType, AggregateIdentifier]] = {
    Dataset.Events: {"num_errors": "count()", "users_experiencing_errors": "count_unique(user)"},
    Dataset.Transactions: {
        "throughput": "count()",
        "trans_duration": "transaction.duration",
        "apdex": "apdex",
        "failure_rate": "failure_rate()",
        "lcp": "measurements.lcp",
        "fid": "measurements.fid",
        "cls": "measurements.cls",
    },
    Dataset.PerformanceMetrics: {
        "throughput": "count()",
        "trans_duration": "transaction.duration",
        "apdex": "apdex",
        "failure_rate": "failure_rate()",
        "lcp": "measurements.lcp",
        "fid": "measurements.fid",
        "cls": "measurements.cls",
    },
    Dataset.Sessions: {
        "crash_free_sessions": SessionsAggregate.CRASH_FREE_SESSIONS.value,
        "crash_free_users": SessionsAggregate.CRASH_FREE_USERS.value,
    },
    Dataset.Metrics: {
        "crash_free_sessions": SessionsAggregate.CRASH_FREE_SESSIONS.value,
        "crash_free_users": SessionsAggregate.CRASH_FREE_USERS.value,
    },
    Dataset.EventsAnalyticsPlatform: {
        "trace_item_throughput": "count(span.duration)",
        "trace_item_duration": "span.duration",
        "trace_item_apdex": "apdex",
        "trace_item_failure_rate": "failure_rate()",
        "trace_item_lcp": "measurements.lcp",
    },
}


def get_alert_type_from_aggregate_dataset(
    aggregate: str, dataset: Dataset, organization: Organization | None = None
) -> MetricAlertType:
    """
    Given an aggregate and dataset object, will return the corresponding wizard alert type
    e.g. {'aggregate': 'count()', 'dataset': Dataset.ERRORS} will yield 'num_errors'

    This function is used to format the aggregate value for anomaly detection issues.
    """
    identifier_for_dataset = ALERT_TYPE_IDENTIFIERS.get(dataset, {})

    # Find matching alert type entry
    matching_alert_type: MetricAlertType | None = None
    for alert_type, identifier in identifier_for_dataset.items():
        if identifier in aggregate:
            matching_alert_type = alert_type
            break

    # Special handling for EventsAnalyticsPlatform dataset
    if dataset == Dataset.EventsAnalyticsPlatform:
        if organization and features.has(
            "organizations:discover-saved-queries-deprecation", organization
        ):
            return matching_alert_type if matching_alert_type else "eap_metrics"

        return "eap_metrics"

    return matching_alert_type if matching_alert_type else "custom_transactions"


class MetricIssueDetectorHandler(StatefulDetectorHandler[MetricUpdate, MetricResult]):
    def build_detector_evidence_data(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[MetricUpdate],
        priority: DetectorPriorityLevel,
    ) -> dict[str, Any]:

        try:
            alert_rule_detector = AlertRuleDetector.objects.get(detector=self.detector)
            return {"alert_id": alert_rule_detector.alert_rule_id}
        except AlertRuleDetector.DoesNotExist:
            logger.warning(
                "No alert rule detector found for detector id %s",
                self.detector.id,
                extra={
                    "detector_id": self.detector.id,
                },
            )
            return {"alert_id": None}

    def create_occurrence(
        self,
        evaluation_result: ProcessedDataConditionGroup,
        data_packet: DataPacket[MetricUpdate],
        priority: DetectorPriorityLevel,
    ) -> tuple[DetectorOccurrence, EventData]:
        try:
            detector_trigger = DataCondition.objects.get(
                condition_group=self.detector.workflow_condition_group, condition_result=priority
            )
        except DataCondition.DoesNotExist:
            raise DetectorException(
                f"Failed to find detector trigger for detector id {self.detector.id}, cannot create metric issue occurrence"
            )

        try:
            query_subscription = QuerySubscription.objects.get(id=data_packet.source_id)
        except QuerySubscription.DoesNotExist:
            raise DetectorException(
                f"Failed to find query subscription for detector id {self.detector.id}, cannot create metric issue occurrence"
            )

        try:
            snuba_query = SnubaQuery.objects.get(id=query_subscription.snuba_query_id)
        except SnubaQuery.DoesNotExist:
            raise DetectorException(
                f"Failed to find snuba query for detector id {self.detector.id}, cannot create metric issue occurrence"
            )

        try:
            owner = self.detector.owner.identifier if self.detector.owner else None
            assignee = parse_and_validate_actor(owner, self.detector.project.organization_id)
        except Exception:
            logger.exception("Failed to parse assignee for detector id %s", self.detector.id)
            assignee = None

        return (
            DetectorOccurrence(
                issue_title=self.detector.name,
                subtitle=self.construct_title(snuba_query, detector_trigger, priority),
                evidence_data={
                    **self.build_detector_evidence_data(evaluation_result, data_packet, priority),
                },
                evidence_display=[],  # XXX: may need to pass more info here for the front end
                type=MetricIssue,
                level="error",
                culprit="",
                assignee=assignee,
                priority=priority,
            ),
            {},
        )

    def extract_dedupe_value(self, data_packet: DataPacket[MetricUpdate]) -> int:
        return int(data_packet.packet.timestamp.timestamp())

    def extract_value(self, data_packet: DataPacket[MetricUpdate]) -> MetricResult:
        # this is a bit of a hack - anomaly detection data packets send extra data we need to pass along
        values = data_packet.packet.values
        if isinstance(data_packet.packet, AnomalyDetectionUpdate):
            return {None: values}
        return values.get("value")

    def construct_title(
        self,
        snuba_query: SnubaQuery,
        detector_trigger: DataCondition,
        priority: DetectorPriorityLevel,
    ) -> str:
        comparison_delta = self.detector.config.get("comparison_delta")
        detection_type = self.detector.config.get("detection_type")
        agg_display_key = snuba_query.aggregate

        if is_mri_field(agg_display_key):
            aggregate = format_mri_field(agg_display_key)
        elif CRASH_RATE_ALERT_AGGREGATE_ALIAS in agg_display_key:
            agg_display_key = agg_display_key.split(f"AS {CRASH_RATE_ALERT_AGGREGATE_ALIAS}")[
                0
            ].strip()
            aggregate = QUERY_AGGREGATION_DISPLAY.get(agg_display_key, agg_display_key)
        else:
            aggregate = QUERY_AGGREGATION_DISPLAY.get(agg_display_key, agg_display_key)

        if detection_type == "dynamic":
            alert_type = aggregate
            try:
                dataset = Dataset(snuba_query.dataset)
                alert_type = get_alert_type_from_aggregate_dataset(
                    agg_display_key, dataset, self.detector.project.organization
                )
            except ValueError:
                logger.exception(
                    "Failed to get alert type from aggregate and dataset",
                    extra={
                        "aggregate": aggregate,
                        "dataset": snuba_query.dataset,
                        "detector_id": self.detector.id,
                    },
                )

            return f"Detected an anomaly in the query for {alert_type}"

        # Determine the higher or lower comparison
        higher_or_lower = ""
        if detector_trigger.type == Condition.GREATER:
            higher_or_lower = "greater than" if comparison_delta else "above"
        else:
            higher_or_lower = "less than" if comparison_delta else "below"

        label = "Warning" if priority == DetectorPriorityLevel.MEDIUM else "Critical"

        # Format the time window for the threshold
        time_window = format_duration_idiomatic(snuba_query.time_window // 60)

        # If the detector_trigger has a comparison delta, format the comparison string
        comparison: str | int | float = "threshold"
        if comparison_delta:
            comparison_delta_minutes = comparison_delta // 60
            comparison = TEXT_COMPARISON_DELTA.get(
                comparison_delta_minutes, f"same time {comparison_delta_minutes} minutes ago "
            )
        else:
            comparison = detector_trigger.comparison

        template = "{label}: {metric} in the last {time_window} {higher_or_lower} {comparison}"
        return template.format(
            label=label.capitalize(),
            metric=aggregate,
            higher_or_lower=higher_or_lower,
            comparison=comparison,
            time_window=time_window,
        )


@dataclass(frozen=True)
class MetricIssue(GroupType):
    type_id = 8001
    slug = "metric_issue"
    description = "Metric issue triggered"
    category = GroupCategory.METRIC_ALERT.value
    category_v2 = GroupCategory.METRIC.value
    creation_quota = Quota(3600, 60, 100)
    default_priority = PriorityLevel.HIGH
    enable_auto_resolve = False
    enable_escalation_detection = False
    enable_status_change_workflow_notifications = False
    enable_workflow_notifications = False
    enable_user_status_and_priority_changes = False
    detector_settings = DetectorSettings(
        handler=MetricIssueDetectorHandler,
        validator=MetricIssueDetectorValidator,
        config_schema={
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "A representation of a metric detector config dict",
            "type": "object",
            "required": ["detection_type"],
            "properties": {
                "comparison_delta": {
                    "type": ["integer", "null"],
                    "enum": COMPARISON_DELTA_CHOICES,
                },
                "detection_type": {
                    "type": "string",
                    "enum": [detection_type.value for detection_type in AlertRuleDetectionType],
                },
            },
        },
    )

    @classmethod
    def allow_ingest(cls, organization: Organization) -> bool:
        return True

    @classmethod
    def allow_post_process_group(cls, organization: Organization) -> bool:
        return True

    @classmethod
    def build_visible_feature_name(cls) -> str:
        return "organizations:workflow-engine-ui"
