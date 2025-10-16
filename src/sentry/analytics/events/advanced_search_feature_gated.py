from sentry import analytics


@analytics.eventclass("advanced_search.feature_gated")
class AdvancedSearchFeatureGateEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int
    organization_id: int


analytics.register(AdvancedSearchFeatureGateEvent)
