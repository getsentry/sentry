from sentry import analytics


@analytics.eventclass("search.saved")
class SearchSavedEvent(analytics.Event):
    user_id: str | None = None
    default_user_id: str
    project_id: str
    organization_id: str


analytics.register(SearchSavedEvent)
