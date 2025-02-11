from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sentry import features
from sentry.incidents.models.alert_rule import AlertRuleDetectionType, ComparisonDeltaChoices
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.organization import Organization
from sentry.ratelimits.sliding_windows import Quota
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.endpoints.validators.metric_alert_detector import (
    MetricAlertsDetectorValidator,
)
from sentry.workflow_engine.handlers.detector import StatefulDetectorHandler
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.types import DetectorGroupKey

COMPARISON_DELTA_CHOICES: list[None | int] = [choice.value for choice in ComparisonDeltaChoices]
COMPARISON_DELTA_CHOICES.append(None)


class MetricAlertDetectorHandler(StatefulDetectorHandler[QuerySubscriptionUpdate]):
    def build_occurrence_and_event_data(
        self, group_key: DetectorGroupKey, value: int, new_status: PriorityLevel
    ) -> tuple[IssueOccurrence, dict[str, Any]]:
        # Returning a placeholder for now, this may require us passing more info

        occurrence = IssueOccurrence(
            id=str(uuid4()),
            project_id=self.detector.project_id,
            event_id=str(uuid4()),
            fingerprint=self.build_fingerprint(group_key),
            issue_title="Some Issue",
            subtitle="Some subtitle",
            resource_id=None,
            evidence_data={"detector_id": self.detector.id, "value": value},
            evidence_display=[],
            type=MetricAlertFire,
            detection_time=datetime.now(UTC),
            level="error",
            culprit="Some culprit",
            initial_issue_priority=new_status.value,
        )
        event_data = {
            "timestamp": occurrence.detection_time,
            "project_id": occurrence.project_id,
            "event_id": occurrence.event_id,
            "platform": "python",
            "received": occurrence.detection_time,
            "tags": {},
        }
        return occurrence, event_data

    @property
    def counter_names(self) -> list[str]:
        # Placeholder for now, this should be a list of counters that we want to update as we go above warning / critical
        return []

    def get_dedupe_value(self, data_packet: DataPacket[QuerySubscriptionUpdate]) -> int:
        return int(data_packet.packet.get("timestamp", datetime.now(UTC)).timestamp())

    def get_group_key_values(
        self, data_packet: DataPacket[QuerySubscriptionUpdate]
    ) -> dict[DetectorGroupKey, int]:
        # This is for testing purposes, we'll need to update the values inspected.
        return {None: data_packet.packet["values"]["foo"]}


# Example GroupType and detector handler for metric alerts. We don't create these issues yet, but we'll use something
# like these when we're sending issues as alerts
@dataclass(frozen=True)
class MetricAlertFire(GroupType):
    type_id = 8001
    slug = "metric_alert_fire"
    description = "Metric alert fired"
    category = GroupCategory.METRIC_ALERT.value
    creation_quota = Quota(3600, 60, 100)
    default_priority = PriorityLevel.HIGH
    enable_auto_resolve = False
    enable_escalation_detection = False
    detector_handler = MetricAlertDetectorHandler
    detector_validator = MetricAlertsDetectorValidator
    detector_config_schema = {
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
    }

    @classmethod
    def allow_post_process_group(cls, organization: Organization) -> bool:
        return features.has("organizations:workflow-engine-metric-alert-processing", organization)
