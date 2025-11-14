from typing import int
from sentry import analytics


@analytics.eventclass("issue_tracker.used")
class IssueTrackerUsedEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int | str
    organization_id: int
    issue_tracker: str
    project_id: int


analytics.register(IssueTrackerUsedEvent)
