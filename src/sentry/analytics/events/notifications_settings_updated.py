from sentry import analytics


class NotificationSettingsUpdated(analytics.Event):
    type = "notifications.settings_updated"

    attributes = (
        analytics.Attribute("target_type"),
        analytics.Attribute("actor_id"),
    )


analytics.register(NotificationSettingsUpdated)
