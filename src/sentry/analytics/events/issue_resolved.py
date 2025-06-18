from sentry import analytics


@analytics.eventclass("issue.resolved")
class IssueResolvedEvent(analytics.Event):
    user_id: str | None = None
    project_id: str | None = None
    default_user_id: str
    organization_id: str
    group_id: str
    resolution_type: str
    # TODO: make required once we validate that all events have this
    issue_category: str | None = None
    issue_type: str | None = None


analytics.register(IssueResolvedEvent)
