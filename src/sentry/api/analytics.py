from sentry import analytics


@analytics.eventclass("organization_saved_search.created")
class OrganizationSavedSearchCreatedEvent(analytics.Event):
    org_id: str
    search_type: str
    query: str


@analytics.eventclass("organization_saved_search.deleted")
class OrganizationSavedSearchDeletedEvent(analytics.Event):
    org_id: str
    search_type: str
    query: str


@analytics.eventclass("group_similar_issues_embeddings.count")
class GroupSimilarIssuesEmbeddingsCountEvent(analytics.Event):
    organization_id: str
    project_id: str
    group_id: str
    user_id: str
    count_over_threshold: str | None = None


@analytics.eventclass("devtoolbar.api_request")
class DevToolbarApiRequestEvent(analytics.Event):
    view_name: str
    route: str
    query_string: str | None = None
    origin: str | None = None
    method: str
    status_code: int
    organization_id: int | None = None
    organization_slug: str | None = None
    project_id: int | None = None
    project_slug: str | None = None
    user_id: int | None = None


analytics.register(OrganizationSavedSearchCreatedEvent)
analytics.register(OrganizationSavedSearchDeletedEvent)
analytics.register(GroupSimilarIssuesEmbeddingsCountEvent)
analytics.register(DevToolbarApiRequestEvent)
