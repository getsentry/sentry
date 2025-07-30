from sentry import analytics


@analytics.eventclass("issue.escalating")
class IssueEscalatingEvent(analytics.Event):
    organization_id: int
    project_id: int
    group_id: int
    event_id: int | None = None
    was_until_escalating: bool


analytics.register(IssueEscalatingEvent)
