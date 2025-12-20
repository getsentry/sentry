from collections.abc import Mapping
from datetime import datetime
from typing import Any, Literal, NotRequired, Protocol, TypedDict

from sentry.billing.config import UsageCategoryId


class UsageProperties(TypedDict):
    project_id: int
    event_id: NotRequired[str]
    key_id: NotRequired[int]
    reason: NotRequired[str]
    quantity: NotRequired[int]
    idempotency_key: NotRequired[str]  # TODO: seems useful?


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
        usage_category_ids: list[UsageCategoryId],
        start: datetime,
        end: datetime,
        filter_properties: UsageProperties | None = None,  # TODO: filter-specific type
        group_by: list[str] | None = None,
        values: list[str] | None = None,
        window_size: Literal["1h", "1d"] = "1d",
    ) -> Mapping[UsageCategoryId, list[dict[str, Any]]]:  # TODO: typing as AggregatedUsage
        """Retrieve aggregated usage data across multiple usage categories"""
