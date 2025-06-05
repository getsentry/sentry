from sentry import analytics


@analytics.eventclass("issue.archived")
class IssueArchivedEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: int
    organization_id: int
    group_id: str
    until_escalating: bool | None = None


analytics.register(IssueArchivedEvent)
