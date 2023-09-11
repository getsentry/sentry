from sentry import analytics


class WeeklyReportSent(analytics.Event):
    type = "weekly_report.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id"),
        analytics.Attribute("notification_uuid"),
        analytics.Attribute("user_project_count", type=int),
    )


analytics.register(WeeklyReportSent)
