from sentry import analytics


class DiscordIntegrationNotificationSent(analytics.Event):
    type = "integrations.discord.notification_sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("category"),
        analytics.Attribute("group_id"),
        analytics.Attribute("notification_uuid"),
        analytics.Attribute("alert_id", required=False),
    )


class DiscordIntegrationCommandInteractionReceived(analytics.Event):
    type = "integrations.discord.command_interaction"

    attributes = (analytics.Attribute("command_name"),)


class DiscordIntegrationIdentityLinked(analytics.Event):
    type = "integrations.discord.identity_linked"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("actor_id"),
        analytics.Attribute("actor_type"),
    )


class DiscordIntegrationIdentityUnlinked(analytics.Event):
    type = "integrations.discord.identity_unlinked"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("actor_id"),
        analytics.Attribute("actor_type"),
    )


class DiscordIntegrationMessageInteractionReceived(analytics.Event):
    type = "integrations.discord.message_interaction"

    attributes = (analytics.Attribute("custom_id"),)


class DiscordIntegrationAssign(analytics.Event):
    type = "integrations.discord.assign"

    attributes = (analytics.Attribute("actor_id"),)


class DiscordIntegrationStatus(analytics.Event):
    type = "integrations.discord.status"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("user_id"),
        analytics.Attribute("status"),
    )


analytics.register(DiscordIntegrationNotificationSent)
analytics.register(DiscordIntegrationCommandInteractionReceived)
analytics.register(DiscordIntegrationIdentityLinked)
analytics.register(DiscordIntegrationIdentityUnlinked)
analytics.register(DiscordIntegrationMessageInteractionReceived)
analytics.register(DiscordIntegrationAssign)
analytics.register(DiscordIntegrationStatus)
