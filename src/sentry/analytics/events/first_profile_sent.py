from sentry import analytics


@analytics.eventclass("first_profile.sent")
class FirstProfileSentEvent(analytics.Event):
    organization_id: str
    project_id: str
    platform: str | None = None
    user_id: str | None = None


analytics.register(FirstProfileSentEvent)
