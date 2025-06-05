from sentry import analytics


@analytics.eventclass("project_issue.searched")
class ProjectIssueSearchEvent(analytics.Event):
    user_id: str | None = None
    organization_id: str
    project_id: str
    query: str


analytics.register(ProjectIssueSearchEvent)
