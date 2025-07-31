from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import EventLifecycleMetric


class WeeklyReportFailureType(StrEnum):
    """The type of failure that occurred when preparing a weekly report"""

    # The task was cancelled
    CANCELLED = "cancelled"

    # The task timed out
    TIMEOUT = "timeout"


class WeeklyReportOperationType(StrEnum):
    """The type of operation that occurred when preparing a weekly report"""

    PREPARE_ORGANIZATION_REPORT = "prepare_organization_report"
    SEND_ORGANIZATION_REPORT = "send_organization_report"


@dataclass
class WeeklyReportSLO(EventLifecycleMetric):
    """An event under the Weekly Report umbrella"""

    operation_type: WeeklyReportOperationType

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = ("weekly_report", self.operation_type, str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        return {
            "operation_type": self.operation_type,
        }
