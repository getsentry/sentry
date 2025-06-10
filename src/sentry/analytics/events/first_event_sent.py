from sentry import analytics


# first error for an organization
@analytics.eventclass("first_event.sent")
class FirstEventSentEvent(analytics.Event):
    user_id: str
    organization_id: str
    project_id: str
    platform: str | None = None
    url: str | None = None
    has_minified_stack_trace: str | None = None
    project_platform: str | None = None


# first error for a project
@analytics.eventclass("first_event_for_project.sent")
class FirstEventSentEventForProject(FirstEventSentEvent):
    pass


# first error with minified stack trace for a project
@analytics.eventclass("first_event_with_minified_stack_trace_for_project.sent")
class FirstEventSentEventWithMinifiedStackTraceForProject(FirstEventSentEvent):
    pass


analytics.register(FirstEventSentEvent)
analytics.register(FirstEventSentEventForProject)
analytics.register(FirstEventSentEventWithMinifiedStackTraceForProject)
