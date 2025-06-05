from sentry import analytics


@analytics.eventclass("issue.deleted")
class IssueDeletedEvent(analytics.Event):
    group_id: str
    delete_type: str
    organization_id: str
    project_id: str
    user_id: str | None = None
    default_user_id: str


analytics.register(IssueDeletedEvent)
