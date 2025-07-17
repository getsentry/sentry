from sentry import analytics


@analytics.eventclass("project_issue.searched")
class ProjectIssueSearchEvent(analytics.Event):
    user_id: int | None = None
    organization_id: str
    project_id: int
    query: str


analytics.register(ProjectIssueSearchEvent)
