from sentry import analytics


class FirstSourcemapsSentEvent(analytics.Event):
    type = "first_sourcemaps.sent"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("platform", required=False),
        analytics.Attribute("url", required=False),
        analytics.Attribute("project_platform", required=False),
    )


class FirstSourcemapsSentEventForProject(FirstSourcemapsSentEvent):
    type = "first_sourcemaps_for_project.sent"


analytics.register(FirstSourcemapsSentEvent)
analytics.register(FirstSourcemapsSentEventForProject)
