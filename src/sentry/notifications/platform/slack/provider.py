from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, NotRequired, TypedDict

from slack_sdk.models.blocks import (
    ActionsBlock,
    Block,
    ButtonElement,
    ContextBlock,
    HeaderBlock,
    ImageBlock,
    MarkdownTextObject,
    PlainTextObject,
    SectionBlock,
)

from sentry.notifications.platform.provider import (
    NotificationProvider,
    NotificationProviderError,
    ProviderThreadingContext,
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
    NotificationBodyFormattingBlock,
    NotificationBodyFormattingBlockType,
    NotificationBodyTextBlock,
    NotificationBodyTextBlockType,
    NotificationCategory,
    NotificationData,
    NotificationProviderKey,
    NotificationRenderedTemplate,
    NotificationTarget,
    NotificationTargetResourceType,
)
from sentry.organizations.services.organization.model import RpcOrganizationSummary
from sentry.shared_integrations.exceptions import IntegrationError

if TYPE_CHECKING:
    from sentry.integrations.slack.integration import SlackIntegration


@dataclass(frozen=True)
class SlackProviderThreadingContext(ProviderThreadingContext):
    """Slack-specific threading context passed to the Slack integration client."""

    thread_ts: str | None = None


class SlackRenderable(TypedDict):
    blocks: list[Block]
    attachments: NotRequired[list[dict[str, Any]]]
    text: str


class SlackRenderer(NotificationRenderer[SlackRenderable]):
    provider_key = NotificationProviderKey.SLACK

    @classmethod
    def render[DataT: NotificationData](
        cls, *, data: DataT, rendered_template: NotificationRenderedTemplate
    ) -> SlackRenderable:
        subject = HeaderBlock(text=PlainTextObject(text=rendered_template.subject))
        body_blocks: list[Block] = cls._render_body(rendered_template.body)

        blocks = [subject, *body_blocks]

        if len(rendered_template.actions) > 0:
            actions_block = ActionsBlock(elements=[])
            for action in rendered_template.actions:
                actions_block.elements.append(ButtonElement(text=action.label, url=action.link))
            blocks.append(actions_block)

        if rendered_template.chart:
            chart = ImageBlock(
                image_url=rendered_template.chart.url, alt_text=rendered_template.chart.alt_text
            )
            blocks.append(chart)
        if rendered_template.footer:
            footer = ContextBlock(elements=[MarkdownTextObject(text=rendered_template.footer)])
            blocks.append(footer)

        return SlackRenderable(blocks=blocks, text=rendered_template.subject)

    @classmethod
    def _render_body(cls, body: list[NotificationBodyFormattingBlock]) -> list[Block]:
        blocks: list[Block] = []
        for block in body:
            if block.type == NotificationBodyFormattingBlockType.PARAGRAPH:
                text = cls._render_text_blocks(block.blocks)
                blocks.append(SectionBlock(text=MarkdownTextObject(text=text)))
            elif block.type == NotificationBodyFormattingBlockType.CODE_BLOCK:
                text = cls._render_text_blocks(block.blocks)
                blocks.append(SectionBlock(text=MarkdownTextObject(text=f"```{text}```")))
        return blocks

    @classmethod
    def _render_text_blocks(cls, blocks: list[NotificationBodyTextBlock]) -> str:
        texts = []
        for block in blocks:
            if block.type == NotificationBodyTextBlockType.PLAIN_TEXT:
                texts.append(block.text)
            elif block.type == NotificationBodyTextBlockType.BOLD_TEXT:
                texts.append(f"*{block.text}*")
            elif block.type == NotificationBodyTextBlockType.CODE:
                texts.append(f"`{block.text}`")
        return " ".join(texts)


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
        # I currently view this as akin to a rollout or feature flag for the registry
        return False

    @classmethod
    def get_renderer(
        cls, *, data: NotificationData, category: NotificationCategory
    ) -> type[NotificationRenderer[SlackRenderable]]:
        from sentry.notifications.platform.slack.renderers.issue import (
            IssueSlackRenderer,
        )
        from sentry.notifications.platform.slack.renderers.metric_alert import (
            SlackMetricAlertRenderer,
        )
        from sentry.notifications.platform.slack.renderers.seer import SeerSlackRenderer

        if category == NotificationCategory.SEER:
            return SeerSlackRenderer
        if category == NotificationCategory.ISSUE:
            return IssueSlackRenderer
        if category == NotificationCategory.METRIC_ALERT:
            return SlackMetricAlertRenderer
        return cls.default_renderer

    @classmethod
    def send(
        cls,
        *,
        target: NotificationTarget,
        renderable: SlackRenderable,
        thread_context: ThreadContext | None = None,
    ) -> SendResult:
        from sentry.integrations.slack.integration import SlackIntegration

        if not isinstance(target, cls.target_class):
            raise NotificationProviderError(
                f"Target '{target.__class__.__name__}' is not a valid dataclass for {cls.__name__}"
            )

        slack_target = PreparedIntegrationNotificationTarget[SlackIntegration](
            target=target, installation_cls=SlackIntegration
        )

        if thread_context is not None:
            return cls._send_with_threading(
                slack_target=slack_target, renderable=renderable, thread_context=thread_context
            )

        try:
            slack_target.integration_installation.send_notification(
                target=target, payload=renderable
            )
        except IntegrationError as e:
            return integration_error_result(e)

        return SendSuccessResult()

    @classmethod
    def _send_with_threading(
        cls,
        slack_target: PreparedIntegrationNotificationTarget[SlackIntegration],
        renderable: SlackRenderable,
        thread_context: ThreadContext,
    ) -> SendResult:
        provider_threading_ctx = SlackProviderThreadingContext(
            thread_ts=(thread_context.thread.thread_identifier if thread_context.thread else None),
            reply_broadcast=thread_context.reply_broadcast,
        )

        try:
            response = slack_target.integration_installation.send_notification_with_threading(
                target=slack_target.target,
                payload=renderable,
                threading_context=provider_threading_ctx,
            )
            return SendSuccessResult(provider_message_id=response.get("ts"), is_threaded=True)
        except IntegrationError as e:
            return integration_error_result(e, is_threaded=True)


@provider_registry.register(NotificationProviderKey.SLACK_STAGING)
class SlackStagingNotificationProvider(SlackNotificationProvider):
    key = NotificationProviderKey.SLACK_STAGING
