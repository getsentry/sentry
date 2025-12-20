from collections.abc import Mapping
from datetime import datetime
from typing import Any, Literal

from sentry.billing.config import UsageCategoryId
from sentry.billing.usage import UsageProperties, UsageTrackingService
from sentry.snuba.outcomes import QueryDefinition, run_outcomes_query_timeseries
from sentry.utils.outcomes import track_outcome


class SentryUsageTrackingService(UsageTrackingService):
    def record_usage(
        self,
        org_id: int,
        usage_category_id: UsageCategoryId,
        properties: UsageProperties,
        timestamp: datetime | None = None,
    ) -> None:
        track_outcome(
            org_id=org_id,
            project_id=properties["project_id"],
            key_id=properties.get("key_id"),
            outcome=usage_category_id.outcome(),
            reason=properties.get("reason"),
            timestamp=timestamp,
            event_id=properties.get("event_id"),
            category=usage_category_id.data_category(),
            quantity=properties.get("quantity", 1),
        )

    def get_aggregated_usage(
        self,
        org_id: int,
        usage_category_ids: list[UsageCategoryId],
        start: datetime,
        end: datetime,
        filter_properties: UsageProperties | None = None,
        group_by: list[str] | None = None,
        values: list[str] | None = None,
        window_size: Literal["1h", "1d"] = "1d",
    ) -> Mapping[UsageCategoryId, list[dict[str, Any]]]:
        # TODO: Can we query multiple category/outcome at a time
        return {
            usage_category_id: run_outcomes_query_timeseries(
                QueryDefinition(
                    fields=values or [],
                    start=start.isoformat(),
                    end=end.isoformat(),
                    organization_id=org_id,
                    project_ids=(
                        [filter_properties["project_id"]] if filter_properties is not None else None
                    ),
                    key_id=filter_properties["key_id"] if filter_properties is not None else None,
                    interval=window_size,
                    outcome=[usage_category_id.outcome().api_name()],
                    group_by=group_by or [],
                    category=[usage_category_id.data_category().api_name()],
                    reason=filter_properties["reason"] if filter_properties is not None else None,
                ),
                tenant_ids={"organization_id": org_id},
            )
            for usage_category_id in usage_category_ids
        }
