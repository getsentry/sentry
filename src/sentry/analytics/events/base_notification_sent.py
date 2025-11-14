from typing import int
import abc

from sentry import analytics


@analytics.eventclass()
class BaseNotificationSent(analytics.Event, abc.ABC):
    organization_id: int
    project_id: int | None = None
    category: str
    actor_id: int | None = None
    user_id: int | None = None
    group_id: int | None = None
    id: int | None = None
    actor_type: str | None = None
    notification_uuid: str
    alert_id: int | None = None
