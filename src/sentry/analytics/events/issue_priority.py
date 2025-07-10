from sentry import analytics


@analytics.eventclass("issue.priority_updated")
class IssuePriorityUpdatedEvent(analytics.Event):
    group_id: str
    new_priority: str
    project_id: str
    organization_id: str
    user_id: str | None = None
    issue_category: str | None = None
    issue_type: str | None = None
    previous_priority: str | None = None
    reason: str | None = None


analytics.register(IssuePriorityUpdatedEvent)
