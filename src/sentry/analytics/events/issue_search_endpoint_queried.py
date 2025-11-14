from typing import int
from sentry import analytics


@analytics.eventclass("issue_search.endpoint_queried")
class IssueSearchEndpointQueriedEvent(analytics.Event):
    user_id: int | None = None
    organization_id: int
    project_ids: str  # This is a stringified list of project ids
    full_query_params: str
    query: str


analytics.register(IssueSearchEndpointQueriedEvent)
