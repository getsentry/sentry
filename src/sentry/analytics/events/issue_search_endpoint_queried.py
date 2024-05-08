from sentry import analytics


class IssueSearchEndpointQueriedEvent(analytics.Event):
    type = "issue_search.endpoint_queried"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_ids"),  # This is a list of project ids
        analytics.Attribute("full_query_params"),
        analytics.Attribute("query"),
    )


analytics.register(IssueSearchEndpointQueriedEvent)
