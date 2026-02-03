from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.notifications.platform.provider import NotificationProvider, NotificationProviderError
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.target import (
    IntegrationNotificationTarget,
    PreparedIntegrationNotificationTarget,
)
from sentry.notifications.platform.types import (
    NotificationBodyFormattingBlock,
    NotificationBodyFormattingBlockType,
    NotificationBodyTextBlock,
    NotificationBodyTextBlockType,
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
        from sentry.integrations.discord.message_builder.base.component.button import (
            DiscordLinkButton,
        )
        from sentry.integrations.discord.message_builder.base.embed.base import DiscordMessageEmbed
        from sentry.integrations.discord.message_builder.base.embed.footer import (
            DiscordMessageEmbedFooter,
        )
        from sentry.integrations.discord.message_builder.base.embed.image import (
            DiscordMessageEmbedImage,
        )

        components: list[DiscordMessageComponent] = []
        embeds = []

        body_blocks = cls.render_body_blocks(rendered_template.body)

        embeds.append(
            DiscordMessageEmbed(
                title=rendered_template.subject,
                description=body_blocks,
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
                DiscordLinkButton(
                    label=action.label,
                    url=action.link,
                )
                for action in rendered_template.actions
            ]
            components.append(DiscordActionRow(components=buttons))

        builder = DiscordMessageBuilder(embeds=embeds, components=components)

        return builder.build()

    @classmethod
    def render_body_blocks(cls, body: list[NotificationBodyFormattingBlock]) -> str:

        description = []
        for block in body:
            if block.type == NotificationBodyFormattingBlockType.PARAGRAPH:
                description.append(f"\n{cls.render_text_blocks(block.blocks)}")
            elif block.type == NotificationBodyFormattingBlockType.CODE_BLOCK:
                description.append(f"\n```{cls.render_text_blocks(block.blocks)}```")
        return "".join(description)

    @classmethod
    def render_text_blocks(cls, blocks: list[NotificationBodyTextBlock]) -> str:
        texts = []
        for block in blocks:
            if block.type == NotificationBodyTextBlockType.PLAIN_TEXT:
                texts.append(block.text)
            elif block.type == NotificationBodyTextBlockType.BOLD_TEXT:
                texts.append(f"**{block.text}**")
            elif block.type == NotificationBodyTextBlockType.CODE:
                texts.append(f"`{block.text}`")
        return " ".join(texts)


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
        from sentry.integrations.discord.integration import DiscordIntegration

        if not isinstance(target, cls.target_class):
            raise NotificationProviderError(
                f"Target '{target.__class__.__name__}' is not a valid dataclass for {cls.__name__}"
            )

        discord_target = PreparedIntegrationNotificationTarget[DiscordIntegration](
            target=target, installation_cls=DiscordIntegration
        )
        discord_target.integration_installation.send_notification(target=target, payload=renderable)
