from sentry import analytics


@analytics.eventclass("monitor_environment.mark_failed")
class MonitorEnvironmentMarkFailed(analytics.Event):
    organization_id: str
    monitor_id: str
    project_id: str
    environment_id: str


analytics.register(MonitorEnvironmentMarkFailed)
