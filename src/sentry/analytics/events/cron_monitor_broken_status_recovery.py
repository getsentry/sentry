from sentry import analytics


class CronMonitorBrokenStatusRecovery(analytics.Event):
    type = "cron_monitor_broken_status.recovery"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("monitor_id"),
        analytics.Attribute("monitor_env_id"),
    )


analytics.register(CronMonitorBrokenStatusRecovery)
