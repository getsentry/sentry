from sentry import analytics


@analytics.eventclass("weekly_report.sent")
class WeeklyReportSent(analytics.Event):
    organization_id: str
    user_id: str
    notification_uuid: str
    user_project_count: int


analytics.register(WeeklyReportSent)
