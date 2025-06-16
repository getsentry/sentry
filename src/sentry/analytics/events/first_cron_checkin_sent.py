from sentry import analytics


@analytics.eventclass("first_cron_checkin.sent")
class FirstCronCheckinSent(analytics.Event):
    organization_id: str
    project_id: str
    monitor_id: str
    user_id: str | None = None


analytics.register(FirstCronCheckinSent)
