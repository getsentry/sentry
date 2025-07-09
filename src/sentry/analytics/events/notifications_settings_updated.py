from sentry import analytics


@analytics.eventclass("notifications.settings_updated")
class NotificationSettingsUpdated(analytics.Event):
    target_type: str
    actor_id: str | None = None
    id: str


analytics.register(NotificationSettingsUpdated)
