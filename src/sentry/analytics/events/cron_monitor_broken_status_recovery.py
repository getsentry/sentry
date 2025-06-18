from sentry import analytics


@analytics.eventclass("cron_monitor_broken_status.recovery")
class CronMonitorBrokenStatusRecovery(analytics.Event):
    organization_id: str
    project_id: str
    monitor_id: str
    monitor_env_id: str


analytics.register(CronMonitorBrokenStatusRecovery)
