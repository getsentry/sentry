from sentry import analytics


class AdvancedSearchFeatureGateEvent(analytics.Event):
    type = "advanced_search.feature_gated"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("organization_id"),
    )


analytics.register(AdvancedSearchFeatureGateEvent)
