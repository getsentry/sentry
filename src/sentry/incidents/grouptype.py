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
from sentry.types.actor import parse_and_validate_actor
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector import (
    DetectorOccurrence,
    StatefulGroupingDetectorHandler,
)
from sentry.workflow_engine.handlers.detector.base import EvidenceData
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.types import DetectorGroupKey, DetectorSettings

COMPARISON_DELTA_CHOICES: list[None | int] = [choice.value for choice in ComparisonDeltaChoices]
COMPARISON_DELTA_CHOICES.append(None)


@dataclass
class MetricIssueEvidenceData(EvidenceData):
    alert_id: int  # is this supposed to be detector id?


class MetricAlertDetectorHandler(StatefulGroupingDetectorHandler[QuerySubscriptionUpdate, int]):
    def create_occurrence(
        self, group_key: DetectorGroupKey, new_status: PriorityLevel
    ) -> tuple[DetectorOccurrence, dict[str, Any]]:

        try:
            assignee = parse_and_validate_actor(
                self.detector.created_by_id, self.detector.project.organization_id
            )
        except Exception:
            assignee = None

        # XXX: can we pass data_packet through here? we need the aggregate value and the source ids to generate the title
        # title = construct_title(incident.alert_rule, incident.status)
        # TODO rewrite construct_title to not take incident data
        title_level = "Critical" if new_status == PriorityLevel.HIGH else "Warning"
        title = f"{title_level}: 100 events in the last 5 mins"

        return (
            DetectorOccurrence(
                issue_title=self.detector.name,
                subtitle=title,
                resource_id=None,
                evidence_data={},  # what's supposed to be in here?
                evidence_display=[],  # do we need this?
                type=MetricIssue,
                level="error",
                culprit="",
                priority=new_status,
                assignee=assignee,
            ),
            {},
        )  # what's the dict supposed to be?

    @property
    def counter_names(self) -> list[str]:
        # Placeholder for now, this should be a list of counters that we want to update as we go above warning / critical
        return []

    def extract_dedupe_value(self, data_packet: DataPacket[QuerySubscriptionUpdate]) -> int:
        return int(data_packet.packet.get("timestamp", datetime.now(UTC)).timestamp())

    def extract_group_values(
        self, data_packet: DataPacket[MetricDetectorUpdate]
    ) -> dict[DetectorGroupKey, int]:
        # TODO what should the DetectorGroupKey be?
        return {None: data_packet.packet["values"]["value"]}


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
