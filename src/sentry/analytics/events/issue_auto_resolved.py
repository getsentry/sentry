from sentry import analytics


@analytics.eventclass("issue.auto_resolved")
class IssueAutoResolvedEvent(analytics.Event):
    project_id: str | None = None
    organization_id: str
    group_id: str
    issue_category: str | None = None
    issue_type: str | None = None


analytics.register(IssueAutoResolvedEvent)
