from typing import TypedDict

from django.core.exceptions import ValidationError
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

from sentry.integrations.slack.sdk_client import SlackSdkClient
from sentry.integrations.slack.utils.channel import validate_slack_entity_id
from sentry.notifications.platform.provider import NotificationProvider, NotificationProviderError
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
from sentry.notifications.platform.utiils import validate_integration_for_target
from sentry.organizations.services.organization.model import RpcOrganizationSummary
from sentry.shared_integrations.exceptions import IntegrationError


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
    def validate_target(cls, *, target: NotificationTarget) -> None:
        super().validate_target(target=target)

        assert isinstance(
            target, cls.target_class
        ), "Target for SlackNotificationProvider must be a IntegrationNotificationTarget"

        # 1. Validate the integration exists
        # 2. Validate the organization integration exists
        validate_integration_for_target(target=target)

        # 3. Validate the Slack channel or user exists
        channel_name = target.specific_data.get("channel_name") if target.specific_data else None
        if channel_name is None:
            raise NotificationProviderError(
                f"Slack channel or user with id '{target.resource_id}' could not be validated"
            )

        try:
            validate_slack_entity_id(
                integration_id=target.integration_id,
                input_name=channel_name,
                input_id=target.resource_id,
            )
        except (ValidationError, IntegrationError) as e:
            raise NotificationProviderError(
                f"Slack channel or user with id '{target.resource_id}' could not be validated"
            ) from e

    @classmethod
    def is_available(cls, *, organization: RpcOrganizationSummary | None = None) -> bool:
        # TODO(ecosystem): Check for the integration, maybe a feature as well
        # I currently view this as akin to a rollout or feature flag for the registry
        return False

    @classmethod
    def send(cls, *, target: NotificationTarget, renderable: SlackRenderable) -> None:
        if not isinstance(target, cls.target_class):
            raise NotificationProviderError(
                f"Target '{target.__class__.__name__}' is not a valid dataclass for {cls.__name__}"
            )

        client = SlackSdkClient(integration_id=target.integration_id)
        client.chat_postMessage(channel=target.resource_id, blocks=renderable["blocks"])
