from sentry import analytics


@analytics.eventclass("issue.viewed")
class IssueViewedEvent(analytics.Event):
    project_id: int
    organization_id: int
    group_id: int
    client: str
    user_id: int | None = None
