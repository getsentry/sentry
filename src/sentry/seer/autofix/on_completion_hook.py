from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import sentry_sdk
from django.db import router, transaction
from django.utils import timezone
from pydantic import ValidationError

from sentry import analytics, features
from sentry.analytics.events.autofix_events import (
    AiAutofixIntrospectionEvent,
    AiAutofixPrCreatedCompletedEvent,
)
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.agent.client_models import Artifact
from sentry.seer.agent.client_utils import fetch_run_status
from sentry.seer.agent.on_completion_hook import AgentOnCompletionHook
from sentry.seer.autofix.analytics import record_autofix_event
from sentry.seer.autofix.artifact_schemas import FixabilityAssessment, RootCauseArtifact
from sentry.seer.autofix.autofix_agent import (
    STEP_CONFIGS,
    should_open_autofix_pr_as_draft,
    trigger_autofix_agent,
    trigger_coding_agent_handoff,
    trigger_push_changes,
)
from sentry.seer.autofix.coding_agent import IntegrationNotFound
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.feature.models import FEATURE_ID as AUTOFIX_FEATURE_ID
from sentry.seer.autofix.feature.models import LEGACY_FEATURE_ID as LEGACY_AUTOFIX_FEATURE_ID
from sentry.seer.autofix.pr_iteration.completion import (
    continue_pr_iteration,
    fail_pr_iteration,
    fail_pr_iteration_missing_group,
    iteration_completed_webhook_fields,
    iteration_terminal_errored_repos,
    log_completion_received,
    record_failed_tool_calls,
)
from sentry.seer.autofix.pr_iteration.completion_reactions import react_to_completed_iteration
from sentry.seer.autofix.pr_iteration.iterations import get_latest_iteration_index
from sentry.seer.autofix.pr_iteration.tracing import set_pr_iteration_attributes
from sentry.seer.autofix.pr_ready_for_review import (
    emit_pr_ready_for_review,
    format_pull_requests_payload,
)
from sentry.seer.autofix.steps import AutofixStep
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    clear_preference_automation_handoff,
    get_automation_handoff,
)
from sentry.seer.entrypoints.operator import (
    SeerActivityAttribution,
    SeerAutofixOperator,
    process_autofix_updates,
    record_seer_activity,
)
from sentry.seer.milestones import reconcile_milestones
from sentry.seer.models import (
    SeerAgentRun,
    SeerAutomationHandoffConfiguration,
    SeerRun,
)
from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.sentry_apps.utils.webhooks import SeerActionType
from sentry.utils import metrics
from sentry.utils.tracing import start_span
from sentry.viewer_context import get_viewer_context

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import SeerRunState

logger = logging.getLogger(__name__)

# Pipeline order: which step follows which
PIPELINE_ORDER: list[AutofixStep] = [
    AutofixStep.ROOT_CAUSE,
    AutofixStep.SOLUTION,
    AutofixStep.CODE_CHANGES,
]

# Map stopping points to the step they represent
STOPPING_POINT_TO_STEP: dict[AutofixStoppingPoint, AutofixStep] = {
    AutofixStoppingPoint.ROOT_CAUSE: AutofixStep.ROOT_CAUSE,
    AutofixStoppingPoint.SOLUTION: AutofixStep.SOLUTION,
    AutofixStoppingPoint.CODE_CHANGES: AutofixStep.CODE_CHANGES,
}


def _stopping_point_from_run(organization: Organization, run_id: int) -> str | None:
    return (
        SeerAgentRun.objects.filter(
            run__organization_id=organization.id,
            run__seer_run_state_id=run_id,
            source__in=(AUTOFIX_FEATURE_ID, LEGACY_AUTOFIX_FEATURE_ID),
        )
        .values_list("extras__stopping_point", flat=True)
        .first()
    )


def _group_and_referrer_from_run(
    organization: Organization, run_id: int
) -> tuple[int | None, AutofixReferrer | None]:
    run_context = (
        SeerAgentRun.objects.filter(
            run__organization_id=organization.id,
            run__seer_run_state_id=run_id,
            source__in=(AUTOFIX_FEATURE_ID, LEGACY_AUTOFIX_FEATURE_ID),
        )
        .values("group_id", "extras")
        .first()
    )
    if run_context is None:
        return None, None

    raw_referrer = (run_context["extras"] or {}).get("referrer")
    try:
        referrer = AutofixReferrer(raw_referrer) if isinstance(raw_referrer, str) else None
    except ValueError:
        referrer = None
    return run_context["group_id"], referrer


class AutofixOnCompletionHook(AgentOnCompletionHook):
    """
    Hook called when an agent-based autofix run completes.

    Handles:
    - Sending webhooks for completed steps (root_cause_completed, solution_completed, etc.)
    - Continuing the automated pipeline if stopping_point hasn't been reached
    - Not advancing the pipeline when the run did not complete (errors /
      timeouts), so Seer can invoke this hook with ``call_on_failure=True``.
      A failed run is not a full no-op: a PR iteration still gets paused and
      its outcome recorded, since nothing else will ever end that iteration.
    """

    @classmethod
    def execute(cls, organization: Organization, run_id: int) -> None:
        """
        Execute the hook when the agent completes a step.

        Args:
            organization: The organization context
            run_id: The ID of the completed run
        """
        with (
            sentry_sdk.isolation_scope(),
            start_span(
                name="autofix.on_completion_hook",
                op="function",
                transaction=True,
            ),
        ):
            cls._execute(organization, run_id)

    @classmethod
    def _execute(cls, organization: Organization, run_id: int) -> None:
        set_pr_iteration_attributes(run_id=run_id, organization_id=organization.id)
        try:
            state = fetch_run_status(run_id, organization)
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.fetch_state_failed",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

        group_id, run_referrer = cls._resolve_group_id(organization, run_id, state)
        current_step, _ = cls._get_current_step(state)

        if current_step == AutofixStep.PR_ITERATION:
            cls._complete_pr_iteration(organization, run_id, state, group_id, run_referrer)
        else:
            cls._complete_autofix_step(organization, run_id, state, group_id, run_referrer)

    @classmethod
    def _complete_autofix_step(
        cls,
        organization: Organization,
        run_id: int,
        state: SeerRunState,
        group_id: int | None,
        run_referrer: AutofixReferrer | None,
    ) -> None:
        group = cls._fetch_group(organization, run_id, group_id)
        if group is None:
            return

        if not cls._run_completed(organization, run_id, state):
            return

        cls._record_triggered(organization, run_id, group)
        viewer_context = get_viewer_context()
        cls._send_step_webhook(
            organization,
            run_id,
            state,
            group,
            fallback_referrer=run_referrer,
            actor_user_id=viewer_context.user_id if viewer_context is not None else None,
        )
        cls._maybe_continue_pipeline(
            organization, run_id, state, group, fallback_referrer=run_referrer
        )

    @classmethod
    def _complete_pr_iteration(
        cls,
        organization: Organization,
        run_id: int,
        state: SeerRunState,
        group_id: int | None,
        run_referrer: AutofixReferrer | None,
    ) -> None:
        if state.status == "error":
            fail_pr_iteration(organization, run_id, state, group_id)
            return

        group = cls._fetch_group(organization, run_id, group_id)
        if group is None:
            fail_pr_iteration_missing_group(organization, state, group_id)
            return

        if not cls._run_completed(organization, run_id, state):
            return

        cls._record_triggered(organization, run_id, group)
        log_completion_received(organization, group, state)

        iteration_fields = iteration_completed_webhook_fields(
            organization, group, state, cls._format_code_changes_payload
        )
        if iteration_fields is not None:
            viewer_context = get_viewer_context()
            cls._send_step_webhook(
                organization,
                run_id,
                state,
                group,
                fallback_referrer=run_referrer,
                actor_user_id=viewer_context.user_id if viewer_context is not None else None,
                iteration_fields=iteration_fields,
            )

        record_failed_tool_calls(organization, group, state)

        reaction_outcomes = react_to_completed_iteration(organization, run_id, state)
        if reaction_outcomes:
            logger.info(
                "autofix.on_completion_hook.completion_reaction.summary",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "outcomes": dict(reaction_outcomes),
                },
            )

        _, referrer = cls._get_current_step(state)
        continue_pr_iteration(
            organization,
            group,
            run_id,
            state,
            referrer or run_referrer or AutofixReferrer.ON_COMPLETION_HOOK,
        )

    @classmethod
    def _run_completed(cls, organization: Organization, run_id: int, state: SeerRunState) -> bool:
        if state.status == "completed":
            return True
        logger.info(
            "autofix.on_completion_hook.run_not_completed",
            extra={
                "run_id": run_id,
                "organization_id": organization.id,
                "status": state.status,
                "failure_reason": state.failure_reason,
            },
        )
        metrics.incr(
            "autofix.on_completion_hook.run_not_completed",
            tags={"status": state.status},
        )
        return False

    @classmethod
    def _record_triggered(cls, organization: Organization, run_id: int, group: Group) -> None:
        now = timezone.now()
        with transaction.atomic(using=router.db_for_write(Group)):
            group.update(seer_explorer_autofix_last_triggered=now)
            SeerRun.objects.filter(
                organization_id=organization.id,
                seer_run_state_id=run_id,
            ).update(last_triggered_at=now)

    @classmethod
    def _resolve_group_id(
        cls, organization: Organization, run_id: int, state: SeerRunState
    ) -> tuple[int | None, AutofixReferrer | None]:
        """The run's group id, from the run state or the Sentry-side run mirror."""
        metadata = state.metadata or {}
        group_id = metadata.get("group_id")
        mirror_group_id, run_referrer = _group_and_referrer_from_run(organization, run_id)
        if group_id is None:
            group_id = mirror_group_id
        return group_id, run_referrer

    @classmethod
    def _fetch_group(
        cls, organization: Organization, run_id: int, group_id: int | None
    ) -> Group | None:
        """The run's group, scoped to the organization."""
        if group_id is None:
            logger.warning(
                "autofix.on_completion_hook.missing_group_id",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return None
        group = Group.objects.filter(id=group_id, project__organization_id=organization.id).first()
        if group is None:
            logger.warning(
                "autofix.on_completion_hook.group_not_found",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "group_id": group_id,
                },
            )
        return group

    @classmethod
    def find_latest_artifact_for_step(cls, state: SeerRunState, key: str) -> Artifact | None:
        for block in reversed(state.blocks):
            if not block.artifacts:
                continue
            for artifact in reversed(block.artifacts):
                if key == artifact.key:
                    return artifact
        return None

    @classmethod
    def _send_step_webhook(
        cls,
        organization: Organization,
        run_id: int,
        state: SeerRunState,
        group: Group,
        fallback_referrer: AutofixReferrer | None = None,
        actor_user_id: int | None = None,
        iteration_fields: dict[str, Any] | None = None,
    ) -> None:
        """
        Send webhook for the completed step.

        Determines which step just completed and sends the appropriate webhook event.
        """
        current_step, current_referrer = cls._get_current_step(state)
        current_referrer = current_referrer or fallback_referrer

        seer_run = SeerRun.objects.filter(
            organization_id=organization.id,
            seer_run_state_id=run_id,
        ).first()

        webhook_payload = {
            "run_id": run_id,
            "sentry_run_id": str(seer_run.uuid) if seer_run is not None else None,
            "group_id": group.id,
        }

        # Iterate through blocks in reverse order (most recent first)
        # to find which step just completed
        webhook_action_type: SeerActionType | None = None

        is_pr_created = False

        if current_step is not None:
            artifact = cls.find_latest_artifact_for_step(state, current_step)
            if artifact is not None:
                webhook_payload[current_step.value] = artifact.data

        if current_step == AutofixStep.ROOT_CAUSE:
            webhook_action_type = SeerActionType.ROOT_CAUSE_COMPLETED
        elif current_step == AutofixStep.SOLUTION:
            webhook_action_type = SeerActionType.SOLUTION_COMPLETED
        elif current_step == AutofixStep.CODE_CHANGES:
            if state.repo_pr_states:
                # When the current step is code changes and there are pr states,
                # then we are actually in the PR created step.
                #
                # One caveat here is that re-running code changes step isn't
                # handled but the expectation is that we only create PRs once
                # per seer run.
                webhook_action_type = SeerActionType.PR_CREATED
                webhook_payload["pull_requests"] = format_pull_requests_payload(state)
                is_pr_created = True
                record_autofix_event(
                    AiAutofixPrCreatedCompletedEvent(
                        organization_id=organization.id,
                        project_id=group.project_id,
                        group_id=group.id,
                        referrer=None if current_referrer is None else current_referrer.value,
                        run_id=run_id,
                    )
                )
            else:
                webhook_action_type = SeerActionType.CODING_COMPLETED
                webhook_payload["code_changes"] = cls._format_code_changes_payload(state)
        elif iteration_fields is not None:
            webhook_action_type = SeerActionType.ITERATION_COMPLETED
            webhook_payload.update(iteration_fields)

        if not webhook_action_type:
            return

        if seer_run is not None:
            reconcile_milestones(seer_run, state)

        event_name = webhook_action_type.value

        event_type = f"seer.{event_name}"
        try:
            sentry_app_event_type = SentryAppEventType(event_type)
            if SeerAutofixOperator.has_access(organization=organization):
                metrics.incr(
                    "autofix.on_completion_hook.process_autofix_updates",
                    tags={"event_type": str(event_type)},
                )
                activity_attribution: SeerActivityAttribution | None = None
                if webhook_action_type == SeerActionType.PR_CREATED and actor_user_id is not None:
                    activity_attribution = {
                        "referrer": current_referrer or AutofixReferrer.UNKNOWN,
                        "actor_user_id": actor_user_id,
                    }
                record_seer_activity(
                    group=group,
                    event_type=sentry_app_event_type,
                    event_payload=webhook_payload,
                    activity_attribution=activity_attribution,
                )
                process_autofix_updates.apply_async(
                    kwargs={
                        "event_type": sentry_app_event_type,
                        "event_payload": webhook_payload,
                        "organization_id": organization.id,
                        "activity_already_recorded": True,
                    }
                )
        except ValueError:
            logger.exception(
                "autofix.on_completion_hook.webhook_invalid_event_type",
                extra={"event_type": event_type},
            )

        try:
            broadcast_webhooks_for_organization.delay(
                resource_name="seer",
                event_name=event_name,
                organization_id=organization.id,
                payload=webhook_payload,
            )
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.webhook_failed",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "webhook_event": event_name,
                },
            )

        # If this PR is not opened in draft mode, we should immediately emit the ready signal
        if is_pr_created and not should_open_autofix_pr_as_draft(organization):
            # Not a cls method since draft -> ready signal also emits this same signal elsewhere
            emit_pr_ready_for_review(
                organization=organization,
                group=group,
                sentry_run_id=webhook_payload["sentry_run_id"],
                state=state,
            )

        if current_step is not None and not is_pr_created:
            referrer = current_referrer.value if current_referrer is not None else None
            iteration_index = get_latest_iteration_index(state)
            metrics.incr(
                "autofix.explorer.complete",
                tags={
                    "step": current_step.value,
                    "referrer": referrer,
                    "iteration_index": iteration_index,
                },
            )
            completed_event_cls = STEP_CONFIGS[current_step].completed_event
            if completed_event_cls is not None:
                record_autofix_event(
                    completed_event_cls(
                        organization_id=organization.id,
                        project_id=group.project_id,
                        group_id=group.id,
                        referrer=referrer,
                        run_id=run_id,
                        iteration_index=iteration_index,
                    )
                )

    @classmethod
    def _format_code_changes_payload(cls, state: SeerRunState) -> dict:
        diffs_by_repo = state.get_diffs_by_repo()
        return {
            repo: [
                {
                    "diff": p.diff,
                    "path": p.patch.path,
                    "type": p.patch.type,
                    "added": p.patch.added,
                    "removed": p.patch.removed,
                }
                for p in patches
            ]
            for repo, patches in diffs_by_repo.items()
        }

    @classmethod
    def _get_current_step(
        cls, state: SeerRunState
    ) -> tuple[AutofixStep, AutofixReferrer | None] | tuple[None, None]:
        """Determine which step just completed."""
        for block in reversed(state.blocks):
            message = block.message
            if message.metadata is not None:
                referrer = message.metadata.get("referrer")
                if referrer is not None:
                    try:
                        autofix_referrer = AutofixReferrer(referrer)
                    except ValueError:
                        autofix_referrer = None
                else:
                    autofix_referrer = None

                # find the first message with a valid step metadata
                step = message.metadata.get("step")
                if step is not None:
                    try:
                        autofix_step = AutofixStep(step)
                    except ValueError:
                        continue

                    return autofix_step, autofix_referrer

        return None, None

    @classmethod
    def _get_next_step(cls, current_step: AutofixStep) -> AutofixStep | None:
        """Get the next step in the pipeline after the current step."""
        try:
            current_index = PIPELINE_ORDER.index(current_step)
            if current_index < len(PIPELINE_ORDER) - 1:
                return PIPELINE_ORDER[current_index + 1]
        except ValueError:
            pass
        return None

    @classmethod
    def _maybe_continue_pipeline(
        cls,
        organization: Organization,
        run_id: int,
        state: SeerRunState,
        group: Group,
        fallback_referrer: AutofixReferrer | None = None,
    ) -> None:
        """
        Continue to the next step if stopping_point hasn't been reached.

        Args:
            organization: The organization context
            run_id: The run ID
            state: The current run state
        """
        current_step, referrer = cls._get_current_step(state)
        referrer = referrer or fallback_referrer or AutofixReferrer.ON_COMPLETION_HOOK

        if current_step is None:
            logger.warning(
                "autofix.on_completion_hook.no_current_step",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

        # Get pipeline metadata from state, falling back to the Sentry-side run
        # mirror for runs Seer started without it (the autofix feature).
        raw_stopping_point = (state.metadata or {}).get(
            "stopping_point"
        ) or _stopping_point_from_run(organization, run_id)
        if raw_stopping_point is None:
            stopping_point = None
            reached_stopping_point = True
        else:
            # Check if we've reached the stopping point
            stopping_point = AutofixStoppingPoint(raw_stopping_point)
            stopping_step = STOPPING_POINT_TO_STEP.get(stopping_point)
            reached_stopping_point = current_step == stopping_step

        cls.determine_fixability(
            organization=organization,
            group=group,
            run_id=run_id,
            state=state,
            step=current_step,
            referrer=referrer,
            reached_stopping_point=reached_stopping_point,
        )

        if stopping_point is None or reached_stopping_point:
            # We've reached the stopping point
            return

        # Check if we should trigger coding agent handoff instead of continuing
        handoff_config = cls._get_handoff_config_if_applicable(stopping_point, current_step, group)
        if handoff_config:
            cls._trigger_coding_agent_handoff(
                organization,
                run_id,
                group,
                handoff_config,
                referrer,
            )
            return

        # Special case: if stopping_point is open_pr and we just finished code_changes, push changes
        if (
            stopping_point == AutofixStoppingPoint.OPEN_PR
            and current_step == AutofixStep.CODE_CHANGES
        ):
            # Pipeline push: no author, the commit is Seer's.
            cls._push_changes(group, run_id, state)
            return

        # Get the next step
        next_step = cls._get_next_step(current_step)
        if next_step is None:
            return

        # Stop if next step is code_changes and enable_seer_coding is False
        if next_step == AutofixStep.CODE_CHANGES and not organization.get_option(
            "sentry:enable_seer_coding", True
        ):
            logger.warning(
                "autofix.on_completion_hook.code_changes_step_disabled",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                },
            )
            return

        # Trigger the next step
        logger.info(
            "autofix.on_completion_hook.continuing_pipeline",
            extra={
                "run_id": run_id,
                "organization_id": organization.id,
                "current_step": current_step,
                "next_step": next_step,
                "stopping_point": stopping_point,
                "iteration_index": get_latest_iteration_index(state),
            },
        )
        trigger_autofix_agent(
            group=group,
            step=next_step,
            referrer=referrer,
            run_id=run_id,
        )

    @classmethod
    def determine_fixability(
        cls,
        *,
        organization: Organization,
        group: Group,
        run_id: int,
        state: SeerRunState,
        step: AutofixStep,
        referrer: AutofixReferrer,
        reached_stopping_point: bool,
    ) -> FixabilityAssessment | None:
        if step != AutofixStep.ROOT_CAUSE:
            return None

        try:
            artifact = state.get_artifact("root_cause", RootCauseArtifact)
        except ValidationError:
            # The agent may produce artifacts that dont follow the schema
            return None

        if artifact is None:
            return None

        fixability = artifact.fixability

        analytics.record(
            AiAutofixIntrospectionEvent(
                organization_id=organization.id,
                project_id=group.project_id,
                group_id=group.id,
                run_id=run_id,
                referrer=referrer.value,
                step=step.value,
                action=fixability.assessment,
                reached_stopping_point=reached_stopping_point,
            )
        )
        logger.info(
            "autofix.on_completion_hook.introspection",
            extra={
                "organization_id": organization.id,
                "project_id": group.project_id,
                "group_id": group.id,
                "referrer": referrer.value,
                "step": step.value,
                "action": fixability.assessment,
                "reason": fixability.reason,
                "reached_stopping_point": reached_stopping_point,
            },
        )

        return fixability

    @classmethod
    def _push_changes(
        cls,
        group: Group,
        run_id: int,
        state: SeerRunState,
    ) -> bool:
        """Push code changes to create PRs. Returns True if changes were pushed."""
        # Check if there are code changes to push
        has_changes, is_synced = state.has_code_changes()
        if not has_changes or is_synced:
            logger.info(
                "autofix.on_completion_hook.no_changes_to_push",
                extra={
                    "run_id": run_id,
                    "organization_id": group.organization.id,
                    "has_changes": has_changes,
                    "is_synced": is_synced,
                },
            )
            return False

        # Errored repos are terminal — re-pushing would re-fire this hook in a loop.
        errored_repos = iteration_terminal_errored_repos(state)
        if errored_repos:
            logger.info(
                "autofix.on_completion_hook.skip_no_pushable_repos",
                extra={
                    "run_id": run_id,
                    "organization_id": group.organization.id,
                    "errored_repos": errored_repos,
                },
            )
            return False

        logger.info(
            "autofix.on_completion_hook.pushing_changes",
            extra={"run_id": run_id, "organization_id": group.organization.id},
        )

        should_verify_pr_content = features.has(
            "organizations:autofix-verify-pr-content", organization=group.organization
        )

        try:
            trigger_push_changes(
                group,
                run_id,
                referrer=AutofixReferrer.ON_COMPLETION_HOOK,
                state=state,
                verify_content=should_verify_pr_content,
            )
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.push_changes_failed",
                extra={"run_id": run_id, "organization_id": group.organization.id},
            )
            return False

        return True

    @classmethod
    def _get_handoff_config_if_applicable(
        cls,
        stopping_point: AutofixStoppingPoint,
        current_step: AutofixStep | None,
        group: Group,
    ) -> SeerAutomationHandoffConfiguration | None:
        """
        Read project preferences and return handoff config if applicable.

        Handoff is triggered when:
        - current_step is ROOT_CAUSE
        - stopping_point is SOLUTION, CODE_CHANGES, or OPEN_PR
        - automation_handoff is configured with handoff_point = ROOT_CAUSE
        """
        # Only trigger handoff after root cause is completed
        if current_step != AutofixStep.ROOT_CAUSE:
            return None

        # Only trigger handoff when continuing beyond root cause
        if stopping_point not in [
            AutofixStoppingPoint.SOLUTION,
            AutofixStoppingPoint.CODE_CHANGES,
            AutofixStoppingPoint.OPEN_PR,
        ]:
            return None

        return get_automation_handoff(group.project.get_option)

    @classmethod
    def _clear_handoff_preference(
        cls, project: Project, run_id: int, organization: Organization
    ) -> None:
        """Clear automation_handoff from project preferences after integration is not found."""
        try:
            clear_preference_automation_handoff(project)
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.clear_handoff_preference_failed",
                extra={"run_id": run_id, "organization_id": organization.id},
            )

    @classmethod
    def _trigger_coding_agent_handoff(
        cls,
        organization: Organization,
        run_id: int,
        group: Group,
        handoff_config: SeerAutomationHandoffConfiguration,
        referrer: AutofixReferrer = AutofixReferrer.ON_COMPLETION_HOOK,
    ) -> None:
        """Trigger coding agent handoff using the configured integration."""
        logger.info(
            "autofix.on_completion_hook.triggering_coding_agent_handoff",
            extra={
                "run_id": run_id,
                "organization_id": organization.id,
                "group_id": group.id,
                "integration_id": handoff_config.integration_id,
                "target": handoff_config.target,
            },
        )

        try:
            result = trigger_coding_agent_handoff(
                group=group,
                run_id=run_id,
                referrer=referrer,
                integration_id=handoff_config.integration_id,
            )
            logger.info(
                "autofix.on_completion_hook.coding_agent_handoff_completed",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "successes": len(result.get("successes", [])),
                    "failures": len(result.get("failures", [])),
                },
            )
        except IntegrationNotFound:
            logger.exception(
                "autofix.on_completion_hook.coding_agent_handoff_integration_not_found",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "integration_id": handoff_config.integration_id,
                },
            )
            cls._clear_handoff_preference(group.project, run_id, organization)
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.coding_agent_handoff_failed",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "integration_id": handoff_config.integration_id,
                },
            )
