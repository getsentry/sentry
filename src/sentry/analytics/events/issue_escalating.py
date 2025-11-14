from typing import int
from sentry import analytics


@analytics.eventclass("issue.escalating")
class IssueEscalatingEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    event_id: str | None = None
    was_until_escalating: bool


analytics.register(IssueEscalatingEvent)
