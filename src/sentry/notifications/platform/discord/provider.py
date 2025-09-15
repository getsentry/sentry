from typing import TYPE_CHECKING

from sentry.notifications.platform.provider import NotificationProvider
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationTarget,
    NotificationTargetResourceType,
)
from sentry.organizations.services.organization.model import RpcOrganizationSummary

if TYPE_CHECKING:
    from sentry.integrations.discord.message_builder.base.base import DiscordMessage

# TODO(ecosystem): Proper typing - https://discord.com/developers/docs/resources/message#create-message
type DiscordRenderable = DiscordMessage


class DiscordRenderer(NotificationRenderer[DiscordRenderable]):
    provider_key = NotificationProviderKey.DISCORD

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> DiscordRenderable:
        from sentry.integrations.discord.message_builder.base.base import DiscordMessageBuilder
        from sentry.integrations.discord.message_builder.base.component.action_row import (
            DiscordActionRow,
        )
        from sentry.integrations.discord.message_builder.base.component.base import (
            DiscordMessageComponent,
        )
        from sentry.integrations.discord.message_builder.base.component.button import DiscordButton
        from sentry.integrations.discord.message_builder.base.embed.base import DiscordMessageEmbed
        from sentry.integrations.discord.message_builder.base.embed.footer import (
            DiscordMessageEmbedFooter,
        )
        from sentry.integrations.discord.message_builder.base.embed.image import (
            DiscordMessageEmbedImage,
        )

        components: list[DiscordMessageComponent] = []
        embeds = []

        embeds.append(
            DiscordMessageEmbed(
                title=rendered_template.subject,
                description=rendered_template.body,
                image=(
                    DiscordMessageEmbedImage(url=rendered_template.chart.url)
                    if rendered_template.chart
                    else None
                ),
                footer=(
                    DiscordMessageEmbedFooter(text=rendered_template.footer)
                    if rendered_template.footer
                    else None
                ),
            )
        )

        if len(rendered_template.actions) > 0:
            buttons = [
                DiscordButton(
                    custom_id=action.label.lower().replace(" ", "_"),
                    label=action.label,
                    url=action.link,
                )
                for action in rendered_template.actions
            ]
            components.append(DiscordActionRow(components=buttons))

        builder = DiscordMessageBuilder(embeds=embeds, components=components)

        return builder.build()


@provider_registry.register(NotificationProviderKey.DISCORD)
class DiscordNotificationProvider(NotificationProvider[DiscordRenderable]):
    key = NotificationProviderKey.DISCORD
    default_renderer = DiscordRenderer
    target_class = IntegrationNotificationTarget
    target_resource_types = [
        NotificationTargetResourceType.CHANNEL,
        NotificationTargetResourceType.DIRECT_MESSAGE,
    ]

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        # TODO(ecosystem): Check for the integration, maybe a feature as well
        return False

    @classmethod
    def send(cls, *, target: NotificationTarget, renderable: DiscordRenderable) -> None:
        pass
