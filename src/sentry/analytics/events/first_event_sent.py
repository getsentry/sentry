from typing import int
from sentry import analytics


# first error for an organization
@analytics.eventclass("first_event.sent")
class FirstEventSentEvent(analytics.Event):
    user_id: int
    organization_id: int
    project_id: int
    platform: str | None = None
    url: str | None = None
    has_minified_stack_trace: bool | None = None
    project_platform: str | None = None


# first error for a project
@analytics.eventclass("first_event_for_project.sent")
class FirstEventSentForProjectEvent(FirstEventSentEvent):
    sdk_name: str | None = None


# first error with minified stack trace for a project
@analytics.eventclass("first_event_with_minified_stack_trace_for_project.sent")
class FirstEventSentEventWithMinifiedStackTraceForProject(FirstEventSentEvent):
    pass


analytics.register(FirstEventSentEvent)
analytics.register(FirstEventSentForProjectEvent)
analytics.register(FirstEventSentEventWithMinifiedStackTraceForProject)
