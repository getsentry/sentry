from sentry import analytics


class FirstCronCheckinSent(analytics.Event):
    type = "first_cron_checkin.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("monitor_id"),
        analytics.Attribute("user_id", required=False),
    )


analytics.register(FirstCronCheckinSent)
