from typing import TypedDict

from slack_sdk.models.blocks import (
    ActionsBlock,
    Block,
    ButtonElement,
    HeaderBlock,
    ImageBlock,
    MarkdownTextObject,
    PlainTextObject,
    SectionBlock,
)

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


class SlackRenderable(TypedDict):
    blocks: list[Block]


class SlackRenderer(NotificationRenderer[SlackRenderable]):
    provider_key = NotificationProviderKey.SLACK

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        subject = HeaderBlock(text=PlainTextObject(text=rendered_template.subject))
        body = SectionBlock(text=MarkdownTextObject(text=rendered_template.body))

        blocks = [subject, body]

        if len(rendered_template.actions) > 0:
            actions_block = ActionsBlock(elements=[])
            for action in rendered_template.actions:
                actions_block.elements.append(ButtonElement(text=action.label, url=action.link))
            blocks.append(actions_block)

        if rendered_template.footer:
            footer = SectionBlock(text=MarkdownTextObject(text=rendered_template.footer))
            blocks.append(footer)
        if rendered_template.chart:
            chart = ImageBlock(
                image_url=rendered_template.chart.url, alt_text=rendered_template.chart.alt_text
            )
            blocks.append(chart)

        return SlackRenderable(blocks=blocks)


@provider_registry.register(NotificationProviderKey.SLACK)
class SlackNotificationProvider(NotificationProvider[SlackRenderable]):
    key = NotificationProviderKey.SLACK
    default_renderer = SlackRenderer
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
    def send(cls, *, target: NotificationTarget, renderable: SlackRenderable) -> None:
        pass
