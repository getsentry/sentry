from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import EventLifecycleMetric


class WeeklyReportFailureType(StrEnum):
    TIMEOUT = "timeout"


class WeeklyReportOperationType(StrEnum):
    """
    Represents a single step in the weekly reporting pipeline.
    """

    SCHEDULE_ORGANIZATION_REPORTS = "schedule_organization_reports"
    PREPARE_ORGANIZATION_REPORTS = "prepare_organization_reports"


@dataclass
class WeeklyReportSLO(EventLifecycleMetric):
    operation_type: WeeklyReportOperationType

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = ("weekly_report", self.operation_type, str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        return {
            "operation_type": self.operation_type,
        }
