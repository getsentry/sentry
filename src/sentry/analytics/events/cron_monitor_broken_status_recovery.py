from typing import int
from sentry import analytics


@analytics.eventclass("cron_monitor_broken_status.recovery")
class CronMonitorBrokenStatusRecovery(analytics.Event):
    organization_id: int
    project_id: int
    monitor_id: int
    monitor_env_id: int


analytics.register(CronMonitorBrokenStatusRecovery)
