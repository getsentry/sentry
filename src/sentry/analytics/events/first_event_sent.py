from sentry import analytics


# first error for an organization
class FirstEventSentEvent(analytics.Event):
    type = "first_event.sent"

    attributes = (
        analytics.Attribute("user_id"),
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("platform", required=False),
        analytics.Attribute("url", required=False),
        analytics.Attribute("has_minified_stack_trace", required=False),
        analytics.Attribute("project_platform", required=False),
    )


# first error for a project
class FirstEventSentEventForProject(FirstEventSentEvent):
    type = "first_event_for_project.sent"


# first error with minified stack trace for a project
class FirstEventSentEventWithMinifiedStackTraceForProject(FirstEventSentEvent):
    type = "first_event_with_minified_stack_trace_for_project.sent"


analytics.register(FirstEventSentEvent)
analytics.register(FirstEventSentEventForProject)
analytics.register(FirstEventSentEventWithMinifiedStackTraceForProject)
