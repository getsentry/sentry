from __future__ import annotations

import logging
from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING, Any, TypedDict

from slack_sdk.models.blocks.blocks import Block

from sentry import features
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.types import IntegrationProviderSlug
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.service import (
    NotificationDataDto,
    NotificationService,
    NotificationServiceError,
)
from sentry.notifications.platform.slack.provider import SlackRenderable
from sentry.notifications.platform.templates.seer import (
    SeerAutofixError,
    SeerAutofixSuccess,
    SeerAutofixUpdate,
)
from sentry.notifications.platform.types import NotificationData, NotificationProviderKey
from sentry.notifications.utils.actions import BlockKitMessageAction
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.cache import SeerOperatorAutofixCache
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry
from sentry.utils.locking import UnableToAcquireLock
from sentry.utils.registry import NoRegistrationExistsError

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.integrations.slack.integration import SlackIntegration
    from sentry.integrations.slack.requests.action import SlackActionRequest
    from sentry.models.group import Group


class SlackThreadDetails(TypedDict):
    thread_ts: str
    channel_id: str


class SlackEntrypointCachePayload(TypedDict):
    organization_id: int
    project_id: int
    group_id: int
    integration_id: int
    group_link: str
    threads: list[SlackThreadDetails]


@entrypoint_registry.register(key=SeerEntrypointKey.SLACK)
class SlackEntrypoint(SeerEntrypoint[SlackEntrypointCachePayload]):
    key = SeerEntrypointKey.SLACK
    autofix_stopping_point: AutofixStoppingPoint = AutofixStoppingPoint.ROOT_CAUSE

    def __init__(
        self,
        slack_request: SlackActionRequest,
        group: Group,
        organization_id: int,
        action: BlockKitMessageAction,
    ):
        from sentry.integrations.slack.integration import SlackIntegration

        self.slack_request = slack_request
        self.group = group
        self.channel_id = slack_request.channel_id or ""
        self.thread_ts = slack_request.data["message"]["ts"]
        self.thread = SlackThreadDetails(thread_ts=self.thread_ts, channel_id=self.channel_id)
        self.organization_id = organization_id
        self.install = SlackIntegration(
            model=slack_request.integration, organization_id=organization_id
        )
        self.autofix_stopping_point = self.get_autofix_stopping_point_from_action(
            action=action, group_id=group.id
        )
        self.autofix_run_id = self.slack_request.callback_data.get("run_id")

    @staticmethod
    def has_access(organization: Organization) -> bool:
        return features.has("organizations:seer-slack-workflows", organization)

    @staticmethod
    def get_autofix_stopping_point_from_action(
        *, action: BlockKitMessageAction, group_id: int
    ) -> AutofixStoppingPoint:
        """
        Parses the autofix stopping point from a passed BlockKitMessageAction.
        XXX: We could attempt to interpret it from the slack_request value, but this will make
        it explicit which we use in case there's multiple in the body.
        """
        stopping_point = AutofixStoppingPoint.ROOT_CAUSE
        try:
            stopping_point = (
                AutofixStoppingPoint(action.value)
                if action.value
                else AutofixStoppingPoint.ROOT_CAUSE
            )
        except ValueError:
            logger.warning(
                "entrypoint.invalid_autofix_stopping_point",
                extra={
                    "entrypoint_key": SeerEntrypointKey.SLACK,
                    "stopping_point": action.value,
                    "action_id": action.action_id,
                    "group_id": group_id,
                },
            )
        return stopping_point

    @staticmethod
    def get_autofix_lock_key(*, group_id: int, stopping_point: AutofixStoppingPoint) -> str:
        return (
            f"autofix:entrypoint:{SeerEntrypointKey.SLACK.value}:{group_id}:{stopping_point.value}"
        )

    def on_trigger_autofix_error(self, *, error: str) -> None:
        send_thread_update(
            install=self.install,
            thread=self.thread,
            data=SeerAutofixError(error_message=error),
            ephemeral_user_id=self.slack_request.user_id,
        )

    def on_trigger_autofix_success(self, *, run_id: int) -> None:
        send_thread_update(
            install=self.install,
            thread=self.thread,
            data=SeerAutofixSuccess(
                run_id=run_id,
                organization_id=self.organization_id,
                stopping_point=self.autofix_stopping_point or AutofixStoppingPoint.ROOT_CAUSE,
            ),
            ephemeral_user_id=self.slack_request.user_id,
        )
        try:
            remove_autofix_button(
                request=self.slack_request,
                install=self.install,
                channel_id=self.channel_id,
                message_ts=self.thread_ts,
            )
        except (IntegrationError, TypeError, KeyError):
            logger.warning(
                "entrypoint.update_message_failed",
                extra={
                    "entrypoint_key": SlackEntrypoint.key,
                    "channel_id": self.channel_id,
                    "message_ts": self.thread_ts,
                    "organization_id": self.organization_id,
                },
            )

    def create_autofix_cache_payload(self) -> SlackEntrypointCachePayload:
        return SlackEntrypointCachePayload(
            threads=[SlackThreadDetails(thread_ts=self.thread_ts, channel_id=self.channel_id)],
            organization_id=self.organization_id,
            integration_id=self.install.model.id,
            project_id=self.group.project_id,
            group_id=self.group.id,
            group_link=self.group.get_absolute_url(),
        )

    @staticmethod
    def on_autofix_update(
        event_type: SentryAppEventType,
        event_payload: dict[str, Any],
        cache_payload: SlackEntrypointCachePayload,
    ) -> None:
        logging_ctx = {
            "event_type": event_type,
            "cache_payload": cache_payload,
            "entrypoint_key": SlackEntrypoint.key,
        }
        group_link = f'{cache_payload["group_link"]}?seerDrawer=true'

        match event_type:
            case SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED:
                root_cause = event_payload.get("root_cause", {})
                data = SeerAutofixUpdate(
                    run_id=event_payload["run_id"],
                    organization_id=cache_payload["organization_id"],
                    project_id=cache_payload["project_id"],
                    group_id=cache_payload["group_id"],
                    current_point=AutofixStoppingPoint.ROOT_CAUSE,
                    summary=root_cause.get("description", ""),
                    steps=[step.get("title", "") for step in root_cause.get("steps", [])],
                    group_link=group_link,
                )
            case SentryAppEventType.SEER_SOLUTION_COMPLETED:
                solution = event_payload.get("solution", {})
                data = SeerAutofixUpdate(
                    run_id=event_payload["run_id"],
                    organization_id=cache_payload["organization_id"],
                    project_id=cache_payload["project_id"],
                    group_id=cache_payload["group_id"],
                    current_point=AutofixStoppingPoint.SOLUTION,
                    summary=solution.get("description", ""),
                    steps=[step.get("title", "") for step in solution.get("steps", [])],
                    group_link=group_link,
                )
            case SentryAppEventType.SEER_CODING_COMPLETED:
                changes = event_payload.get("changes", [])
                data = SeerAutofixUpdate(
                    run_id=event_payload["run_id"],
                    organization_id=cache_payload["organization_id"],
                    project_id=cache_payload["project_id"],
                    group_id=cache_payload["group_id"],
                    current_point=AutofixStoppingPoint.CODE_CHANGES,
                    changes=[
                        {
                            "repo_name": change.get("repo_name", ""),
                            "diff": change.get("diff", ""),
                            "title": change.get("title", ""),
                            "description": change.get("description", ""),
                        }
                        for change in changes
                    ],
                    group_link=group_link,
                )
            case SentryAppEventType.SEER_PR_CREATED:
                pull_requests = [
                    pr_payload.get("pull_request", {})
                    for pr_payload in event_payload.get("pull_requests", [])
                ]
                summary = pull_requests[0].get("pr_url", "") if pull_requests else None
                data = SeerAutofixUpdate(
                    run_id=event_payload["run_id"],
                    organization_id=cache_payload["organization_id"],
                    project_id=cache_payload["project_id"],
                    group_id=cache_payload["group_id"],
                    pull_requests=[
                        {
                            "pr_number": pr["pr_number"],
                            "pr_url": pr["pr_url"],
                        }
                        for pr in pull_requests
                    ],
                    summary=summary,
                    current_point=AutofixStoppingPoint.OPEN_PR,
                    group_link=group_link,
                )

            case _:
                logging_ctx["event_type"] = event_type
                logger.warning("entrypoint.unsupported_event_type", extra=logging_ctx)
                return

        schedule_all_thread_updates(
            threads=cache_payload["threads"],
            integration_id=cache_payload["integration_id"],
            organization_id=cache_payload["organization_id"],
            data=data,
        )
        logger.info("entrypoint.on_autofix_update_success", extra=logging_ctx)


def send_thread_update(
    *,
    install: SlackIntegration,
    thread: SlackThreadDetails,
    data: NotificationData,
    ephemeral_user_id: str | None = None,
) -> None:
    """Actually sends the update, but requires a SlackIntegration, so we can't schedule it as a task."""
    logging_ctx = {
        "entrypoint_key": SeerEntrypointKey.SLACK,
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
    except ValueError as e:
        logging_ctx["error"] = str(e)
        logger.warning("entrypoint.send_thread_update.invalid_integration", extra=logging_ctx)
        # No need to retry since these are configuration errors, and will just repeat
        return
    logger.info("entrypoint.send_thread_update.success", extra=logging_ctx)


@instrumented_task(
    name="sentry.seer.entrypoints.integrations.slack.process_thread_update",
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

    try:
        data_dto = NotificationDataDto.from_dict(serialized_data)
    except (NotificationServiceError, NoRegistrationExistsError) as e:
        logger.warning(
            "entrypoint.process_thread_update.deserialize_error",
            extra={"error": e, "data": serialized_data},
        )
        return

    integration = integration_service.get_integration(
        integration_id=integration_id,
        organization_id=organization_id,
        provider=IntegrationProviderSlug.SLACK.value,
        status=ObjectStatus.ACTIVE,
    )
    if not integration:
        logger.warning(
            "entrypoint.process_thread_update.integration_not_found",
            extra={
                "integration_id": integration_id,
                "organization_id": organization_id,
                "entrypoint_key": SeerEntrypointKey.SLACK.value,
            },
        )
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


def remove_autofix_button(
    *,
    request: SlackActionRequest,
    install: SlackIntegration,
    channel_id: str,
    message_ts: str,
) -> None:
    from sentry.integrations.slack.message_builder.types import SlackAction

    # XXX: Removes the autofix button to prevent repeated usage
    blocks = _transform_block_actions(
        request.data["message"]["blocks"],
        lambda elem: (
            None
            if elem.get("action_id", "").startswith(SlackAction.SEER_AUTOFIX_START.value)
            else elem
        ),
    )

    parsed_blocks = [Block.parse(block) for block in blocks]
    renderable = SlackRenderable(
        blocks=[block for block in parsed_blocks if block is not None],
        text=request.data["message"]["text"],
    )

    install.update_message(channel_id=channel_id, message_ts=message_ts, renderable=renderable)


def handle_prepare_autofix_update(
    *,
    thread_ts: str,
    channel_id: str,
    group: Group,
    organization_id: int,
    integration_id: int,
) -> None:
    """
    Use parameters to create a payload for the operator to populate the pre-autofix cache.
    This will allow for a future migration of the cache to post-autofix for subsequent updates.
    Merges threads if an existing cache entry exists for this group.
    """
    logging_ctx = {
        "entrypoint_key": SlackEntrypoint.key,
        "group_id": group.id,
        "organization_id": organization_id,
        "integration_id": integration_id,
        "thread_ts": thread_ts,
        "channel_id": channel_id,
    }
    threads: list[SlackThreadDetails] = []
    incoming_thread = SlackThreadDetails(thread_ts=thread_ts, channel_id=channel_id)
    lock_key = SlackEntrypoint.get_autofix_lock_key(
        group_id=group.id,
        stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
    )
    lock = locks.get(lock_key, duration=10, name="autofix_entrypoint_slack")
    try:
        with lock.blocking_acquire(initial_delay=0.1, timeout=3):
            existing_cache = SeerOperatorAutofixCache[SlackEntrypointCachePayload].get(
                entrypoint_key=str(SlackEntrypoint.key),
                group_id=group.id,
            )
            if existing_cache:
                threads = existing_cache["payload"].get("threads", [])
            if incoming_thread not in threads:
                threads.append(incoming_thread)

            cache_result = SeerOperatorAutofixCache[
                SlackEntrypointCachePayload
            ].populate_pre_autofix_cache(
                entrypoint_key=str(SlackEntrypoint.key),
                group_id=group.id,
                cache_payload=SlackEntrypointCachePayload(
                    threads=threads,
                    organization_id=organization_id,
                    integration_id=integration_id,
                    project_id=group.project_id,
                    group_id=group.id,
                    group_link=group.get_absolute_url(),
                ),
            )
    except UnableToAcquireLock:
        logger.warning("entrypoint.handle_prepare_autofix_update.lock_failed", extra=logging_ctx)
        return

    logger.info(
        "entrypoint.handle_prepare_autofix_update",
        extra={
            "cache_key": cache_result["key"],
            "cache_source": cache_result["source"],
            "thread_count": len(threads),
            **logging_ctx,
        },
    )
