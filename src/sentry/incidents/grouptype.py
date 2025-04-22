from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sentry import features
from sentry.incidents.metric_alert_detector import MetricAlertsDetectorValidator
from sentry.incidents.models.alert_rule import AlertRuleDetectionType, ComparisonDeltaChoices
from sentry.incidents.utils.types import MetricDetectorUpdate, QuerySubscriptionUpdate
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.models.organization import Organization
from sentry.ratelimits.sliding_windows import Quota
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector import DetectorOccurrence, StatefulDetectorHandler
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.types import DetectorGroupKey, DetectorSettings

COMPARISON_DELTA_CHOICES: list[None | int] = [choice.value for choice in ComparisonDeltaChoices]
COMPARISON_DELTA_CHOICES.append(None)


class MetricAlertDetectorHandler(StatefulDetectorHandler[QuerySubscriptionUpdate]):
    def build_occurrence_and_event_data(
        self, group_key: DetectorGroupKey, new_status: PriorityLevel
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:
        # Returning a placeholder for now, this may require us passing more info
        occurrence = DetectorOccurrence(
            issue_title="Some Issue Title",
            subtitle="An Issue Subtitle",
            type=MetricAlertFire,
            level="error",
            culprit="Some culprit",
        )
        return occurrence, {}

    @property
    def counter_names(self) -> list[str]:
        # Placeholder for now, this should be a list of counters that we want to update as we go above warning / critical
        return []

    def get_dedupe_value(self, data_packet: DataPacket[QuerySubscriptionUpdate]) -> int:
        return int(data_packet.packet.get("timestamp", datetime.now(UTC)).timestamp())

    def get_group_key_values(
        self, data_packet: DataPacket[MetricDetectorUpdate]
    ) -> dict[DetectorGroupKey, int]:
        return {None: data_packet.packet["values"]["value"]}


# Example GroupType and detector handler for metric alerts. We don't create these issues yet, but we'll use something
# like these when we're sending issues as alerts
@dataclass(frozen=True)
class MetricAlertFire(GroupType):
    type_id = 8001
    slug = "metric_alert_fire"
    description = "Metric alert fired"
    category = GroupCategory.METRIC_ALERT.value
    category_v2 = GroupCategory.PERFORMANCE_REGRESSION.value
    creation_quota = Quota(3600, 60, 100)
    default_priority = PriorityLevel.HIGH
    enable_auto_resolve = False
    enable_escalation_detection = False
    detector_settings = DetectorSettings(
        handler=MetricAlertDetectorHandler,
        validator=MetricAlertsDetectorValidator,
        config_schema={
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "description": "A representation of a metric alert firing",
            "type": "object",
            "required": ["threshold_period", "detection_type"],
            "properties": {
                "threshold_period": {"type": "integer", "minimum": 1, "maximum": 20},
                "comparison_delta": {
                    "type": ["integer", "null"],
                    "enum": COMPARISON_DELTA_CHOICES,
                },
                "detection_type": {
                    "type": "string",
                    "enum": [detection_type.value for detection_type in AlertRuleDetectionType],
                },
                "sensitivity": {"type": ["string", "null"]},
                "seasonality": {"type": ["string", "null"]},
            },
        },
    )

    @classmethod
    def allow_post_process_group(cls, organization: Organization) -> bool:
        return features.has("organizations:workflow-engine-metric-alert-processing", organization)
