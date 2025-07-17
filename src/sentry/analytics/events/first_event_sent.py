from sentry import analytics


# first error for an organization
@analytics.eventclass("first_event.sent")
class FirstEventSentEvent(analytics.Event):
    user_id: int
    organization_id: int
    project_id: int
    platform: str | None = None
    url: str | None = None
    has_minified_stack_trace: str | None = None
    project_platform: str | None = None


# first error for a project
class FirstEventSentEventForProject(FirstEventSentEvent):
    type = "first_event_for_project.sent"


# first error with minified stack trace for a project
class FirstEventSentEventWithMinifiedStackTraceForProject(FirstEventSentEvent):
    type = "first_event_with_minified_stack_trace_for_project.sent"


analytics.register(FirstEventSentEvent)
analytics.register(FirstEventSentEventForProject)
analytics.register(FirstEventSentEventWithMinifiedStackTraceForProject)
