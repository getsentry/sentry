from sentry import analytics


class SearchSavedEvent(analytics.Event):
    type = "search.saved"

    attributes = (
        analytics.Attribute("user_id", required=False),
        analytics.Attribute("default_user_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("organization_id"),
    )


analytics.register(SearchSavedEvent)
