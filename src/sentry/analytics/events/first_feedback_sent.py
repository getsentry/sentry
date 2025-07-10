from sentry import analytics


@analytics.eventclass("first_feedback.sent")
class FirstFeedbackSentEvent(analytics.Event):
    organization_id: str
    project_id: str
    platform: str | None = None
    user_id: str | None = None


analytics.register(FirstFeedbackSentEvent)
