from typing import int
from sentry import analytics


@analytics.eventclass("issue.priority_updated")
class IssuePriorityUpdatedEvent(analytics.Event):
    group_id: int
    new_priority: str
    project_id: int | None
    organization_id: int
    user_id: int | None = None
    issue_category: str | None = None
    issue_type: str | None = None
    previous_priority: str | None = None
    reason: str | None = None


analytics.register(IssuePriorityUpdatedEvent)
