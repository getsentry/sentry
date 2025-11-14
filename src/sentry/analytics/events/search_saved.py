from typing import int
from sentry import analytics


@analytics.eventclass("search.saved")
class SearchSavedEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int | str | None = None
    project_id: int
    organization_id: int


analytics.register(SearchSavedEvent)
