from typing import int
from sentry import analytics


@analytics.eventclass("issue.deleted")
class IssueDeletedEvent(analytics.Event):
    group_id: int
    delete_type: str
    organization_id: int
    project_id: int
    user_id: int | None = None
    default_user_id: int | str | None = None


analytics.register(IssueDeletedEvent)
