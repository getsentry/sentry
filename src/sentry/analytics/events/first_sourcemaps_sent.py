from sentry import analytics


@analytics.eventclass("first_sourcemaps.sent")
class FirstSourcemapsSentEvent(analytics.Event):
    user_id: str
    organization_id: str
    project_id: str
    platform: str | None = None
    url: str | None = None
    project_platform: str | None = None


class FirstSourcemapsSentEventForProject(FirstSourcemapsSentEvent):
    type = "first_sourcemaps_for_project.sent"


analytics.register(FirstSourcemapsSentEvent)
analytics.register(FirstSourcemapsSentEventForProject)
