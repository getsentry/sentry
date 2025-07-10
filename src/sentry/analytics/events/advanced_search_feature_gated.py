from sentry import analytics


@analytics.eventclass("advanced_search.feature_gated")
class AdvancedSearchFeatureGateEvent(analytics.Event):
    user_id: str | None = None
    default_user_id: str
    organization_id: str


analytics.register(AdvancedSearchFeatureGateEvent)
