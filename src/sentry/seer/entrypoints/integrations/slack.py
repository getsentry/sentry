from __future__ import annotations

import logging
from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING, Any, TypedDict

from slack_sdk.models.blocks.blocks import Block

from sentry import features
from sentry.constants import (
    ENABLE_SEER_CODING_DEFAULT,
    ENABLE_SEER_ENHANCED_ALERTS_DEFAULT,
    ObjectStatus,
)
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
from sentry.notifications.platform.slack.renderers.seer import SeerSlackRenderer
from sentry.notifications.platform.templates.seer import SeerAutofixError, SeerAutofixUpdate
from sentry.notifications.platform.types import NotificationData, NotificationProviderKey
from sentry.notifications.utils.actions import BlockKitMessageAction
from sentry.organizations.services.organization.service import organization_service
from sentry.seer.autofix.issue_summary import (
    STOPPING_POINT_HIERARCHY,
    get_automation_stopping_point,
    is_group_triggering_automation,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.entrypoints.cache import SeerOperatorAutofixCache
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.tasks.base import instrumented_task
from sentry.taskworker.namespaces import integrations_tasks
from sentry.taskworker.retry import Retry
from sentry.utils import metrics
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
    automation_stopping_point: AutofixStoppingPoint | None


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
        has_feature_flag = features.has("organizations:seer-slack-workflows", organization)
        has_enhanced_alerts = bool(
            organization.get_option(
                "sentry:enable_seer_enhanced_alerts",
                default=ENABLE_SEER_ENHANCED_ALERTS_DEFAULT,
            )
        )
        return has_feature_flag and has_enhanced_alerts

    @staticmethod
    def get_group_link(group: Group) -> str:
        return f"{group.get_absolute_url()}?seerDrawer=true"

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
        if not action.value:
            return stopping_point
        try:
            stopping_point = AutofixStoppingPoint(action.value)
        except ValueError:
            logger.exception(
                "seer.entrypoint.slack.invalid_stopping_point",
                extra={
                    "entrypoint_key": SeerEntrypointKey.SLACK.value,
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
        data = SeerAutofixUpdate(
            run_id=run_id,
            organization_id=self.organization_id,
            project_id=self.group.project_id,
            group_id=self.group.id,
            current_point=self.autofix_stopping_point,
            group_link=self.get_group_link(self.group),
            has_progressed=True,
        )
        update_existing_message(
            request=self.slack_request,
            install=self.install,
            channel_id=self.channel_id,
            message_ts=self.thread_ts,
            data=data,
            slack_user_id=self.slack_request.user_id,
        )

    def create_autofix_cache_payload(self) -> SlackEntrypointCachePayload:
        return SlackEntrypointCachePayload(
            threads=[SlackThreadDetails(thread_ts=self.thread_ts, channel_id=self.channel_id)],
            organization_id=self.organization_id,
            integration_id=self.install.model.id,
            project_id=self.group.project_id,
            group_id=self.group.id,
            group_link=self.get_group_link(self.group),
            automation_stopping_point=None,
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
            "entrypoint_key": SeerEntrypointKey.SLACK.value,
        }
        # Piecemeal assembly of frozen SeerAutofixUpdate dataclass
        data_kwargs = {
            "run_id": event_payload["run_id"],
            "organization_id": cache_payload["organization_id"],
            "project_id": cache_payload["project_id"],
            "group_id": cache_payload["group_id"],
            "group_link": cache_payload["group_link"],
            "has_progressed": False,
        }

        match event_type:
            case SentryAppEventType.SEER_ROOT_CAUSE_COMPLETED:
                root_cause = event_payload.get("root_cause", {})
                data_kwargs.update(
                    {
                        "current_point": AutofixStoppingPoint.ROOT_CAUSE,
                        "summary": root_cause.get("description", ""),
                        "steps": [step.get("title", "") for step in root_cause.get("steps", [])],
                    }
                )
            case SentryAppEventType.SEER_SOLUTION_COMPLETED:
                solution = event_payload.get("solution", {})
                data_kwargs.update(
                    {
                        "current_point": AutofixStoppingPoint.SOLUTION,
                        "summary": solution.get("description", ""),
                        "steps": [step.get("title", "") for step in solution.get("steps", [])],
                    }
                )
            case SentryAppEventType.SEER_CODING_COMPLETED:
                changes = event_payload.get("changes", [])
                changes_list = [
                    {
                        "repo_name": change.get("repo_name", ""),
                        "diff": change.get("diff", ""),
                        "title": change.get("title", ""),
                        "description": change.get("description", ""),
                    }
                    for change in changes
                ]
                data_kwargs.update(
                    {"current_point": AutofixStoppingPoint.CODE_CHANGES, "changes": changes_list}
                )
            case SentryAppEventType.SEER_PR_CREATED:
                pull_requests = [
                    pr_payload.get("pull_request", {})
                    for pr_payload in event_payload.get("pull_requests", [])
                ]
                summary = pull_requests[0].get("pr_url", "") if pull_requests else None
                pull_requests_list = [
                    {"pr_number": pr["pr_number"], "pr_url": pr["pr_url"]} for pr in pull_requests
                ]
                data_kwargs.update(
                    {
                        "current_point": AutofixStoppingPoint.OPEN_PR,
                        "pull_requests": pull_requests_list,
                        "summary": summary,
                    }
                )
            case _:
                logging_ctx["event_type"] = event_type
                logger.info("seer.entrypoint.slack.unsupported_event_type", extra=logging_ctx)
                return

        # Determine whether an automation has progressed beyond the current stopping point
        automation_stopping_point = cache_payload["automation_stopping_point"]
        if automation_stopping_point:
            data_kwargs["has_progressed"] = (
                STOPPING_POINT_HIERARCHY[automation_stopping_point]
                > STOPPING_POINT_HIERARCHY[data_kwargs["current_point"]]
            )
            logging_ctx["automation_stopping_point"] = str(automation_stopping_point)
        logging_ctx["has_progressed"] = data_kwargs.get("has_progressed", False)

        # Special case for solution stopping point, we progress beyond it if coding is enabled
        # (if triggered manually, we always respect automation stopping point)
        if (
            data_kwargs["current_point"] == AutofixStoppingPoint.SOLUTION
            and not automation_stopping_point
        ):
            has_coding_enabled = organization_service.get_option(
                organization_id=cache_payload["organization_id"],
                key="sentry:enable_seer_coding",
            )
            if has_coding_enabled is None:
                has_coding_enabled = ENABLE_SEER_CODING_DEFAULT
            data_kwargs["has_progressed"] = has_coding_enabled

        data = SeerAutofixUpdate(**data_kwargs)
        schedule_all_thread_updates(
            threads=cache_payload["threads"],
            integration_id=cache_payload["integration_id"],
            organization_id=cache_payload["organization_id"],
            data=data,
        )
        logger.info("seer.entrypoint.slack.autofix_update_scheduled", extra=logging_ctx)
        metrics.incr(
            "seer.entrypoint.slack.autofix_update_scheduled",
            tags={
                "event_type": str(event_type),
                "current_point": str(data.current_point),
                "has_progressed": str(data.has_progressed),
                "thread_count": len(cache_payload["threads"]),
            },
        )


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

    try:
        automation_stopping_point = (
            get_automation_stopping_point(group) if is_group_triggering_automation(group) else None
        )
    except Exception:
        logger.exception(
            "seer.entrypoint.slack.prepare_autofix.get_stopping_point_error", extra=logging_ctx
        )
        automation_stopping_point = None

    if automation_stopping_point:
        logging_ctx["automation_stopping_point"] = str(automation_stopping_point)

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
                    group_link=SlackEntrypoint.get_group_link(group),
                    automation_stopping_point=automation_stopping_point,
                ),
            )
    except UnableToAcquireLock:
        logger.exception("seer.entrypoint.slack.prepare_autofix.lock_failed", extra=logging_ctx)
        return
    logger.info(
        "seer.entrypoint.slack.prepare_autofix.cache_populated",
        extra={
            "cache_key": cache_result["key"],
            "cache_source": cache_result["source"],
            "thread_count": len(threads),
            "has_automation": bool(automation_stopping_point),
            **logging_ctx,
        },
    )
    metrics.incr(
        "seer.entrypoint.slack.prepare_autofix.cache_populated",
        tags={
            "cache_source": cache_result["source"],
            "has_automation": str(bool(automation_stopping_point)),
        },
    )
