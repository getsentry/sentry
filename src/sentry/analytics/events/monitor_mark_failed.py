from sentry import analytics


class MonitorMarkFailed(analytics.Event):
    type = "monitor.mark_failed"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("monitor_id"),
        analytics.Attribute("project_id"),
    )


analytics.register(MonitorMarkFailed)
