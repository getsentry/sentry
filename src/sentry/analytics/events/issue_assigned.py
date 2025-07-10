from sentry import analytics


@analytics.eventclass("issue.assigned")
class IssueAssignedEvent(analytics.Event):
    user_id: str | None = None
    default_user_id: str
    organization_id: str
    group_id: str


analytics.register(IssueAssignedEvent)
