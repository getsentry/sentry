from __future__ import annotations

import logging
from typing import Any

from sentry.constants import CRASH_RATE_ALERT_AGGREGATE_ALIAS
from sentry.incidents.grouptype import (
    COMPARISON_DELTA_CHOICES,
    QUERY_AGGREGATION_DISPLAY,
    MetricIssue,
    MetricResult,
    MetricUpdate,
    get_alert_type_from_aggregate_dataset,
)
from sentry.incidents.metric_issue_detector import MetricIssueDetectorValidator
from sentry.incidents.models.alert_rule import AlertRuleDetectionType
from sentry.incidents.utils.format_duration import format_duration_idiomatic
from sentry.incidents.utils.types import AnomalyDetectionUpdate
from sentry.integrations.metric_alerts import TEXT_COMPARISON_DELTA
from sentry.snuba.dataset import Dataset
from sentry.snuba.metrics import format_mri_field, is_mri_field
from sentry.snuba.models import QuerySubscription, SnubaQuery
from sentry.types.actor import parse_and_validate_actor
from sentry.workflow_engine.handlers.detector import DetectorOccurrence, StatefulDetectorHandler
from sentry.workflow_engine.handlers.detector.base import EventData
from sentry.workflow_engine.models.alertrule_detector import AlertRuleDetector
from sentry.workflow_engine.models.data_condition import Condition, DataCondition
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.processors.data_condition_group import ProcessedDataConditionGroup
from sentry.workflow_engine.types import (
    DetectorException,
    DetectorGroupKey,
    DetectorPriorityLevel,
    DetectorSettings,
    DetectorType,
    detector_settings_registry,
)

logger = logging.getLogger(__name__)


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

    def extract_value(
        self, data_packet: DataPacket[MetricUpdate]
    ) -> MetricResult | dict[DetectorGroupKey, MetricResult]:
        if isinstance(data_packet.packet, AnomalyDetectionUpdate):
            # A bare AnomalyDetectionValues dict would be interpreted as a grouped
            # result dict, so wrap it with an explicit group key.
            grouped: dict[DetectorGroupKey, MetricResult] = {None: data_packet.packet.values}
            return grouped
        return data_packet.packet.values["value"]

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


detector_settings_registry.register(
    DetectorType.METRIC_ISSUE,
    DetectorSettings(
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
    ),
)
