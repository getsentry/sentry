from sentry import analytics


@analytics.eventclass("integrations.discord.notification_sent")
class DiscordIntegrationNotificationSent(analytics.Event):
    organization_id: int
    project_id: int
    category: str
    group_id: str
    notification_uuid: str
    alert_id: int | None = None


@analytics.eventclass("integrations.discord.command_interaction")
class DiscordIntegrationCommandInteractionReceived(analytics.Event):
    command_name: str


@analytics.eventclass("integrations.discord.identity_linked")
class DiscordIntegrationIdentityLinked(analytics.Event):
    provider: str
    actor_id: int
    actor_type: str


@analytics.eventclass("integrations.discord.identity_unlinked")
class DiscordIntegrationIdentityUnlinked(analytics.Event):
    provider: str
    actor_id: int
    actor_type: str


@analytics.eventclass("integrations.discord.message_interaction")
class DiscordIntegrationMessageInteractionReceived(analytics.Event):
    custom_id: str


@analytics.eventclass("integrations.discord.assign")
class DiscordIntegrationAssign(analytics.Event):
    actor_id: int


@analytics.eventclass("integrations.discord.status")
class DiscordIntegrationStatus(analytics.Event):
    organization_id: int
    user_id: int
    status: str


analytics.register(DiscordIntegrationCommandInteractionReceived)
analytics.register(DiscordIntegrationIdentityLinked)
analytics.register(DiscordIntegrationIdentityUnlinked)
analytics.register(DiscordIntegrationMessageInteractionReceived)
analytics.register(DiscordIntegrationAssign)
analytics.register(DiscordIntegrationStatus)
