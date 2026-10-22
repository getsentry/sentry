from __future__ import annotations

import logging
from collections.abc import Sequence
from typing import TYPE_CHECKING, Any, NotRequired, TypedDict, cast

from sentry import features
from sentry.constants import ObjectStatus
from sentry.integrations.services.integration.service import integration_service
from sentry.integrations.utils.metrics import EventLifecycle
from sentry.investigations.models import Investigation, InvestigationOrchestrationRun
from sentry.investigations.models.investigation import InvestigationSourceType
from sentry.investigations.models.orchestration import InvestigationOrchestrationStatus
from sentry.locks import locks
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.platform.registry import provider_registry
from sentry.notifications.platform.service import NotificationService
from sentry.notifications.platform.templates.seer import (
    SeerAgentError,
    SeerAgentResponse,
    SeerAgentWriteApproval,
    SeerAutofixError,
    SeerAutofixUpdate,
    SeerInvestigationError,
    SeerInvestigationStarted,
    SeerInvestigationStatus,
    SeerInvestigationStatusTemplate,
)
from sentry.notifications.platform.tracking import (
    NotificationLink,
    NotificationTrackingContext,
    record_sent,
)
from sentry.notifications.platform.types import NotificationData, NotificationProviderKey
from sentry.notifications.utils.actions import BlockKitMessageAction
from sentry.organizations.services.organization.model import RpcOrganization
from sentry.seer.agent.client_models import PendingUserInput, SeerRunState
from sentry.seer.autofix.utils import AutofixStoppingPoint, CodingAgentProviderType
from sentry.seer.endpoints.agent_request import (
    AgentApprovalRequestData,
    AgentApprovalRequestSerializer,
)
from sentry.seer.entrypoints.cache import (
    SeerOperatorAutofixCache,
    SeerOperatorInvestigationCache,
    get_metric_open_period_ids,
)
from sentry.seer.entrypoints.metrics import (
    SlackEntrypointEventLifecycleMetric,
    SlackEntrypointInteractionType,
)
from sentry.seer.entrypoints.registry import (
    agent_entrypoint_registry,
    autofix_entrypoint_registry,
    investigation_entrypoint_registry,
)
from sentry.seer.entrypoints.slack.investigation_status import (
    build_investigation_conclusion,
    build_investigation_status,
)
from sentry.seer.entrypoints.slack.messaging import (
    schedule_all_thread_updates,
    send_thread_update,
    update_existing_message,
    update_investigation_alert_message,
)
from sentry.seer.entrypoints.types import (
    SeerAgentEntrypoint,
    SeerAutofixEntrypoint,
    SeerEntrypointKey,
    SeerInvestigationEntrypoint,
)
from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.shared_integrations.exceptions import IntegrationConfigurationError, IntegrationError
from sentry.utils import metrics
from sentry.utils.cache import cache
from sentry.utils.locking import UnableToAcquireLock

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from sentry.integrations.slack.integration import SlackIntegration
    from sentry.integrations.slack.requests.action import SlackActionRequest
    from sentry.models.group import Group
    from sentry.notifications.platform.slack.provider import SlackRenderable


class EntrypointSetupError(Exception):
    """Raised when entrypoint construction fails during mention processing."""

    pass


class SlackThreadDetails(TypedDict):
    thread_ts: str
    channel_id: str


class SlackAutofixCachePayload(TypedDict):
    organization_id: int
    project_id: int
    group_id: int
    integration_id: int
    group_link: str
    threads: list[SlackThreadDetails]
    # Captured at cache creation. When set, the Slack ROOT_CAUSE update swaps the
    # next-stage trigger button for a "Hand off to ..." button.
    handoff_target: CodingAgentProviderType | None


class SlackAgentCachePayload(TypedDict):
    organization_id: int
    integration_id: int
    thread: SlackThreadDetails
    slack_user_id: NotRequired[str]


class SlackInvestigationCachePayload(TypedDict):
    organization_id: int
    integration_id: int
    channel_id: str
    thread_ts: str
    alert_message_ts: str
    status_message_ts: str | None
    slack_user_id: str
    last_sent_state: str | None
    final_sent: bool


class SlackInvestigationThread(TypedDict):
    integration_id: int
    channel_id: str
    thread_ts: str
    show_status: bool
    status_message_ts: str | None
    last_sent_state: str | None
    final_sent: bool


class SlackInvestigationThreadsCachePayload(TypedDict):
    organization_id: int
    investigation_id: int | None
    threads: list[SlackInvestigationThread]


class SlackPendingMentionPayload(TypedDict):
    """
    Kwargs for `route_slack_seer_event` stashed on control silo when a Slack
    @-mention cannot proceed (identity not linked). Popped after identity
    link so the task can be re-dispatched as if the webhook just arrived.
    """

    payload: dict[str, Any]
    integration_id: int
    slack_user_id: str
    channel_id: str
    thread_ts: str
    message_ts: str
    event_type: str
    message_text: str


def _agent_write_approval(
    pending_user_input: PendingUserInput | None,
) -> tuple[str, list[str]] | None:
    if not pending_user_input or pending_user_input.input_type != "agent_write_approval":
        return None
    approval = AgentApprovalRequestSerializer(
        data={
            "sessionId": pending_user_input.data.get("session_id"),
            "scopes": pending_user_input.data.get("required_scopes"),
        }
    )
    if not pending_user_input.id or not approval.is_valid():
        return None
    validated_data = cast(AgentApprovalRequestData, approval.validated_data)
    scopes = validated_data["scopes"]
    if not scopes:
        return None
    return pending_user_input.id, scopes


def _send_agent_write_approval(
    *,
    integration_id: int,
    organization_id: int,
    thread: SlackThreadDetails,
    data: SeerAgentWriteApproval,
    slack_user_id: str,
) -> None:
    from sentry.integrations.slack.integration import SlackIntegration

    integration = integration_service.get_integration(
        integration_id=integration_id,
        organization_id=organization_id,
        status=ObjectStatus.ACTIVE,
    )
    if not integration:
        logger.error(
            "seer.entrypoint.slack.agent_write_approval.integration_not_found",
            extra={"integration_id": integration_id, "organization_id": organization_id},
        )
        return
    send_thread_update(
        install=SlackIntegration(model=integration, organization_id=organization_id),
        thread=thread,
        data=data,
        ephemeral_user_id=slack_user_id,
    )


MISSING_SCOPE_FOOTER_CACHE_TIMEOUT = 60 * 60


def _get_handoff_target(project: Project) -> CodingAgentProviderType | None:
    """Read the project's coding-agent handoff target from preferences, or None."""
    from sentry.seer.autofix.utils import read_preference_from_sentry_db

    try:
        handoff = read_preference_from_sentry_db(project).automation_handoff
    except Exception:
        logger.exception(
            "seer.entrypoint.slack.read_handoff_target_failed",
            extra={"project_id": project.id},
        )
        return None
    if handoff is None:
        return None

    try:
        target = CodingAgentProviderType(handoff.target)
    except ValueError:
        logger.exception(
            "seer.entrypoint.slack.invalid_handoff_target",
            extra={"handoff_target": handoff.target},
        )
        return None
    return target


def _get_missing_scope_settings_url(
    *,
    integration_id: int,
    organization_id: int,
    channel_id: str,
    thread_ts: str,
) -> str | None:
    """
    Returns a settings URL if the integration is missing history scopes for the channel,
    and we haven't already shown the footer for this thread. Returns None otherwise.
    """
    from sentry.integrations.slack.integration import SlackIntegration

    integration = integration_service.get_integration(
        integration_id=integration_id,
        organization_id=organization_id,
        status=ObjectStatus.ACTIVE,
    )
    if not integration:
        return None

    install = SlackIntegration(model=integration, organization_id=organization_id)
    if install.has_history_scope(channel_id):
        return None

    try:
        org = Organization.objects.get(id=organization_id)
    except Organization.DoesNotExist:
        return None

    # TODO: remove the legacy check once MISSING_SCOPE_FOOTER_CACHE_TIMEOUT has elapsed since deploy.
    legacy_cache_key = f"seer:explorer:scope_footer:{integration_id}:{channel_id}:{thread_ts}"
    if cache.get(legacy_cache_key):
        return None

    cache_key = f"seer:agent:scope_footer:{integration_id}:{channel_id}:{thread_ts}"
    if not cache.add(cache_key, True, timeout=MISSING_SCOPE_FOOTER_CACHE_TIMEOUT):
        return None

    return org.absolute_url(f"/settings/{org.slug}/integrations/slack/")


class SlackAutofixEntrypoint(
    SeerAutofixEntrypoint[SlackAutofixCachePayload],
):
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
        self.slack_user_id = slack_request.user_id
        self.autofix_run_id = self.slack_request.callback_data.get("run_id")

    @staticmethod
    def has_access(organization: Organization) -> bool:
        return True

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
        self,
        *,
        run_id: int,
        has_complete_stage: bool,
        include_user: bool,
        handoff_target: CodingAgentProviderType | None = None,
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
            handoff_target=handoff_target,
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
            data=SeerAutofixError(organization_id=self.organization_id, error_message=error),
            ephemeral_user_id=self.slack_request.user_id,
        )

    def on_trigger_autofix_success(self, *, run_id: int) -> None:
        self._update_existing_message(run_id=run_id, has_complete_stage=False, include_user=True)

    def on_trigger_autofix_already_exists(self, *, run_id: int, has_complete_stage: bool) -> None:
        # We don't include the user since we don't know that they started the original run.
        self._update_existing_message(
            run_id=run_id, has_complete_stage=has_complete_stage, include_user=False
        )

    def on_trigger_handoff_error(self, *, error: str) -> None:
        send_thread_update(
            install=self.install,
            thread=self.thread,
            data=SeerAutofixError(organization_id=self.organization_id, error_message=error),
            ephemeral_user_id=self.slack_request.user_id,
        )

    def on_trigger_handoff_success(self, *, run_id: int, target: CodingAgentProviderType) -> None:
        self._update_existing_message(
            run_id=run_id,
            has_complete_stage=False,
            include_user=True,
            handoff_target=target,
        )

    def on_trigger_handoff_already_exists(
        self,
        *,
        run_id: int,
        target: CodingAgentProviderType,
        has_complete_stage: bool,
    ) -> None:
        # We don't include the user since we don't know that they started the agent handoff.
        self._update_existing_message(
            run_id=run_id,
            has_complete_stage=has_complete_stage,
            include_user=False,
            handoff_target=target,
        )

    def create_autofix_cache_payload(self) -> SlackAutofixCachePayload:
        return SlackAutofixCachePayload(
            threads=[self.thread],
            organization_id=self.organization_id,
            integration_id=self.install.model.id,
            project_id=self.group.project_id,
            group_id=self.group.id,
            group_link=self.get_group_link(self.group),
            handoff_target=_get_handoff_target(self.group.project),
        )

    @staticmethod
    def on_autofix_update(
        event_type: SentryAppEventType,
        event_payload: dict[str, Any],
        cache_payload: SlackAutofixCachePayload,
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

                if legacy_description := root_cause.get("description"):
                    summary = legacy_description
                elif explorer_description := root_cause.get("one_line_description"):
                    summary = explorer_description
                else:
                    summary = ""

                if legacy_steps := root_cause.get("steps", []):
                    steps = [step.get("title", "") for step in legacy_steps]
                elif explorer_steps := root_cause.get("reproduction_steps", []):
                    steps = explorer_steps
                else:
                    steps = []

                data_kwargs.update(
                    {
                        "current_point": AutofixStoppingPoint.ROOT_CAUSE,
                        "summary": summary,
                        "steps": steps,
                        "reasoning": root_cause.get("five_whys", []),
                        "reasoning_header": "Why did this happen?",
                        "steps_header": "Reproduction Steps",
                        "handoff_target": cache_payload.get("handoff_target"),
                    }
                )
            case SentryAppEventType.SEER_SOLUTION_COMPLETED:
                solution = event_payload.get("solution", {})

                if legacy_description := solution.get("description"):
                    summary = legacy_description
                elif explorer_description := solution.get("one_line_description"):
                    summary = explorer_description
                else:
                    summary = ""

                steps = [step.get("title", "") for step in solution.get("steps", [])]

                data_kwargs.update(
                    {
                        "current_point": AutofixStoppingPoint.SOLUTION,
                        "summary": summary,
                        "steps": steps,
                        "steps_header": "Steps to Resolve",
                    }
                )
            case SentryAppEventType.SEER_CODING_COMPLETED:
                if legacy_changes := event_payload.get("changes", []):
                    changes_list = [
                        {
                            "repo_name": change.get("repo_name", ""),
                            "diff": change.get("diff", ""),
                            "title": change.get("title", ""),
                            "description": change.get("description", ""),
                        }
                        for change in legacy_changes
                    ]
                elif explorer_changes := event_payload.get("code_changes", {}):
                    changes_list = [
                        {
                            "repo_name": repo,
                            "title": change.get("path", ""),
                            "description": "",  # No description available in explorer autofix
                            "diff": change.get("diff", ""),
                        }
                        for repo, changes in explorer_changes.items()
                        for change in changes
                    ]
                else:
                    changes_list = []

                data_kwargs.update(
                    {
                        "current_point": AutofixStoppingPoint.CODE_CHANGES,
                        "changes": changes_list,
                    }
                )
            # Skipped for now, as it would repeat PR_CREATED's message. Seer will eventually always
            # mark PRs ready for review (after fixing CI in draft, or giving up on CI), and we plan
            # to post a separate "ready for a human to review" message in Slack at that point.
            case SentryAppEventType.SEER_PR_READY_FOR_REVIEW:
                return
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


class SlackAgentEntrypoint(
    SeerAgentEntrypoint[SlackAgentCachePayload],
):
    key = SeerEntrypointKey.SLACK

    def __init__(
        self,
        *,
        integration_id: int,
        organization_id: int,
        channel_id: str,
        thread_ts: str,
        slack_user_id: str,
    ):
        from sentry.integrations.services.integration import integration_service
        from sentry.integrations.slack.integration import SlackIntegration

        integration = integration_service.get_integration(
            integration_id=integration_id,
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
        )
        if not integration:
            raise EntrypointSetupError(f"Slack integration {integration_id} not found")

        ois = integration_service.get_organization_integrations(
            integration_id=integration_id,
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
            limit=1,
        )
        if not ois:
            raise EntrypointSetupError(
                f"Slack integration {integration_id} is not active for org {organization_id}"
            )

        self.channel_id = channel_id
        self.thread_ts = thread_ts
        self.thread = SlackThreadDetails(thread_ts=self.thread_ts, channel_id=channel_id)
        self.organization_id = organization_id
        self.integration = integration
        self.install = SlackIntegration(model=integration, organization_id=organization_id)
        self.slack_user_id = slack_user_id

    @staticmethod
    def has_access(organization: Organization | RpcOrganization) -> bool:
        return True

    def on_trigger_agent_error(self, *, error: str) -> None:
        send_thread_update(
            install=self.install,
            thread=self.thread,
            data=SeerAgentError(organization_id=self.organization_id, error_message=error),
            ephemeral_user_id=self.slack_user_id,
        )

    def on_trigger_agent_success(self, *, run_id: int) -> None:
        pass

    def create_agent_cache_payload(self) -> SlackAgentCachePayload:
        return SlackAgentCachePayload(
            thread=self.thread,
            organization_id=self.organization_id,
            integration_id=self.install.model.id,
            slack_user_id=self.slack_user_id,
        )

    @staticmethod
    def on_agent_update(
        cache_payload: SlackAgentCachePayload,
        run_id: int,
        state: SeerRunState,
    ) -> None:
        organization_id = cache_payload["organization_id"]
        integration_id = cache_payload["integration_id"]
        thread = cache_payload["thread"]
        pending_user_input = state.pending_user_input
        # Only the latest turn's answer; never fall back to an earlier turn's.
        turns = state.get_turns()
        answer = turns[-1].answer if turns else None
        summary = answer.message.content if answer else None
        approval = _agent_write_approval(pending_user_input)
        if approval:
            input_id, scopes = approval
            data = SeerAgentWriteApproval(
                run_id=run_id,
                organization_id=organization_id,
                input_id=input_id,
                scopes=scopes,
            )
            slack_user_id = cache_payload.get("slack_user_id")
            if slack_user_id:
                # Keep this synchronous so mixed-version workers never deserialize the new source.
                _send_agent_write_approval(
                    integration_id=integration_id,
                    organization_id=organization_id,
                    thread=thread,
                    data=data,
                    slack_user_id=slack_user_id,
                )
                summary = (
                    f"<@{slack_user_id}> I need your approval to make changes in Sentry. "
                    "I sent you a message."
                )
            else:
                # Pre-deploy cache entries lack the recipient; never expose approval publicly.
                logger.error(
                    "seer.entrypoint.slack.agent_write_approval.slack_user_missing",
                    extra={"organization_id": organization_id, "run_id": run_id},
                )
                return

        if (
            approval is None
            and pending_user_input is not None
            and pending_user_input.input_type == "agent_write_approval"
        ) or not summary:
            response_data: SeerAgentError | SeerAgentResponse = SeerAgentError(
                organization_id=organization_id,
                error_message="Seer was unable to generate a response.",
            )
        else:
            missing_scope_url = _get_missing_scope_settings_url(
                integration_id=integration_id,
                organization_id=organization_id,
                channel_id=thread["channel_id"],
                thread_ts=thread["thread_ts"],
            )
            response_data = SeerAgentResponse(
                run_id=run_id,
                organization_id=organization_id,
                summary=summary,
                missing_scope_settings_url=missing_scope_url,
            )
        schedule_all_thread_updates(
            threads=[thread],
            integration_id=integration_id,
            organization_id=organization_id,
            data=response_data,
        )


class SlackInvestigationEntrypoint(
    SeerInvestigationEntrypoint[SlackInvestigationCachePayload],
):
    key = SeerEntrypointKey.SLACK

    def __init__(
        self,
        *,
        slack_request: SlackActionRequest,
        organization: Organization,
        channel_id: str,
        message_ts: str,
        slack_user_id: str,
    ):
        from sentry.integrations.slack.integration import SlackIntegration

        self.slack_request = slack_request
        self.organization = organization
        self.channel_id = channel_id
        self.message_ts = message_ts
        self.thread_ts: str = slack_request.data.get("message", {}).get("thread_ts") or message_ts
        self.slack_user_id = slack_user_id
        self.install = SlackIntegration(
            model=slack_request.integration, organization_id=organization.id
        )

    @staticmethod
    def has_access(organization: Organization) -> bool:
        return features.has("organizations:investigations-slack", organization)

    def _send_thread_update(
        self, data: NotificationData, ephemeral_user_id: str | None = None
    ) -> None:
        try:
            send_thread_update(
                install=self.install,
                thread=SlackThreadDetails(thread_ts=self.thread_ts, channel_id=self.channel_id),
                data=data,
                ephemeral_user_id=ephemeral_user_id,
            )
        except IntegrationError:
            # Already recorded by send_thread_update; it re-raises for task retries, which don't apply here.
            pass

    def on_trigger_investigation_error(self, *, error: str) -> None:
        self._send_thread_update(
            SeerInvestigationError(organization_id=self.organization.id, error_message=error),
            ephemeral_user_id=self.slack_user_id,
        )

    def on_trigger_investigation_success(self, *, investigation: Investigation) -> None:
        data = SeerInvestigationStarted(
            organization_id=self.organization.id,
            slack_user_id=self.slack_user_id,
            investigation_url=investigation.get_absolute_url(),
        )
        update_investigation_alert_message(
            request=self.slack_request,
            install=self.install,
            channel_id=self.channel_id,
            message_ts=self.message_ts,
            data=data,
        )
        self._send_thread_update(data)

    def create_investigation_cache_payload(self) -> SlackInvestigationCachePayload:
        return SlackInvestigationCachePayload(
            organization_id=self.organization.id,
            integration_id=self.install.model.id,
            channel_id=self.channel_id,
            thread_ts=self.thread_ts,
            alert_message_ts=self.message_ts,
            status_message_ts=None,
            slack_user_id=self.slack_user_id,
            last_sent_state=None,
            final_sent=False,
        )

    @staticmethod
    def on_investigation_update(
        cache_payload: SlackInvestigationCachePayload | None, run: InvestigationOrchestrationRun
    ) -> None:
        investigation_id = run.investigation_id
        lock = locks.get(
            f"seer:investigation:slack:{investigation_id}",
            duration=10,
            name="investigation_entrypoint_slack",
        )
        if cache_payload is None:
            with lock.blocking_acquire(initial_delay=0.1, timeout=10):
                SlackInvestigationEntrypoint._update_investigation_threads(
                    run_id=run.id, clicked_payload=None
                )
            return

        with SlackEntrypointEventLifecycleMetric(
            interaction_type=SlackEntrypointInteractionType.UPDATE_INVESTIGATION_STATUS,
            integration_id=cache_payload["integration_id"],
            organization_id=cache_payload["organization_id"],
        ).capture() as lifecycle:
            lifecycle.add_extras({"investigation_id": investigation_id})
            try:
                with lock.blocking_acquire(initial_delay=0.1, timeout=10):
                    SlackInvestigationEntrypoint._update_investigation_status(
                        run_id=run.id, lifecycle=lifecycle
                    )
                    SlackInvestigationEntrypoint._update_investigation_threads(
                        run_id=run.id, clicked_payload=cache_payload
                    )
            except UnableToAcquireLock as e:
                lifecycle.record_halt(halt_reason=e)
                # The holder may have read an older run, so retry once it lets go.
                raise

    @staticmethod
    def _update_investigation_status(*, run_id: int, lifecycle: EventLifecycle) -> None:
        from sentry.integrations.slack.integration import SlackIntegration

        try:
            run = InvestigationOrchestrationRun.objects.select_related("investigation").get(
                id=run_id
            )
        except InvestigationOrchestrationRun.DoesNotExist:
            lifecycle.record_halt(halt_reason="run_not_found")
            return
        cache_payload = SeerOperatorInvestigationCache[SlackInvestigationCachePayload].get(
            entrypoint_key=str(SlackInvestigationEntrypoint.key),
            investigation_id=run.investigation_id,
        )
        if cache_payload is None:
            return

        data, fingerprint = build_investigation_status(
            investigation=run.investigation,
            projection=run.projection,
            phase=run.phase,
            status=run.status,
            updated_at=run.date_updated,
        )
        send_conclusion = (
            run.status == InvestigationOrchestrationStatus.COMPLETED
            and not cache_payload["final_sent"]
        )
        if fingerprint == cache_payload["last_sent_state"] and not send_conclusion:
            return

        organization_id = cache_payload["organization_id"]
        integration = integration_service.get_integration(
            integration_id=cache_payload["integration_id"],
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
        )
        if integration is None:
            lifecycle.record_halt(halt_reason="integration_not_found")
            return

        install = SlackIntegration(model=integration, organization_id=organization_id)
        new_payload = cache_payload
        if fingerprint != cache_payload["last_sent_state"]:
            renderable, links = NotificationService.render_template(
                data=data,
                template=SeerInvestigationStatusTemplate(),
                provider=provider_registry.get(NotificationProviderKey.SLACK),
            )
            try:
                status_message_ts = _post_status_card(
                    install=install,
                    channel_id=cache_payload["channel_id"],
                    thread_ts=cache_payload["thread_ts"],
                    status_message_ts=cache_payload["status_message_ts"],
                    renderable=renderable,
                )
            except (IntegrationError, IntegrationConfigurationError) as e:
                lifecycle.record_halt(halt_reason=e)
            else:
                _record_status_sent(data=data, links=links)
                new_payload = {
                    **new_payload,
                    "status_message_ts": status_message_ts,
                    "last_sent_state": fingerprint,
                }

        if send_conclusion and SlackInvestigationEntrypoint._send_investigation_conclusion(
            run=run, install=install, cache_payload=cache_payload
        ):
            new_payload = {**new_payload, "final_sent": True}

        if new_payload != cache_payload:
            SeerOperatorInvestigationCache[SlackInvestigationCachePayload].set(
                entrypoint_key=str(SlackInvestigationEntrypoint.key),
                investigation_id=run.investigation_id,
                cache_payload=new_payload,
            )

    @staticmethod
    def _send_investigation_conclusion(
        *,
        run: InvestigationOrchestrationRun,
        install: SlackIntegration,
        cache_payload: SlackInvestigationCachePayload,
    ) -> bool:
        """Posts the report text in the thread. Returns False if Slack did not accept the message."""
        with SlackEntrypointEventLifecycleMetric(
            interaction_type=SlackEntrypointInteractionType.SEND_INVESTIGATION_CONCLUSION,
            integration_id=cache_payload["integration_id"],
            organization_id=cache_payload["organization_id"],
        ).capture() as lifecycle:
            lifecycle.add_extras({"investigation_id": run.investigation_id})
            data = build_investigation_conclusion(run)
            if data is None:
                return True
            return _post_conclusion(
                install=install,
                thread=SlackThreadDetails(
                    thread_ts=cache_payload["thread_ts"], channel_id=cache_payload["channel_id"]
                ),
                data=data,
                lifecycle=lifecycle,
            )

    @staticmethod
    def _update_investigation_threads(
        *, run_id: int, clicked_payload: SlackInvestigationCachePayload | None
    ) -> None:
        """
        Sends the run to the Slack threads of its metric open period. It skips the clicked
        thread, because _update_investigation_status sends to that thread.
        """
        try:
            run = InvestigationOrchestrationRun.objects.select_related("investigation").get(
                id=run_id
            )
        except InvestigationOrchestrationRun.DoesNotExist:
            return
        source_ids = get_metric_open_period_ids(run.investigation)
        if source_ids is None:
            return
        entrypoint_key = str(SlackInvestigationEntrypoint.key)
        source_type = InvestigationSourceType.METRIC_OPEN_PERIOD.value
        cache_cls = SeerOperatorInvestigationCache[SlackInvestigationThreadsCachePayload]
        payload = cache_cls.get_for_source(
            entrypoint_key=entrypoint_key, source_type=source_type, source_ids=source_ids
        )
        if payload is None:
            return

        threads = payload["threads"]
        if payload["investigation_id"] not in (None, run.investigation_id):
            threads = [
                {**thread, "status_message_ts": None, "last_sent_state": None, "final_sent": False}
                for thread in threads
            ]
        clicked_key = _thread_key(clicked_payload) if clicked_payload else None
        installs: dict[int, SlackIntegration | None] = {}
        sent_threads = SlackInvestigationEntrypoint._send_investigation_statuses(
            run=run,
            organization_id=payload["organization_id"],
            threads=[thread for thread in threads if _thread_key(thread) != clicked_key],
            installs=installs,
        )
        sent_threads = SlackInvestigationEntrypoint._send_investigation_conclusions(
            run=run,
            organization_id=payload["organization_id"],
            threads=sent_threads,
            installs=installs,
        )
        updated = {_thread_key(thread): thread for thread in [*threads, *sent_threads]}
        if payload["investigation_id"] == run.investigation_id and (
            list(updated.values()) == payload["threads"]
        ):
            return

        lock = locks.get(
            cache_cls.get_source_cache_key(
                entrypoint_key=entrypoint_key, source_type=source_type, source_ids=source_ids
            ),
            duration=10,
            name="investigation_entrypoint_slack",
        )
        with lock.blocking_acquire(initial_delay=0.1, timeout=3):
            latest = (
                cache_cls.get_for_source(
                    entrypoint_key=entrypoint_key, source_type=source_type, source_ids=source_ids
                )
                or payload
            )
            latest["investigation_id"] = run.investigation_id
            latest["threads"] = [
                _with_sent_fields(thread, updated.get(_thread_key(thread)))
                for thread in latest["threads"]
            ]
            cache_cls.set_for_source(
                entrypoint_key=entrypoint_key,
                source_type=source_type,
                source_ids=source_ids,
                cache_payload=latest,
            )

    @staticmethod
    def _send_investigation_statuses(
        *,
        run: InvestigationOrchestrationRun,
        organization_id: int,
        threads: Sequence[SlackInvestigationThread],
        installs: dict[int, SlackIntegration | None],
    ) -> list[SlackInvestigationThread]:
        """Posts or edits the status card in the threads with show_status. Returns all threads."""
        data, fingerprint = build_investigation_status(
            investigation=run.investigation,
            projection=run.projection,
            phase=run.phase,
            status=run.status,
            updated_at=run.date_updated,
        )
        rendered: tuple[SlackRenderable, set[NotificationLink]] | None = None
        updated: list[SlackInvestigationThread] = []
        for thread in threads:
            if not thread["show_status"] or thread["last_sent_state"] == fingerprint:
                updated.append(thread)
                continue
            with SlackEntrypointEventLifecycleMetric(
                interaction_type=SlackEntrypointInteractionType.SEND_INVESTIGATION_STATUS,
                integration_id=thread["integration_id"],
                organization_id=organization_id,
            ).capture() as lifecycle:
                lifecycle.add_extras({"investigation_id": run.investigation_id})
                install = _get_install(
                    installs,
                    integration_id=thread["integration_id"],
                    organization_id=organization_id,
                )
                if install is None:
                    lifecycle.record_halt(halt_reason="integration_not_found")
                    updated.append(thread)
                    continue
                if rendered is None:
                    rendered = NotificationService.render_template(
                        data=data,
                        template=SeerInvestigationStatusTemplate(),
                        provider=provider_registry.get(NotificationProviderKey.SLACK),
                    )
                renderable, links = rendered
                try:
                    status_message_ts = _post_status_card(
                        install=install,
                        channel_id=thread["channel_id"],
                        thread_ts=thread["thread_ts"],
                        status_message_ts=thread["status_message_ts"],
                        renderable=renderable,
                    )
                except (IntegrationError, IntegrationConfigurationError) as e:
                    lifecycle.record_halt(halt_reason=e)
                    updated.append(thread)
                    continue
                _record_status_sent(data=data, links=links)
                updated.append(
                    {
                        **thread,
                        "status_message_ts": status_message_ts,
                        "last_sent_state": fingerprint,
                    }
                )
        return updated

    @staticmethod
    def _send_investigation_conclusions(
        *,
        run: InvestigationOrchestrationRun,
        organization_id: int,
        threads: Sequence[SlackInvestigationThread],
        installs: dict[int, SlackIntegration | None],
    ) -> list[SlackInvestigationThread]:
        """Posts the conclusion of a completed run in each thread. Returns all threads."""
        if run.status != InvestigationOrchestrationStatus.COMPLETED:
            return list(threads)
        data = build_investigation_conclusion(run)
        updated: list[SlackInvestigationThread] = []
        for thread in threads:
            if thread["final_sent"]:
                updated.append(thread)
                continue
            with SlackEntrypointEventLifecycleMetric(
                interaction_type=SlackEntrypointInteractionType.SEND_INVESTIGATION_CONCLUSION,
                integration_id=thread["integration_id"],
                organization_id=organization_id,
            ).capture() as lifecycle:
                lifecycle.add_extras({"investigation_id": run.investigation_id})
                sent = data is None
                if data is not None:
                    install = _get_install(
                        installs,
                        integration_id=thread["integration_id"],
                        organization_id=organization_id,
                    )
                    if install is None:
                        lifecycle.record_halt(halt_reason="integration_not_found")
                    else:
                        sent = _post_conclusion(
                            install=install,
                            thread=SlackThreadDetails(
                                thread_ts=thread["thread_ts"], channel_id=thread["channel_id"]
                            ),
                            data=data,
                            lifecycle=lifecycle,
                        )
            updated.append({**thread, "final_sent": True} if sent else thread)
        return updated


def _thread_key(
    thread: SlackInvestigationThread | SlackInvestigationCachePayload,
) -> tuple[int, str, str]:
    return thread["integration_id"], thread["channel_id"], thread["thread_ts"]


def _with_sent_fields(
    thread: SlackInvestigationThread, sent: SlackInvestigationThread | None
) -> SlackInvestigationThread:
    if sent is None:
        return thread
    return {
        **thread,
        "status_message_ts": sent["status_message_ts"],
        "last_sent_state": sent["last_sent_state"],
        "final_sent": sent["final_sent"],
    }


def _get_install(
    installs: dict[int, SlackIntegration | None], *, integration_id: int, organization_id: int
) -> SlackIntegration | None:
    from sentry.integrations.slack.integration import SlackIntegration

    if integration_id not in installs:
        integration = integration_service.get_integration(
            integration_id=integration_id,
            organization_id=organization_id,
            status=ObjectStatus.ACTIVE,
        )
        installs[integration_id] = (
            SlackIntegration(model=integration, organization_id=organization_id)
            if integration
            else None
        )
    return installs[integration_id]


def _post_status_card(
    *,
    install: SlackIntegration,
    channel_id: str,
    thread_ts: str,
    status_message_ts: str | None,
    renderable: SlackRenderable,
) -> str | None:
    """Edits the status card if it exists, or posts it in the thread. Returns the card's ts."""
    if status_message_ts:
        install.update_message(
            channel_id=channel_id, message_ts=status_message_ts, renderable=renderable
        )
        return status_message_ts
    response = install.send_threaded_message(
        channel_id=channel_id, renderable=renderable, thread_ts=thread_ts
    )
    return response.get("ts") if response is not None else None


def _post_conclusion(
    *,
    install: SlackIntegration,
    thread: SlackThreadDetails,
    data: NotificationData,
    lifecycle: EventLifecycle,
) -> bool:
    try:
        message_ts = send_thread_update(install=install, thread=thread, data=data)
    except IntegrationError as e:
        lifecycle.record_halt(halt_reason=e)
        return False
    if message_ts is None:
        lifecycle.record_halt(halt_reason="conclusion_not_sent")
        return False
    return True


def _record_status_sent(*, data: SeerInvestigationStatus, links: set[NotificationLink]) -> None:
    record_sent(
        NotificationTrackingContext(
            source=data.source,
            provider=NotificationProviderKey.SLACK,
            category=SeerInvestigationStatusTemplate.category,
            notification_uuid=data.notification_uuid,
            organization_id=data.organization_id,
        ),
        links=links,
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
        "entrypoint_key": SlackAutofixEntrypoint.key,
        "group_id": group.id,
        "organization_id": organization_id,
        "integration_id": integration_id,
        "thread_ts": thread_ts,
        "channel_id": channel_id,
    }
    threads: list[SlackThreadDetails] = []
    incoming_thread = SlackThreadDetails(thread_ts=thread_ts, channel_id=channel_id)
    lock_key = SlackAutofixEntrypoint.get_autofix_lock_key(
        group_id=group.id,
        stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
    )

    lock = locks.get(lock_key, duration=10, name="autofix_entrypoint_slack")
    try:
        with lock.blocking_acquire(initial_delay=0.1, timeout=3):
            existing_cache = SeerOperatorAutofixCache[SlackAutofixCachePayload].get(
                entrypoint_key=str(SlackAutofixEntrypoint.key),
                group_id=group.id,
            )
            if existing_cache:
                threads = existing_cache["payload"].get("threads", [])
            if incoming_thread not in threads:
                threads.append(incoming_thread)

            cache_result = SeerOperatorAutofixCache[
                SlackAutofixCachePayload
            ].populate_pre_autofix_cache(
                entrypoint_key=str(SlackAutofixEntrypoint.key),
                group_id=group.id,
                cache_payload=SlackAutofixCachePayload(
                    threads=threads,
                    organization_id=organization_id,
                    integration_id=integration_id,
                    project_id=group.project_id,
                    group_id=group.id,
                    group_link=SlackAutofixEntrypoint.get_group_link(group),
                    handoff_target=_get_handoff_target(group.project),
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


def record_slack_thread_for_metric_open_period(
    *,
    organization_id: int,
    integration_id: int,
    channel_id: str,
    thread_ts: str,
    group_id: int,
    open_period_id: int,
) -> None:
    """
    Add the Slack thread of a metric alert to the investigation cache for its open period.
    An investigation of the open period can then send its conclusion to all of these threads.
    """
    logging_ctx = {
        "group_id": group_id,
        "open_period_id": open_period_id,
        "organization_id": organization_id,
        "integration_id": integration_id,
        "channel_id": channel_id,
        "thread_ts": thread_ts,
    }
    entrypoint_key = str(SlackInvestigationEntrypoint.key)
    source_type = InvestigationSourceType.METRIC_OPEN_PERIOD.value
    source_ids = [group_id, open_period_id]
    cache_cls = SeerOperatorInvestigationCache[SlackInvestigationThreadsCachePayload]
    lock = locks.get(
        cache_cls.get_source_cache_key(
            entrypoint_key=entrypoint_key, source_type=source_type, source_ids=source_ids
        ),
        duration=10,
        name="investigation_entrypoint_slack",
    )
    try:
        with lock.blocking_acquire(initial_delay=0.1, timeout=3):
            payload = cache_cls.get_for_source(
                entrypoint_key=entrypoint_key, source_type=source_type, source_ids=source_ids
            ) or (
                SlackInvestigationThreadsCachePayload(
                    organization_id=organization_id, investigation_id=None, threads=[]
                )
            )
            if not any(
                thread["integration_id"] == integration_id
                and thread["channel_id"] == channel_id
                and thread["thread_ts"] == thread_ts
                for thread in payload["threads"]
            ):
                payload["threads"].append(
                    SlackInvestigationThread(
                        integration_id=integration_id,
                        channel_id=channel_id,
                        thread_ts=thread_ts,
                        show_status=False,
                        status_message_ts=None,
                        last_sent_state=None,
                        final_sent=False,
                    )
                )
            cache_cls.set_for_source(
                entrypoint_key=entrypoint_key,
                source_type=source_type,
                source_ids=source_ids,
                cache_payload=payload,
            )
    except UnableToAcquireLock:
        logger.exception(
            "seer.entrypoint.slack.record_open_period_thread.lock_failed", extra=logging_ctx
        )


# Register after class definition to avoid decorator type-narrowing when stacking two registries.
autofix_entrypoint_registry.register(key=SeerEntrypointKey.SLACK)(SlackAutofixEntrypoint)
agent_entrypoint_registry.register(key=SeerEntrypointKey.SLACK)(SlackAgentEntrypoint)
investigation_entrypoint_registry.register(key=SeerEntrypointKey.SLACK)(
    SlackInvestigationEntrypoint
)
