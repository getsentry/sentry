from sentry import analytics


@analytics.eventclass("issue.escalating")
class IssueEscalatingEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: str
    event_id: str | None = None
    was_until_escalating: str


analytics.register(IssueEscalatingEvent)
