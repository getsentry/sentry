from typing import int
from sentry import analytics


@analytics.eventclass("quick_trace.connected_services")
class QuickTraceConnectedServices(analytics.Event):
    trace_id: str
    organization_id: int
    projects: str


analytics.register(QuickTraceConnectedServices)
