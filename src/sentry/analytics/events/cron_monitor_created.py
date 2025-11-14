from typing import int
from sentry import analytics


@analytics.eventclass()
class CronMonitorEvent(analytics.Event):
    organization_id: int
    project_id: int
    from_upsert: bool
    user_id: int | None = None


@analytics.eventclass("cron_monitor.created")
class CronMonitorCreated(CronMonitorEvent):
    pass


@analytics.eventclass("first_cron_monitor.created")
class FirstCronMonitorCreated(CronMonitorEvent):
    pass


analytics.register(FirstCronMonitorCreated)
analytics.register(CronMonitorCreated)
