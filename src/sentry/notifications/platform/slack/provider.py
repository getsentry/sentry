from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, NotRequired, TypedDict
from urllib.parse import parse_qs, urlsplit

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
from sentry.notifications.platform.tracking import (
    NotificationLinkDecorator,
    NotificationTrackingContext,
    is_tracking_enabled,
)
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
from sentry.utils.strings import truncatechars

if TYPE_CHECKING:
    from sentry.integrations.slack.integration import SlackIntegration
    from sentry.integrations.slack.message_builder.types import SlackAction

logger = logging.getLogger(__name__)

# chat.postMessage rejects payloads with more blocks than this with `invalid_blocks`.
SLACK_MAX_BLOCKS = 50


@dataclass(frozen=True)
class SlackProviderThreadingContext(ProviderThreadingContext):
    """Slack-specific threading context passed to the Slack integration client."""

    thread_ts: str | None = None


class SlackRenderable(TypedDict):
    blocks: list[Block]
    attachments: NotRequired[list[dict[str, Any]]]
    text: str


class SlackRenderer(NotificationRenderer[SlackRenderable]):
    @classmethod
    def render[DataT: NotificationData](
        cls,
        *,
        data: DataT,
        rendered_template: NotificationRenderedTemplate,
        link_decorator: NotificationLinkDecorator,
    ) -> SlackRenderable:
        # Slack does not support rich text in the subject
        subject_block = HeaderBlock(
            text=PlainTextObject(
                text=truncatechars(rendered_template.subject_text, HeaderBlock.text_max_length)
            )
        )
        body_blocks: list[Block] = cls._render_body(rendered_template.body)
        # Trim the body, not the header or trailing blocks, so the message stays actionable.
        trailing = (rendered_template.actions, rendered_template.chart, rendered_template.footer)
        max_body_blocks = SLACK_MAX_BLOCKS - 1 - sum(1 for block in trailing if block)
        if len(body_blocks) > max_body_blocks:
            # Say how much was cut so a shortened list (e.g. deploy commits) doesn't read as complete.
            kept = max_body_blocks - 1
            omitted = len(body_blocks) - kept
            body_blocks = [
                *body_blocks[:kept],
                ContextBlock(elements=[MarkdownTextObject(text=f"_…and {omitted} more_")]),
            ]

        blocks: list[Block] = [subject_block, *body_blocks]

        if len(rendered_template.actions) > 0:
            actions_block = ActionsBlock(elements=[])
            for action in rendered_template.actions:
                actions_block.elements.append(
                    ButtonElement(text=action.label, url=action.link, value="link_clicked")
                )
            blocks.append(actions_block)

        if rendered_template.chart:
            chart = ImageBlock(
                image_url=rendered_template.chart.url, alt_text=rendered_template.chart.alt_text
            )
            blocks.append(chart)
        if rendered_template.footer:
            footer_text = cls._render_text_blocks(rendered_template.footer_blocks)
            blocks.append(ContextBlock(elements=[MarkdownTextObject(text=footer_text)]))

        return SlackRenderable(blocks=blocks, text=rendered_template.subject_text)

    @classmethod
    def _render_body(cls, body: list[NotificationSection]) -> list[Block]:
        blocks: list[Block] = []
        for block in body:
            text = cls._render_text_blocks(block.blocks)
            if block.type == NotificationSectionType.PARAGRAPH:
                blocks.append(cls._render_section(text))
            elif block.type == NotificationSectionType.CODE_BLOCK:
                blocks.append(cls._render_section(text, wrapper="```"))
            elif block.type == NotificationSectionType.BLOCK_QUOTE:
                blocks.append(cls._render_section(text, prefix=">"))
        return blocks

    @classmethod
    def _render_section(cls, text: str, prefix: str = "", wrapper: str = "") -> SectionBlock:
        # Truncate the inner text so the markdown wrapper (e.g. a code fence) stays intact.
        max_length = SectionBlock.text_max_length - len(prefix) - 2 * len(wrapper)
        text = truncatechars(text, max_length)
        return SectionBlock(text=MarkdownTextObject(text=f"{prefix}{wrapper}{text}{wrapper}"))

    @classmethod
    def _render_text_blocks(cls, blocks: list[NotificationTextBlock]) -> str:
        texts = []
        for block in blocks:
            if block.type == NotificationTextBlockType.PLAIN_TEXT:
                texts.append(block.text)
            elif block.type == NotificationTextBlockType.BOLD_TEXT:
                texts.append(f"*{block.text}*")
            elif block.type == NotificationTextBlockType.ITALIC_TEXT:
                texts.append(f"_{block.text}_")
            elif block.type == NotificationTextBlockType.CODE:
                texts.append(f"`{block.text}`")
            elif block.type == NotificationTextBlockType.LINK and isinstance(block, LinkTextBlock):
                texts.append(f"<{block.url}|{block.text}>")
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
    def track_actions(
        cls, *, renderable: SlackRenderable, context: NotificationTrackingContext
    ) -> set[SlackAction]:
        """
        Adds the notification to the action ID of each button that calls back into Sentry, in the
        message's blocks and its attachments' blocks. Link buttons to tracked Sentry links are
        skipped, since page loads count their clicks, as are buttons whose action ID names no
        organization, since their clicks can't be attributed. Returns the Slack actions of the
        buttons marked. Never raises.
        """
        from sentry.integrations.slack.message_builder.routing import (
            SlackActionTracking,
            decode_action_id,
            encode_action_id,
        )
        from sentry.integrations.slack.message_builder.types import SlackAction

        if not context.notification_uuid or not is_tracking_enabled(
            context.source, context.provider
        ):
            return set()
        tracking = SlackActionTracking(
            notification_uuid=context.notification_uuid, source=context.source
        )
        tracked: set[SlackAction] = set()

        def track(action_id: str | None) -> str | None:
            if not action_id:
                return None
            routing_data = decode_action_id(action_id)
            if routing_data.action not in SlackAction or routing_data.organization_id is None:
                return None
            tracked_action_id = encode_action_id(
                action=routing_data.action,
                organization_id=routing_data.organization_id,
                project_id=routing_data.project_id,
                suffix=routing_data.suffix,
                tracking=tracking,
            )
            if tracked_action_id == action_id:
                return None
            tracked.add(SlackAction(routing_data.action))
            return tracked_action_id

        def is_counted_by_page_load(url: str | None) -> bool:
            """
            Whether the button opens a link decorated with this notification, whose clicks the
            click middleware records when the page loads. Marking such a button too would count
            each click twice.
            """
            if not url:
                return False
            query = parse_qs(urlsplit(url).query)
            return context.notification_uuid in query.get("notification_uuid", [])

        try:
            attachment_blocks = [
                block
                for attachment in renderable.get("attachments", [])
                for block in attachment.get("blocks", [])
            ]
            for block in [*renderable["blocks"], *attachment_blocks]:
                if isinstance(block, ActionsBlock):
                    for element in block.elements:
                        if (
                            isinstance(element, ButtonElement)
                            and not is_counted_by_page_load(element.url)
                            and (tracked_action_id := track(element.action_id))
                        ):
                            element.action_id = tracked_action_id
                elif isinstance(block, dict) and block.get("type") == "actions":
                    for element in block.get("elements", []):
                        if (
                            element.get("type") == "button"
                            and not is_counted_by_page_load(element.get("url"))
                            and (tracked_action_id := track(element.get("action_id")))
                        ):
                            element["action_id"] = tracked_action_id
        except Exception:
            logger.exception(
                "notifications.tracking.track_actions.failed", extra={"source": context.source}
            )
        return tracked

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
            response = slack_target.integration_installation.send_notification(
                target=target, payload=renderable
            )
        except IntegrationError as e:
            return integration_error_result(e)

        return SendSuccessResult(provider_message_id=response.get("ts"))

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
            response = slack_target.integration_installation.send_notification_with_response(
                target=slack_target.target,
                payload=renderable,
                threading_context=provider_threading_ctx,
            )
            return SendSuccessResult(
                provider_message_id=response.get("ts"),
                is_threaded=True,
                thread_identifier=provider_threading_ctx.thread_ts,
            )
        except IntegrationError as e:
            return integration_error_result(e, is_threaded=True)


@provider_registry.register(NotificationProviderKey.SLACK_STAGING)
class SlackStagingNotificationProvider(SlackNotificationProvider):
    key = NotificationProviderKey.SLACK_STAGING
    renderer_key = NotificationProviderKey.SLACK
