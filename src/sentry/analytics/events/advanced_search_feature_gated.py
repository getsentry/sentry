from sentry import analytics
from typing import int


@analytics.eventclass("advanced_search.feature_gated")
class AdvancedSearchFeatureGateEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int
    organization_id: int


analytics.register(AdvancedSearchFeatureGateEvent)
