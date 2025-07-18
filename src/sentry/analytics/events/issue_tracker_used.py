from sentry import analytics


@analytics.eventclass("issue_tracker.used")
class IssueTrackerUsedEvent(analytics.Event):
    user_id: int | None = None
    default_user_id: str
    organization_id: str
    issue_tracker: str
    project_id: str


analytics.register(IssueTrackerUsedEvent)
