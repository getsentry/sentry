from typing import int
from sentry import analytics


@analytics.eventclass("first_cron_checkin.sent")
class FirstCronCheckinSent(analytics.Event):
    organization_id: int
    project_id: int
    monitor_id: str  # id is a uuid -> str
    user_id: int | None = None


analytics.register(FirstCronCheckinSent)
