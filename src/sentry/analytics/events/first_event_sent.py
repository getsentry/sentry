from sentry import analytics


# first error for that organization
class FirstEventSentEvent(analytics.Event):
    type = "first_event.sent"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("platform", required=False),
    )


# first error for that project
class FirstEventSentEventForProject(FirstEventSentEvent):
    type = "first_event_for_project.sent"


analytics.register(FirstEventSentEvent)
analytics.register(FirstEventSentEventForProject)
