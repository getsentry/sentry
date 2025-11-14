from typing import int
from sentry import analytics
from sentry.analytics.events.base_notification_sent import BaseNotificationSent


@analytics.eventclass("integrations.discord.notification_sent")
class DiscordIntegrationNotificationSent(BaseNotificationSent):
    pass


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
