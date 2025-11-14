from typing import int
from sentry import analytics


@analytics.eventclass("monitor_environment.mark_failed")
class MonitorEnvironmentMarkFailed(analytics.Event):
    organization_id: int
    monitor_id: str  # this is stringified in the caller
    project_id: int
    environment_id: int


analytics.register(MonitorEnvironmentMarkFailed)
