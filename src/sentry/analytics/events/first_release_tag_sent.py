from sentry import analytics


@analytics.eventclass("first_release_tag.sent")
class FirstReleaseTagSentEvent(analytics.Event):
    user_id: str
    organization_id: str
    project_id: str


analytics.register(FirstReleaseTagSentEvent)
