from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, TypedDict

from sentry import features
from sentry.constants import ENABLE_SEER_ENHANCED_ALERTS_DEFAULT
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.notifications.platform.templates.seer import SeerAutofixError, SeerAutofixUpdate
from sentry.notifications.utils.actions import BlockKitMessageAction
from sentry.seer.autofix.constants import AutofixStatus
from sentry.seer.autofix.utils import AutofixState, AutofixStoppingPoint
from sentry.seer.entrypoints.cache import SeerOperatorAutofixCache
from sentry.seer.entrypoints.registry import entrypoint_registry
from sentry.seer.entrypoints.slack.messaging import (
    schedule_all_thread_updates,
    send_thread_update,
    update_existing_message,
)
from sentry.seer.entrypoints.types import SeerEntrypoint, SeerEntrypointKey
from sentry.sentry_apps.metrics import SentryAppEventType
from sentry.utils import metrics
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
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
        self.message_ts = slack_request.data["message"]["ts"]
        # Use the thread_ts if available, otherwise this is a channel message, so it will
        # be the parent of a future thread.
        self.thread_ts = slack_request.data["message"].get("thread_ts", self.message_ts)
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

    def _update_existing_message(
        self, *, run_id: int, has_complete_stage: bool, include_user: bool
    ) -> None:
        """
        Updates the clicked message as 'in-progress' with a given run_id.
        """
        data = SeerAutofixUpdate(
            run_id=run_id,
            organization_id=self.organization_id,
            project_id=self.group.project_id,
            group_id=self.group.id,
            current_point=self.autofix_stopping_point,
            group_link=self.get_group_link(self.group),
        )
        update_existing_message(
            request=self.slack_request,
            install=self.install,
            channel_id=self.channel_id,
            message_ts=self.message_ts,
            data=data,
            has_complete_stage=has_complete_stage,
            slack_user_id=self.slack_request.user_id if include_user else None,
        )

    def on_trigger_autofix_error(self, *, error: str) -> None:
        send_thread_update(
            install=self.install,
            thread=self.thread,
            data=SeerAutofixError(error_message=error),
            ephemeral_user_id=self.slack_request.user_id,
        )

    def on_trigger_autofix_success(self, *, run_id: int) -> None:
        self._update_existing_message(run_id=run_id, has_complete_stage=False, include_user=True)

    def on_trigger_autofix_already_exists(self, *, state: AutofixState, step_state: dict) -> None:
        # We don't include the user since we don't know that they started the original run.
        has_complete_stage = (
            False
            if step_state.get("key") in {"root_cause_analysis_processing", "solution_processing"}
            else step_state.get("status") == AutofixStatus.COMPLETED
        )
        self._update_existing_message(
            run_id=state.run_id, has_complete_stage=has_complete_stage, include_user=False
        )

    def create_autofix_cache_payload(self) -> SlackEntrypointCachePayload:
        return SlackEntrypointCachePayload(
            threads=[self.thread],
            organization_id=self.organization_id,
            integration_id=self.install.model.id,
            project_id=self.group.project_id,
            group_id=self.group.id,
            group_link=self.get_group_link(self.group),
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
                "thread_count": len(cache_payload["threads"]),
            },
        )


def prepare_slack_thread_for_autofix_updates(
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
                    group_link=SlackEntrypoint.get_group_link(group),
                ),
            )
    except UnableToAcquireLock:
        logger.exception("seer.entrypoint.slack.prepare_thread.lock_failed", extra=logging_ctx)
        return
    logger.info(
        "seer.entrypoint.slack.prepare_thread.cache_populated",
        extra={
            "cache_key": cache_result["key"],
            "cache_source": cache_result["source"],
            "thread_count": len(threads),
            **logging_ctx,
        },
    )
    metrics.incr(
        "seer.entrypoint.slack.prepare_thread.cache_populated",
        tags={"cache_source": cache_result["source"]},
    )
