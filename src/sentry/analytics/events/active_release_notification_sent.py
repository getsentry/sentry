from sentry import analytics


class ActiveReleaseNotificationSent(analytics.Event):
    type = "active_release_notification.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("provider"),
        analytics.Attribute("release_version"),
        analytics.Attribute("recipient_email"),
        analytics.Attribute("recipient_username"),
    )


analytics.register(ActiveReleaseNotificationSent)
