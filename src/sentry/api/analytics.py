from sentry import analytics


@analytics.eventclass("group_similar_issues_embeddings.count")
class GroupSimilarIssuesEmbeddingsCountEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    hash: str
    user_id: int | None
    count_over_threshold: int | None = None


@analytics.eventclass("devtoolbar.api_request")
class DevToolbarApiRequestEvent(analytics.Event):
    view_name: str
    route: str
    query_string: str | None = None
    origin: str | None = None
    method: str | None
    status_code: int
    organization_id: int | None = None
    organization_slug: str | None = None
    project_id: int | None = None
    project_slug: str | None = None
    user_id: int | None = None


analytics.register(GroupSimilarIssuesEmbeddingsCountEvent)
analytics.register(DevToolbarApiRequestEvent)
