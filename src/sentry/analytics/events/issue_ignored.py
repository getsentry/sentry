from typing import int
from sentry import analytics


@analytics.eventclass("issue.ignored")
class IssueIgnoredEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int
    organization_id: int
    group_id: int
    ignore_duration: int | None = None
    ignore_count: int | None = None
    ignore_window: int | None = None
    ignore_user_count: int | None = None
    ignore_user_window: int | None = None


analytics.register(IssueIgnoredEvent)
