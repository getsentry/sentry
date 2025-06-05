from sentry import analytics


@analytics.eventclass("issue_search.endpoint_queried")
class IssueSearchEndpointQueriedEvent(analytics.Event):
    user_id: str
    organization_id: str
    project_ids: str  # This is a list of project ids
    full_query_params: str
    query: str


analytics.register(IssueSearchEndpointQueriedEvent)
