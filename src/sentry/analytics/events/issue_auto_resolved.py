from typing import int
from sentry import analytics


@analytics.eventclass("issue.auto_resolved")
class IssueAutoResolvedEvent(analytics.Event):
    project_id: int | None = None
    organization_id: int
    group_id: int
    issue_category: str | None = None
    issue_type: str | None = None


analytics.register(IssueAutoResolvedEvent)
