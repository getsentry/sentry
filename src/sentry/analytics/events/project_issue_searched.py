from typing import int
from sentry import analytics


@analytics.eventclass("project_issue.searched")
class ProjectIssueSearchEvent(analytics.Event):
    user_id: int | None = None
    organization_id: int
    project_id: int
    query: str


analytics.register(ProjectIssueSearchEvent)
