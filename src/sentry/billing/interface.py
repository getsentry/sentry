from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum
from typing import Literal, Protocol

from sentry.constants import DataCategory
from sentry.utils.outcomes import Outcome


class UsageCategoryId(IntEnum):
    """Enum for usage categories we track"""

    ERROR_ACCEPTED = DataCategory.ERROR | (Outcome.ACCEPTED << 10)
    ERROR_FILTERED = DataCategory.ERROR | (Outcome.FILTERED << 10)
    ERROR_RATE_LIMITED = DataCategory.ERROR | (Outcome.RATE_LIMITED << 10)
    ERROR_INVALID = DataCategory.ERROR | (Outcome.INVALID << 10)
    ERROR_ABUSE = DataCategory.ERROR | (Outcome.ABUSE << 10)
    ERROR_CLIENT_DISCARD = DataCategory.ERROR | (Outcome.CLIENT_DISCARD << 10)
    ERROR_CARDINALITY_LIMITED = DataCategory.ERROR | (Outcome.CARDINALITY_LIMITED << 10)
    # TRANSACTION...

    def data_category(self) -> DataCategory:
        return DataCategory(self.value & 0x3FF)

    def outcome(self) -> Outcome:
        return Outcome(self.value >> 10)

    def api_name(self) -> str:
        return f"{self.data_category().api_name()}_{self.outcome().api_name()}"


@dataclass
class UsageProperties:
    project_id: int
    event_id: str | None = None
    key_id: int | None = None
    reason: str | None = None
    quantity: int = 1


@dataclass
class BatchedUsageRecord:
    """A single usage record from batched usage query"""

    # TODO: Rework these, also add group by key
    org_id: str
    usage_category_id: UsageCategoryId
    start_timestamp: datetime
    end_timestamp: datetime
    value: int  # Aggregated quantity for the time window


@dataclass
class UsageCategoryAggregation:
    usage_category_id: UsageCategoryId
    group_by: str  # TODO: supports properties only?
    values: list[str] | None = None  # TODO: needed?


class UsageTrackingService(Protocol):
    """Service for recording and querying usage data"""

    def record_usage(
        self,
        org_id: int,
        usage_category_id: UsageCategoryId,
        properties: UsageProperties,
        timestamp: datetime | None = None,
    ) -> None:
        """Record usage for a specific usage category"""

    def get_aggregated_usage(
        self,
        org_id: int,
        usage_categories: list[UsageCategoryAggregation],
        start: datetime,
        end: datetime,
        window_size: Literal["1h", "1d"] = "1d",
    ) -> list[BatchedUsageRecord]:
        """Retrieve aggregated usage data across multiple usage categories"""


class BillingService(Protocol):
    usage_tracking: UsageTrackingService
    # plan_management: PlanManagementService
    # customer_billing: CustomerBillingService
    # quota_management: QuotaManagementService
    # committed_spend: CommittedSpendService
    # billing_calculation: BillingCalculationService
    # invoicing: InvoicingService
