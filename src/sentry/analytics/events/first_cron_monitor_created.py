from sentry import analytics


class FirstCronMonitorCreated(analytics.Event):
    type = "first_cron_monitor.created"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("from_upsert"),
        analytics.Attribute("user_id", required=False),
    )


analytics.register(FirstCronMonitorCreated)
