from typing import int
from sentry import analytics


@analytics.eventclass("issue.assigned")
class IssueAssignedEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int | str
    organization_id: int
    group_id: int


analytics.register(IssueAssignedEvent)
