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
    from sentry.integrations.msteams.card_builder.block import AdaptiveCard

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
            AdaptiveCard,
            Block,
            ImageBlock,
            OpenUrlAction,
            TextSize,
            TextWeight,
            create_text_block,
        )

        title_text = create_text_block(
            text=rendered_template.subject, size=TextSize.LARGE, weight=TextWeight.BOLDER
        )
        body_text = create_text_block(text=rendered_template.body)

        body_blocks: list[Block] = [title_text, body_text]

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
            footer_text = create_text_block(text=rendered_template.footer, size=TextSize.SMALL)
            body_blocks.append(footer_text)

        card: AdaptiveCard = {
            "type": "AdaptiveCard",
            "body": body_blocks,
            "version": CURRENT_CARD_VERSION,
            "$schema": ADAPTIVE_CARD_SCHEMA_URL,
        }
        return card


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
    def send(cls, *, target: NotificationTarget, renderable: MSTeamsRenderable) -> None:
        pass
