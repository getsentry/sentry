from typing import int
from sentry import analytics


@analytics.eventclass("issue.mark_reviewed")
class IssueMarkReviewedEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int
    organization_id: int
    group_id: int


analytics.register(IssueMarkReviewedEvent)
