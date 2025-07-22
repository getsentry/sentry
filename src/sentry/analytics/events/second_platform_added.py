from sentry import analytics


@analytics.eventclass("second_platform.added")
class SecondPlatformAddedEvent(analytics.Event):
    user_id: str
    organization_id: str
    project_id: str
    platform: str | None = None


analytics.register(SecondPlatformAddedEvent)
