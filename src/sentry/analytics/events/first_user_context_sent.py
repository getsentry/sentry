from sentry import analytics


@analytics.eventclass("first_user_context.sent")
class FirstUserContextSentEvent(analytics.Event):
    user_id: str
    organization_id: str
    project_id: str


analytics.register(FirstUserContextSentEvent)
