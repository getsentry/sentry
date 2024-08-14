from sentry import analytics


class CronMonitorEvent(analytics.Event):
    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("from_upsert"),
        analytics.Attribute("user_id", required=False),
    )


class CronMonitorCreated(CronMonitorEvent):
    type = "cron_monitor.created"


class FirstCronMonitorCreated(CronMonitorEvent):
    type = "first_cron_monitor.created"


analytics.register(FirstCronMonitorCreated)
analytics.register(CronMonitorCreated)
