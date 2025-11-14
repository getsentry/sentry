from typing import int
from sentry import analytics


@analytics.eventclass("first_sourcemaps.sent")
class FirstSourcemapsSentEvent(analytics.Event):
    user_id: int
    organization_id: int
    project_id: int
    platform: str | None = None
    url: str | None = None
    project_platform: str | None = None


@analytics.eventclass("first_sourcemaps_for_project.sent")
class FirstSourcemapsSentEventForProject(FirstSourcemapsSentEvent):
    pass


analytics.register(FirstSourcemapsSentEvent)
analytics.register(FirstSourcemapsSentEventForProject)
