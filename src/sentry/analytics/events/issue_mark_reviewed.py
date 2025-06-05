from sentry import analytics


@analytics.eventclass("issue.mark_reviewed")
class IssueMarkReviewedEvent(analytics.Event):
    user_id: str | None = None
    default_user_id: str
    organization_id: str
    group_id: str


analytics.register(IssueMarkReviewedEvent)
