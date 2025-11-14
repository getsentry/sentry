from typing import int
from sentry import analytics


@analytics.eventclass("issue.resolved")
class IssueResolvedEvent(analytics.Event):
    user_id: int | None = None
    project_id: int | None = None
    default_user_id: int | str
    organization_id: int
    group_id: int
    resolution_type: str
    # TODO: make required once we validate that all events have this
    provider: str | None = None
    issue_category: str | None = None
    issue_type: str | None = None


analytics.register(IssueResolvedEvent)
