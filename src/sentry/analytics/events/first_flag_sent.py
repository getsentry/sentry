from sentry import analytics


@analytics.eventclass("first_flag.sent")
class FirstFlagSentEvent(analytics.Event):
    organization_id: str
    project_id: str
    platform: str | None = None


analytics.register(FirstFlagSentEvent)
