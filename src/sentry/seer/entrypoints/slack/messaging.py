from __future__ import annotations

import logging
from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING, Any

from pydantic import ValidationError
from slack_sdk.models.blocks import ActionsBlock, ButtonElement, LinkButtonElement, MarkdownBlock
from slack_sdk.models.blocks.blocks import Block
from taskbroker_client.retry import Retry

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration.model import RpcIntegration
from sentry.integrations.services.integration.service import integration_service
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.service import (
    NotificationService,
    NotificationServiceError,
    deserialize_notification_data,
    serialize_notification_data,
)
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.slack.renderers.seer import SeerSlackRenderer
from sentry.notifications.platform.templates.seer import SeerAutofixUpdate
from sentry.notifications.platform.types import NotificationData, NotificationProviderKey
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.metrics import (
    SlackEntrypointEventLifecycleMetric,
    SlackEntrypointInteractionType,
)
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.utils.registry import NoRegistrationExistsError

if TYPE_CHECKING:
    from sentry.integrations.slack.integration import SlackIntegration
    from sentry.integrations.slack.requests.action import SlackActionRequest
    from sentry.seer.entrypoints.slack.entrypoint import SlackThreadDetails


logger = logging.getLogger(__name__)


def send_thread_update(
    *,
    install: SlackIntegration,
    thread: SlackThreadDetails,
    data: NotificationData,
    ephemeral_user_id: str | None = None,
) -> None:
    """Actually sends the update, but requires a SlackIntegration, so we can't schedule it as a task."""
    with SlackEntrypointEventLifecycleMetric(
        interaction_type=SlackEntrypointInteractionType.SEND_THREAD_UPDATE,
        integration_id=install.model.id,
        organization_id=install.organization_id,
    ).capture() as lifecycle:
        lifecycle.add_extras(
            {
                "thread_ts": thread["thread_ts"],
                "channel_id": thread["channel_id"],
                "data_source": data.source,
                "ephemeral_user_id": ephemeral_user_id,
            }
        )
        provider = provider_registry.get(NotificationProviderKey.SLACK)
        template_cls = template_registry.get(data.source)
        renderable = NotificationService.render_template(
            data=data, template=template_cls(), provider=provider
        )
        try:
            if ephemeral_user_id:
                install.send_threaded_ephemeral_message(
                    channel_id=thread["channel_id"],
                    thread_ts=thread["thread_ts"],
                    renderable=renderable,
                    slack_user_id=ephemeral_user_id,
                )
            else:
                install.send_threaded_message(
                    channel_id=thread["channel_id"],
                    thread_ts=thread["thread_ts"],
                    renderable=renderable,
                )
        except IntegrationConfigurationError as e:
            lifecycle.record_halt(halt_reason=e)
        except IntegrationError as e:
            lifecycle.record_failure(failure_reason=e)
            # Retry, hopefully it's transient
            raise


@instrumented_task(
    name="sentry.seer.entrypoints.slack.process_thread_update",
    alias="sentry.seer.entrypoints.integrations.slack.process_thread_update",
    namespace=integrations_tasks,
    processing_deadline_duration=30,
    retry=Retry(times=2, delay=30),
)
def process_thread_update(
    *,
    integration_id: int,
    organization_id: int,
    thread: SlackThreadDetails,
    serialized_data: dict[str, Any],
    ephemeral_user_id: str | None = None,
) -> None:
    """
    Wraps 'send_thread_update' to get a SlackIntegration, so both the task and function can use the same
    sending logic.
    """

    from sentry.integrations.slack.integration import SlackIntegration

    with SlackEntrypointEventLifecycleMetric(
        interaction_type=SlackEntrypointInteractionType.PROCESS_THREAD_UPDATE,
        integration_id=integration_id,
        organization_id=organization_id,
    ).capture() as lifecycle:
        try:
            notification_data = deserialize_notification_data(serialized_data)
        except (NotificationServiceError, NoRegistrationExistsError, ValidationError) as e:
            lifecycle.record_failure(failure_reason=e)
            return

        integration = integration_service.get_integration(
            integration_id=integration_id,
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
        )
        if not integration:
            lifecycle.record_failure(failure_reason="integration_not_found")
            return

    send_thread_update(
        install=SlackIntegration(model=integration, organization_id=organization_id),
        thread=thread,
        data=notification_data,
        ephemeral_user_id=ephemeral_user_id,
    )


def schedule_all_thread_updates(
    *,
    threads: list[SlackThreadDetails],
    integration_id: int,
    organization_id: int,
    data: NotificationData,
    ephemeral_user_id: str | None = None,
) -> None:
    """Schedules a task for each thread update to allow retries."""
    with SlackEntrypointEventLifecycleMetric(
        interaction_type=SlackEntrypointInteractionType.SCHEDULE_ALL_THREAD_UPDATES,
        integration_id=integration_id,
        organization_id=organization_id,
    ).capture() as lifecycle:
        serialized_data = serialize_notification_data(data)
        lifecycle.add_extra("thread_count", len(threads))
        for thread in threads:
            process_thread_update.apply_async(
                kwargs={
                    "integration_id": integration_id,
                    "organization_id": organization_id,
                    "thread": thread,
                    "serialized_data": serialized_data,
                    "ephemeral_user_id": ephemeral_user_id,
                },
            )


def _transform_block_actions(
    blocks: Sequence[dict[str, Any]],
    transform_fn: Callable[[dict[str, Any]], dict[str, Any] | None],
) -> list[dict[str, Any]]:
    """
    Transform action elements within top-level action blocks. Does not traverse nested blocks.
    """
    result = []
    for block in blocks:
        if block["type"] != "actions":
            result.append(block)
            continue

        transformed_elements = []
        for elem in block["elements"]:
            transformed = transform_fn(elem)
            if transformed is not None:
                transformed_elements.append(transformed)

        if transformed_elements:
            result.append({**block, "elements": transformed_elements})

    return result


def update_existing_message(
    *,
    request: SlackActionRequest,
    install: SlackIntegration,
    channel_id: str,
    message_ts: str,
    data: SeerAutofixUpdate,
    has_complete_stage: bool,
    slack_user_id: str | None,
) -> None:
    from sentry.integrations.slack.message_builder.types import SlackAction

    def remove_autofix_button_transformer(elem: dict[str, Any]) -> dict[str, Any] | None:
        if elem.get("action_id", "").startswith(SlackAction.SEER_AUTOFIX_START.value):
            return None
        return elem

    def remove_all_buttons_transformer(_elem: dict[str, Any]) -> dict[str, Any] | None:
        return None

    with SlackEntrypointEventLifecycleMetric(
        interaction_type=SlackEntrypointInteractionType.UPDATE_EXISTING_MESSAGE,
        integration_id=install.model.id,
        organization_id=data.organization_id,
    ).capture() as lifecycle:
        lifecycle.add_extras(
            {
                "channel_id": channel_id,
                "message_ts": message_ts,
                "organization_id": data.organization_id,
            }
        )

        # The RCA button is on an issue alert, so we just remove the button from the list of actions.
        # Later updates only have autofix buttons (View, Start), so we remove the whole actions block.
        # This is because we add the View button back to the footer, along with some status text.
        transformer = (
            remove_autofix_button_transformer
            if data.current_point == AutofixStoppingPoint.ROOT_CAUSE
            else remove_all_buttons_transformer
        )
        try:
            message_data = request.data["message"]
            original_blocks = message_data["blocks"]
            original_text = message_data["text"]
        except (KeyError, TypeError) as e:
            lifecycle.record_failure(failure_reason=e)
            return

        blocks = _transform_block_actions(original_blocks, transformer)

        parsed_blocks = [Block.parse(block) for block in blocks]
        footer_extra_text = f"(ty <@{slack_user_id}>)" if slack_user_id else None
        footer_blocks = SeerSlackRenderer.render_footer_blocks(
            data=data, extra_text=footer_extra_text, has_complete_stage=has_complete_stage
        )
        parsed_blocks.extend(footer_blocks)

        renderable = SlackRenderable(
            blocks=[block for block in parsed_blocks if block is not None],
            text=original_text,
        )

        try:
            install.update_message(
                channel_id=channel_id, message_ts=message_ts, renderable=renderable
            )

        except (IntegrationError, IntegrationConfigurationError) as e:
            lifecycle.record_halt(halt_reason=e)


def send_identity_link_prompt(
    *,
    integration: RpcIntegration,
    slack_user_id: str,
    channel_id: str,
    thread_ts: str | None,
    is_welcome_message: bool = False,
) -> None:
    from sentry.integrations.slack.integration import SlackIntegration
    from sentry.integrations.slack.message_builder.types import SlackAction
    from sentry.integrations.slack.views.link_identity import build_linking_url

    # TODO(leander): We'll need to revisit the UX around linking. We can't pass threads here so while
    # the linking start message is correctly located and ephemeral, the success message afterwards is not.
    # By omitting the response_url here, it will arrive as a DM, but it doesn't accept threads so this is the best we can do for now.
    associate_url = build_linking_url(
        integration=integration,
        slack_id=slack_user_id,
        channel_id=channel_id,
        response_url=None,
    )
    message = (
        "Link your Slack account to Sentry — so bugs find you, not the other way around."
        if is_welcome_message
        else "I'd love to help, but I don't know you like that — link your Slack account to Sentry first."
    )
    renderable = SlackRenderable(
        blocks=[
            MarkdownBlock(text=message),
            ActionsBlock(
                elements=[
                    ButtonElement(text="Cancel", value="ignore"),
                    LinkButtonElement(
                        text="Link",
                        url=associate_url,
                        style="primary",
                        action_id=SlackAction.LINK_IDENTITY.value,
                    ),
                ]
            ),
        ],
        text=message,
    )
    try:
        SlackIntegration.send_threaded_ephemeral_message_static(
            integration_id=integration.id,
            channel_id=channel_id,
            thread_ts=thread_ts,
            renderable=renderable,
            slack_user_id=slack_user_id,
        )
    except Exception:
        logger.exception(
            "send_identity_link_prompt.error",
            extra={
                "integration_id": integration.id,
                "channel_id": channel_id,
                "thread_ts": thread_ts,
                "slack_user_id": slack_user_id,
            },
        )
