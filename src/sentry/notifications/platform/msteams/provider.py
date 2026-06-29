from __future__ import annotations

from typing import TYPE_CHECKING

from sentry.notifications.platform.provider import (
    NotificationProvider,
    NotificationProviderError,
    SendResult,
    SendSuccessResult,
    integration_error_result,
)
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.renderer import NotificationRenderer
from sentry.notifications.platform.target import (
    IntegrationNotificationTarget,
    PreparedIntegrationNotificationTarget,
)
from sentry.notifications.platform.threading import ThreadContext
from sentry.notifications.platform.types import (
    LinkTextBlock,
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationSection,
    NotificationSectionType,
    NotificationTarget,
    NotificationTargetResourceType,
    NotificationTextBlock,
    NotificationTextBlockType,
)
from sentry.organizations.services.organization.model import RpcOrganizationSummary
from sentry.shared_integrations.exceptions import IntegrationError

if TYPE_CHECKING:
    from sentry.integrations.msteams.card_builder.block import AdaptiveCard, Block, TextSize

type MSTeamsRenderable = AdaptiveCard


class MSTeamsRenderer(NotificationRenderer[MSTeamsRenderable]):
    provider_key = NotificationProviderKey.MSTEAMS

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> MSTeamsRenderable:
        from sentry.integrations.msteams.card_builder.block import (
            ADAPTIVE_CARD_SCHEMA_URL,
            CURRENT_CARD_VERSION,
            Action,
            ActionSet,
            ActionType,
            ImageBlock,
            OpenUrlAction,
            TextSize,
            TextWeight,
            create_text_block,
        )

        subject_text = cls.render_text_blocks(rendered_template.subject_blocks)
        title_text = create_text_block(
            text=subject_text, size=TextSize.LARGE, weight=TextWeight.BOLDER
        )
        body_text = cls.render_body_blocks(rendered_template.body)
        body_blocks: list[Block] = [title_text, *body_text]

        if len(rendered_template.actions) > 0:
            actions: list[Action] = []
            for action in rendered_template.actions:
                actions.append(
                    OpenUrlAction(type=ActionType.OPEN_URL, title=action.label, url=action.link)
                )

            actions_block = ActionSet(type="ActionSet", actions=actions)
            body_blocks.append(actions_block)

        if rendered_template.chart is not None:
            chart_image = ImageBlock(
                type="Image",
                url=rendered_template.chart.url,
                altText=rendered_template.chart.alt_text,
            )
            body_blocks.append(chart_image)

        if rendered_template.footer is not None:
            footer_str = cls.render_text_blocks(rendered_template.footer_blocks)
            body_blocks.append(create_text_block(text=footer_str, size=TextSize.SMALL))

        card: AdaptiveCard = {
            "type": "AdaptiveCard",
            "body": body_blocks,
            "version": CURRENT_CARD_VERSION,
            "$schema": ADAPTIVE_CARD_SCHEMA_URL,
        }
        return card

    @classmethod
    def render_body_blocks(
        cls, body: list[NotificationSection], size: TextSize | None = None
    ) -> list[Block]:
        from sentry.integrations.msteams.card_builder.block import (
            TextSize,
            create_code_block,
            create_text_block,
        )

        if size is None:
            size = TextSize.MEDIUM

        body_blocks: list[Block] = []
        for block in body:
            if block.type == NotificationSectionType.PARAGRAPH:
                body_blocks.append(
                    create_text_block(text=cls.render_text_blocks(block.blocks), size=size)
                )
            elif block.type == NotificationSectionType.CODE_BLOCK:
                body_blocks.append(create_code_block(text=cls.render_text_blocks(block.blocks)))
        return body_blocks

    @classmethod
    def render_text_blocks(cls, blocks: list[NotificationTextBlock]) -> str:
        texts = []
        for block in blocks:
            if block.type == NotificationTextBlockType.PLAIN_TEXT:
                texts.append(block.text)
            elif block.type == NotificationTextBlockType.BOLD_TEXT:
                texts.append(f"**{block.text}**")
            elif block.type == NotificationTextBlockType.CODE:
                texts.append(f"`{block.text}`")
            elif block.type == NotificationTextBlockType.LINK and isinstance(block, LinkTextBlock):
                texts.append(f"[{block.text}]({block.url})")
        return " ".join(texts)


@provider_registry.register(NotificationProviderKey.MSTEAMS)
class MSTeamsNotificationProvider(NotificationProvider[MSTeamsRenderable]):
    key = NotificationProviderKey.MSTEAMS
    default_renderer = MSTeamsRenderer
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
    def send(
        cls,
        *,
        target: NotificationTarget,
        renderable: MSTeamsRenderable,
        thread_context: ThreadContext | None = None,
    ) -> SendResult:
        from sentry.integrations.msteams.integration import MsTeamsIntegration

        if not isinstance(target, cls.target_class):
            raise NotificationProviderError(
                f"Target '{target.__class__.__name__}' is not a valid dataclass for {cls.__name__}"
            )

        msteams_target = PreparedIntegrationNotificationTarget[MsTeamsIntegration](
            target=target, installation_cls=MsTeamsIntegration
        )
        try:
            msteams_target.integration_installation.send_notification(
                target=target, payload=renderable
            )
        except IntegrationError as e:
            return integration_error_result(e)
        return SendSuccessResult()
