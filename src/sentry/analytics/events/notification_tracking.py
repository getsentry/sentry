from dataclasses import field

from sentry import analytics


@analytics.eventclass("notifications.tracking.sent")
class NotificationTrackingSentEvent(analytics.Event):
    organization_id: int
    notification_uuid: str | None
    source: str
    category: str
    provider: str
    stage: str | None = None
    # The links and buttons present in the sent message
    links: list[str] = field(default_factory=list)


@analytics.eventclass("notifications.tracking.engagement")
class NotificationTrackingEngagementEvent(analytics.Event):
    organization_id: int
    notification_uuid: str | None
    source: str
    category: str
    provider: str
    stage: str | None = None
    link: str
    # How the engagement was observed: page_load, provider_callback, or redirect
    mechanism: str
    user_id: int | None = None


analytics.register(NotificationTrackingSentEvent)
analytics.register(NotificationTrackingEngagementEvent)
