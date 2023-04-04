from sentry import analytics


class MonitorEnvironmentMarkFailed(analytics.Event):
    type = "monitor_environment.mark_failed"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("monitor_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("environment_id"),
    )


analytics.register(MonitorEnvironmentMarkFailed)
