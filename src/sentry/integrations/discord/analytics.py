from sentry import analytics


class DiscordIntegrationNotificationSent(analytics.Event):
    type = "integrations.discord.notification_sent"

    attributes = (
        analytics.Attribute("organization_id"),
        analytics.Attribute("project_id"),
        analytics.Attribute("group_id"),
    )


class DiscordIntegrationCommandInteractionReceived:
    type = "integrations.discord.command_interaction"

    attributes = analytics.Attribute("command_name")


class IntegrationIdentityLinked(analytics.Event):
    type = "integrations.identity_linked"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("actor_id"),
        analytics.Attribute("actor_type"),
    )


class IntegrationIdentityUnlinked(analytics.Event):
    type = "integrations.identity_unlinked"

    attributes = (
        analytics.Attribute("provider"),
        analytics.Attribute("actor_id"),
        analytics.Attribute("actor_type"),
    )


class DiscordIntegrationMessageInteractionReceived:
    type = "integrations.discord.message_interaction"

    attributes = analytics.Attribute("custom_id")


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
