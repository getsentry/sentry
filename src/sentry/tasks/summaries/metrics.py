from typing import int
from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

from sentry.integrations.types import EventLifecycleOutcome
from sentry.integrations.utils.metrics import EventLifecycleMetric


class WeeklyReportHaltReason(StrEnum):
    """
    The reason for a halt in the weekly reporting pipeline.
    """

    EMPTY_REPORT = "empty_report"
    DRY_RUN = "dry_run"
    DUPLICATE_DELIVERY = "duplicate_delivery"
    TIMEOUT = "timeout"


class WeeklyReportOperationType(StrEnum):
    """
    Represents a single step in the weekly reporting pipeline.
    """

    SCHEDULE_ORGANIZATION_REPORTS = "schedule_organization_reports"
    PREPARE_ORGANIZATION_REPORT = "prepare_organization_report"
    SEND_EMAIL = "send_email"


@dataclass
class WeeklyReportSLO(EventLifecycleMetric):
    operation_type: WeeklyReportOperationType
    dry_run: bool

    def get_metric_key(self, outcome: EventLifecycleOutcome) -> str:
        tokens = ("weekly_report", self.operation_type, str(outcome))
        return ".".join(tokens)

    def get_metric_tags(self) -> Mapping[str, str]:
        return {
            "operation_type": self.operation_type,
            "dry_run": str(self.dry_run).lower(),
        }
