from sentry import analytics


class ActiveReleaseNotificationDryRun(analytics.Event):
    type = "active_release_notification.dry_run"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("release_version"),
        analytics.Attribute("recipient_id"),
    )


analytics.register(ActiveReleaseNotificationDryRun)
