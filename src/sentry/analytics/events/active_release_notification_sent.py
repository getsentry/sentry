from sentry import analytics


class ActiveReleaseNotificationSent(analytics.Event):
    type = "active_release_notification.sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
        analytics.Attribute("providers"),
        analytics.Attribute("release_version"),
        analytics.Attribute("recipient_email"),
        analytics.Attribute("recipient_username"),
        analytics.Attribute("suspect_committer_ids"),
        analytics.Attribute("code_owner_ids"),
        analytics.Attribute("team_ids"),
    )


analytics.register(ActiveReleaseNotificationSent)
