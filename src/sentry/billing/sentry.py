from datetime import datetime

from sentry.billing.interface import UsageCategoryId, UsageProperties, UsageTrackingService
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
            project_id=properties.project_id,
            key_id=properties.key_id,
            outcome=usage_category_id.outcome(),
            reason=properties.reason,
            timestamp=timestamp,
            event_id=properties.event_id,
            category=usage_category_id.data_category(),
            quantity=properties.quantity,
        )

    # TODO: build_outcomes_query
