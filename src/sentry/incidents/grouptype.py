from dataclasses import dataclass
from typing import Any

from sentry.incidents.endpoints.validators import MetricAlertsDetectorValidator
from sentry.incidents.utils.types import QuerySubscriptionUpdate
from sentry.issues.grouptype import GroupCategory, GroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.ratelimits.sliding_windows import Quota
from sentry.types.group import PriorityLevel
from sentry.workflow_engine.handlers.detector import StatefulDetectorHandler
from sentry.workflow_engine.handlers.detector.base import DetectorEvaluationResult
from sentry.workflow_engine.models.data_source import DataPacket
from sentry.workflow_engine.types import DetectorPriorityLevel


class MetricAlertDetectorHandler(StatefulDetectorHandler[QuerySubscriptionUpdate]):
    def evaluate(
        self, data_packet: DataPacket[QuerySubscriptionUpdate]
    ) -> dict[str | None, DetectorEvaluationResult]:
        return {
            "dummy_group": DetectorEvaluationResult(
                group_key="dummy_group",
                is_active=True,
                priority=DetectorPriorityLevel.HIGH,
                result=None,
                event_data=None,
            )
        }

    def build_occurrence_and_event_data(
        self, group_key: str | None, value: int, new_status: PriorityLevel
    ) -> tuple[IssueOccurrence, dict[str, Any]]:
        return super().build_occurrence_and_event_data(group_key, value, new_status)

    def counter_names(self):
        return []

    def get_dedupe_value(self, data_packet: DataPacket[QuerySubscriptionUpdate]) -> int:
        return super().get_dedupe_value(data_packet)

    def get_group_key_values(
        self, data_packet: DataPacket[QuerySubscriptionUpdate]
    ) -> dict[str, int]:
        return super().get_group_key_values(data_packet)


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
