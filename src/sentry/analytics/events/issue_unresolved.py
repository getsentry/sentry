from typing import Literal

from sentry import analytics


@analytics.eventclass("issue.unresolved")
class IssueUnresolvedEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int | Literal["unknown"]
    organization_id: int
    group_id: int
    transition_type: str


analytics.register(IssueUnresolvedEvent)
