from __future__ import annotations

import logging
from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING, Any

from slack_sdk.models.blocks.blocks import Block

from sentry.constants import ObjectStatus
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.service import (
    NotificationDataDto,
    NotificationService,
    NotificationServiceError,
)
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.slack.renderers.seer import SeerSlackRenderer
from sentry.notifications.platform.templates.seer import SeerAutofixUpdate
from sentry.notifications.platform.types import NotificationData, NotificationProviderKey
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.types import SeerEntrypointKey
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics
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
    logging_ctx = {
        "entrypoint_key": SeerEntrypointKey.SLACK.value,
        "integration_id": install.model.id,
        "thread_ts": thread["thread_ts"],
        "channel_id": thread["channel_id"],
        "data_source": data.source,
        "ephemeral_user_id": ephemeral_user_id,
    }
    provider = provider_registry.get(NotificationProviderKey.SLACK)
    template_cls = template_registry.get(data.source)
    renderable = NotificationService.render_template(
        data=data, template=template_cls(), provider=provider
    )
    metric_tags = {
        "data_source": str(data.source),
        "is_ephemeral": str(bool(ephemeral_user_id)),
    }
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
    except ValueError:
        logger.exception(
            "seer.entrypoint.slack.thread_update.invalid_integration", extra=logging_ctx
        )
        metrics.incr("seer.entrypoint.slack.thread_update.invalid_integration", tags=metric_tags)
        # No need to retry since these are configuration errors, and will just repeat
        return
    logger.info("seer.entrypoint.slack.thread_update.sent", extra=logging_ctx)
    metrics.incr("seer.entrypoint.slack.thread_update.sent", tags=metric_tags)


@instrumented_task(
    name="sentry.seer.entrypoints.slack.process_thread_update",
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

    logging_ctx = {
        "integration_id": integration_id,
        "organization_id": organization_id,
        "entrypoint_key": SeerEntrypointKey.SLACK.value,
    }

    try:
        data_dto = NotificationDataDto.from_dict(serialized_data)
    except (NotificationServiceError, NoRegistrationExistsError):
        logger.exception("seer.entrypoint.slack.thread_update.deserialize_error", extra=logging_ctx)
        return

    integration = integration_service.get_integration(
        integration_id=integration_id,
        organization_id=organization_id,
        provider=IntegrationProviderSlug.SLACK.value,
        status=ObjectStatus.ACTIVE,
    )
    if not integration:
        logger.error("seer.entrypoint.slack.thread_update.integration_not_found", extra=logging_ctx)
        return

    send_thread_update(
        install=SlackIntegration(model=integration, organization_id=organization_id),
        thread=thread,
        data=data_dto.notification_data,
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
    serialized_data = NotificationDataDto(notification_data=data).to_dict()

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
    slack_user_id: str | None,
) -> None:
    from sentry.integrations.slack.message_builder.types import SlackAction

    logging_ctx = {
        "entrypoint_key": SeerEntrypointKey.SLACK.value,
        "channel_id": channel_id,
        "message_ts": message_ts,
        "organization_id": data.organization_id,
    }

    def remove_autofix_button_transformer(elem: dict[str, Any]) -> dict[str, Any] | None:
        if elem.get("action_id", "").startswith(SlackAction.SEER_AUTOFIX_START.value):
            return None
        return elem

    def remove_all_buttons_transformer(elem: dict[str, Any]) -> dict[str, Any] | None:
        return None

    transformer = (
        remove_autofix_button_transformer
        if data.current_point == AutofixStoppingPoint.ROOT_CAUSE
        else remove_all_buttons_transformer
    )
    try:
        message_data = request.data["message"]
        original_blocks = message_data["blocks"]
        original_text = message_data["text"]
    except (KeyError, TypeError):
        logger.exception("seer.entrypoint.slack.message_update.invalid_payload", extra=logging_ctx)
        return

    blocks = _transform_block_actions(original_blocks, transformer)

    parsed_blocks = [Block.parse(block) for block in blocks]
    if slack_user_id:
        parsed_blocks.extend(
            SeerSlackRenderer.render_footer_blocks(
                data=data, extra_text=f"(ty <@{slack_user_id}>)", stage_completed=False
            )
        )
    else:
        parsed_blocks.extend(
            SeerSlackRenderer.render_footer_blocks(data=data, stage_completed=False)
        )

    renderable = SlackRenderable(
        blocks=[block for block in parsed_blocks if block is not None],
        text=original_text,
    )

    try:
        install.update_message(channel_id=channel_id, message_ts=message_ts, renderable=renderable)
    except IntegrationError:
        logger.exception("seer.entrypoint.slack.message_update.failed", extra=logging_ctx)
        logger.exception("seer.entrypoint.slack.message_update.failed", extra=logging_ctx)
