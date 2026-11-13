from __future__ import annotations

import logging
from collections import Counter
from typing import TYPE_CHECKING, Any, Literal

import sentry_sdk
from django.db import router, transaction
from django.utils import timezone
from sentry_sdk import traces

from sentry.analytics.events.autofix_events import AiAutofixPrCreatedCompletedEvent
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.seer.agent.client_models import Artifact
from sentry.seer.agent.client_utils import fetch_run_status
from sentry.seer.agent.on_completion_hook import AgentOnCompletionHook
from sentry.seer.autofix.analytics import record_autofix_event
from sentry.seer.autofix.autofix_agent import (
    STEP_CONFIGS,
    fetch_run_group,
    get_current_step,
    resolve_run_group_id,
    should_open_autofix_pr_as_draft,
    trigger_autofix_agent,
    trigger_coding_agent_handoff,
    trigger_push_changes,
)
from sentry.seer.autofix.coding_agent import IntegrationNotFound
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.exceptions import SeerOutOfCreditsException
from sentry.seer.autofix.feature.models import FEATURE_ID as AUTOFIX_FEATURE_ID
from sentry.seer.autofix.feature.models import LEGACY_FEATURE_ID as LEGACY_AUTOFIX_FEATURE_ID
from sentry.seer.autofix.pr_iteration.completion import (
    continue_pr_iteration,
    drain_single_run_feedback_queue,
    fail_pr_iteration,
    fail_pr_iteration_missing_group,
    is_pr_feedback_turn,
    iteration_completed_webhook_fields,
    iteration_terminal_errored_repos,
    log_completion_received,
    record_failed_tool_calls,
)
from sentry.seer.autofix.pr_iteration.completion_reactions import react_to_completed_iteration
from sentry.seer.autofix.pr_iteration.iterations import get_latest_iteration_index
from sentry.seer.autofix.pr_iteration.run_markers import record_run_extras
from sentry.seer.autofix.pr_iteration.tracing import set_pr_iteration_attributes
from sentry.seer.autofix.pr_ready_for_review import (
    emit_pr_ready_for_review,
    format_pull_requests_payload,
)
from sentry.seer.autofix.single_run import (
    SingleRunStop,
    is_single_run,
    single_run_root_cause_payload,
    single_run_stop_payload,
)
from sentry.seer.autofix.steps import AutofixStep
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    clear_preference_automation_handoff,
    get_automation_handoff,
)
from sentry.seer.credits import OUT_OF_CREDITS
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
from sentry.viewer_context import get_acting_user_id, get_viewer_context

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import SeerRunState

logger = logging.getLogger(__name__)

# Sent as seer.errored's failure_reason when Seer finished but couldn't open any PR.
PR_CREATION_FAILED_REASON = "pr_creation_failed"

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


def get_run_stopping_point(
    organization: Organization, run_id: int, state: SeerRunState
) -> str | None:
    """The stopping point the pipeline will continue toward: from the run's metadata,
    falling back to the Sentry-side run mirror for runs Seer started without it (the
    autofix feature)."""
    return (state.metadata or {}).get("stopping_point") or _stopping_point_from_run(
        organization, run_id
    )


SingleRunStage = Literal["root_cause", "coding", "pr_created", "stopped"]
SINGLE_RUN_ANNOUNCED_STAGES_KEY = "single_run_announced_stages"


def _single_run_referrer(state: SeerRunState) -> AutofixReferrer | None:
    raw = (state.metadata or {}).get("referrer")
    try:
        return AutofixReferrer(raw) if isinstance(raw, str) else None
    except ValueError:
        return None


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
        with sentry_sdk.isolation_scope():
            traces.new_trace()
            with traces.start_span(
                name="autofix.on_completion_hook",
                attributes={"sentry.op": "function"},
                parent_span=None,
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

        group_id, run_referrer = resolve_run_group_id(organization, run_id, state)
        if is_single_run(state):
            cls._complete_single_run(organization, run_id, state, group_id, run_referrer)
            return
        current_step, _ = get_current_step(state)

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
            if state.status == "error":
                cls._notify_entrypoints_of_failure(
                    organization, run_id, group, state.failure_reason
                )
            return

        cls._record_triggered(organization, run_id, group)
        cls._send_step_webhook(
            organization,
            run_id,
            state,
            group,
            fallback_referrer=run_referrer,
            actor_user_id=get_acting_user_id(get_viewer_context()),
        )
        cls._maybe_continue_pipeline(
            organization, run_id, state, group, fallback_referrer=run_referrer
        )

    @classmethod
    def _complete_single_run(
        cls,
        organization: Organization,
        run_id: int,
        state: SeerRunState,
        group_id: int | None,
        run_referrer: AutofixReferrer | None,
    ) -> None:
        feedback_turn = is_pr_feedback_turn(state)
        if feedback_turn and state.status == "error":
            fail_pr_iteration(organization, run_id, state, group_id)
            return
        group = cls._fetch_group(organization, run_id, group_id)
        if group is None:
            if feedback_turn and state.status == "completed":
                fail_pr_iteration_missing_group(organization, state, group_id)
            return
        if state.status == "completed":
            if feedback_turn:
                _, referrer = get_current_step(state)
                continue_pr_iteration(
                    organization,
                    group,
                    run_id,
                    state,
                    referrer or run_referrer or AutofixReferrer.ON_COMPLETION_HOOK,
                )
                cls._log_reaction_outcomes(
                    organization, run_id, react_to_completed_iteration(organization, run_id, state)
                )
            else:
                drain_single_run_feedback_queue(organization, group, run_id, state)
        paused = state.status == "awaiting_user_input"
        if not cls._run_completed(organization, run_id, state) and not paused:
            if state.status == "error":
                cls._notify_entrypoints_of_failure(
                    organization, run_id, group, state.failure_reason
                )
            return
        seer_run = SeerRun.objects.filter(
            organization_id=organization.id, seer_run_state_id=run_id
        ).first()
        if seer_run is None:
            logger.warning(
                "autofix.on_completion_hook.single_run_missing_seer_run",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

        root_cause = single_run_root_cause_payload(state)
        pull_requests = [
            pr
            for pr in format_pull_requests_payload(state)
            if pr["pull_request"]["pr_number"] is not None
        ]
        reached: list[SingleRunStage] = []
        if root_cause is not None:
            reached.append("root_cause")
        if state.get_diffs_by_repo():
            reached.append("coding")
        if pull_requests:
            reached.append("pr_created")
        stop = single_run_stop_payload(state)
        if stop is not None and not {"coding", "pr_created"} & set(reached):
            reached.append("stopped")

        reconcile_milestones(seer_run, state)

        with record_run_extras(seer_run) as extras:
            announced = extras.get(SINGLE_RUN_ANNOUNCED_STAGES_KEY) or []
            new_stages = [stage for stage in reached if stage not in announced]
            extras[SINGLE_RUN_ANNOUNCED_STAGES_KEY] = [*announced, *new_stages]

        cls._announce_single_run(
            organization=organization,
            run_id=run_id,
            state=state,
            group=group,
            seer_run=seer_run,
            stages=new_stages,
            root_cause=root_cause,
            pull_requests=pull_requests,
            stop=stop,
            referrer=_single_run_referrer(state) or run_referrer,
        )

    @classmethod
    def _announce_single_run(
        cls,
        *,
        organization: Organization,
        run_id: int,
        state: SeerRunState,
        group: Group,
        seer_run: SeerRun,
        stages: list[SingleRunStage],
        root_cause: dict[str, Any] | None,
        pull_requests: list[dict[str, Any]],
        stop: SingleRunStop | None,
        referrer: AutofixReferrer | None,
    ) -> None:
        cls._record_triggered(organization, run_id, group)
        base = {"run_id": run_id, "sentry_run_id": str(seer_run.uuid), "group_id": group.id}
        actor_user_id = get_acting_user_id(get_viewer_context())
        for stage in stages:
            if stage == "stopped":
                cls._notify_entrypoints(
                    organization,
                    SentryAppEventType.SEER_STOPPED,
                    {"run_id": run_id, "group_id": group.id, "stop": stop},
                )
                continue
            if stage == "root_cause":
                action_type = SeerActionType.ROOT_CAUSE_COMPLETED
                payload: dict[str, object] = {**base, "root_cause": root_cause}
                step = AutofixStep.ROOT_CAUSE
            elif stage == "coding":
                action_type = SeerActionType.CODING_COMPLETED
                payload = {**base, "code_changes": cls._format_code_changes_payload(state)}
                step = AutofixStep.CODE_CHANGES
            else:
                action_type = SeerActionType.PR_CREATED
                payload = {**base, "pull_requests": pull_requests}
                step = AutofixStep.CODE_CHANGES
            cls._announce(
                organization=organization,
                run_id=run_id,
                state=state,
                group=group,
                seer_run=seer_run,
                action_type=action_type,
                payload=payload,
                step=step,
                referrer=referrer,
                actor_user_id=actor_user_id,
                mode="single_run",
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

        # Push first: only the push knows whether another turn of the iteration runs, and that
        # turn's completion emits the webhook instead.
        _, referrer = get_current_step(state)
        retrying = continue_pr_iteration(
            organization,
            group,
            run_id,
            state,
            referrer or run_referrer or AutofixReferrer.ON_COMPLETION_HOOK,
        )

        iteration_fields = iteration_completed_webhook_fields(
            organization, group, state, cls._format_code_changes_payload, retrying=retrying
        )
        if iteration_fields is not None:
            cls._send_step_webhook(
                organization,
                run_id,
                state,
                group,
                fallback_referrer=run_referrer,
                actor_user_id=get_acting_user_id(get_viewer_context()),
                iteration_fields=iteration_fields,
            )

        record_failed_tool_calls(organization, group, state)

        cls._log_reaction_outcomes(
            organization, run_id, react_to_completed_iteration(organization, run_id, state)
        )

    @classmethod
    def _log_reaction_outcomes(
        cls, organization: Organization, run_id: int, reaction_outcomes: Counter[str]
    ) -> None:
        if reaction_outcomes:
            logger.info(
                "autofix.on_completion_hook.completion_reaction.summary",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "outcomes": dict(reaction_outcomes),
                },
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
    def _notify_entrypoints_of_failure(
        cls,
        organization: Organization,
        run_id: int,
        group: Group,
        failure_reason: str | None,
    ) -> None:
        cls._notify_entrypoints(
            organization,
            SentryAppEventType.SEER_ERRORED,
            {"run_id": run_id, "group_id": group.id, "failure_reason": failure_reason},
        )

    @classmethod
    def _notify_entrypoints(
        cls,
        organization: Organization,
        event_type: SentryAppEventType,
        event_payload: dict[str, Any],
    ) -> None:
        """
        Tells entrypoints (e.g. a Slack thread waiting on the run) about the run.
        No Sentry App webhook; mapped event types also get an issue activity.
        """
        if not SeerAutofixOperator.has_access(organization=organization):
            return
        metrics.incr(
            "autofix.on_completion_hook.process_autofix_updates",
            tags={"event_type": str(event_type)},
        )
        process_autofix_updates.apply_async(
            kwargs={
                "event_type": event_type,
                "event_payload": event_payload,
                "organization_id": organization.id,
            }
        )

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
        return fetch_run_group(organization, run_id, group_id)

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
        current_step, current_referrer = get_current_step(state)
        current_referrer = current_referrer or fallback_referrer

        seer_run = SeerRun.objects.filter(
            organization_id=organization.id,
            seer_run_state_id=run_id,
        ).first()

        sentry_run_id = str(seer_run.uuid) if seer_run is not None else None
        webhook_payload: dict[str, object] = {
            "run_id": run_id,
            "sentry_run_id": sentry_run_id,
            "group_id": group.id,
        }

        # Iterate through blocks in reverse order (most recent first)
        # to find which step just completed
        webhook_action_type: SeerActionType | None = None

        if current_step is not None:
            artifact = cls.find_latest_artifact_for_step(state, current_step)
            if artifact is not None:
                webhook_payload[current_step.value] = artifact.data

        if current_step == AutofixStep.ROOT_CAUSE:
            webhook_action_type = SeerActionType.ROOT_CAUSE_COMPLETED
        elif current_step == AutofixStep.SOLUTION:
            webhook_action_type = SeerActionType.SOLUTION_COMPLETED
        elif current_step == AutofixStep.CODE_CHANGES:
            pull_requests = format_pull_requests_payload(state)
            if state.repo_pr_states and not pull_requests:
                # Seer adds one entry per repository before asking the provider to open
                # a PR. If every request fails, the entries remain but there is no PR.
                out_of_credits = any(
                    pr.pr_creation_error_code == OUT_OF_CREDITS
                    for pr in state.repo_pr_states.values()
                )
                cls._notify_entrypoints_of_failure(
                    organization,
                    run_id,
                    group,
                    OUT_OF_CREDITS if out_of_credits else PR_CREATION_FAILED_REASON,
                )
                return

            if pull_requests:
                # One caveat here is that re-running code changes step isn't
                # handled but the expectation is that we only create PRs once
                # per seer run.
                webhook_action_type = SeerActionType.PR_CREATED
                webhook_payload["pull_requests"] = pull_requests
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

        cls._announce(
            organization=organization,
            run_id=run_id,
            state=state,
            group=group,
            seer_run=seer_run,
            action_type=webhook_action_type,
            payload=webhook_payload,
            step=current_step,
            referrer=current_referrer,
            actor_user_id=actor_user_id,
        )

    @classmethod
    def _announce(
        cls,
        *,
        organization: Organization,
        run_id: int,
        state: SeerRunState,
        group: Group,
        seer_run: SeerRun | None,
        action_type: SeerActionType,
        payload: dict[str, object],
        step: AutofixStep | None,
        referrer: AutofixReferrer | None,
        actor_user_id: int | None,
        mode: str = "steps",
    ) -> None:
        is_pr_created = action_type == SeerActionType.PR_CREATED
        sentry_run_id = str(seer_run.uuid) if seer_run is not None else None
        event_name = action_type.value

        event_type = f"seer.{event_name}"
        try:
            sentry_app_event_type = SentryAppEventType(event_type)
            if SeerAutofixOperator.has_access(organization=organization):
                metrics.incr(
                    "autofix.on_completion_hook.process_autofix_updates",
                    tags={"event_type": str(event_type)},
                )
                activity_attribution: SeerActivityAttribution | None = None
                if action_type == SeerActionType.PR_CREATED and actor_user_id is not None:
                    activity_attribution = {
                        "referrer": referrer or AutofixReferrer.UNKNOWN,
                        "actor_user_id": actor_user_id,
                    }
                record_seer_activity(
                    group=group,
                    event_type=sentry_app_event_type,
                    event_payload=payload,
                    activity_attribution=activity_attribution,
                )
                process_autofix_updates.apply_async(
                    kwargs={
                        "event_type": sentry_app_event_type,
                        "event_payload": payload,
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
                payload=payload,
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
                sentry_run_id=sentry_run_id,
                state=state,
            )

        if is_pr_created:
            record_autofix_event(
                AiAutofixPrCreatedCompletedEvent(
                    organization_id=organization.id,
                    project_id=group.project_id,
                    group_id=group.id,
                    referrer=None if referrer is None else referrer.value,
                    run_id=run_id,
                    mode=mode,
                )
            )
        if step is not None and not is_pr_created:
            referrer_value = referrer.value if referrer is not None else None
            iteration_index = get_latest_iteration_index(state)
            metrics.incr(
                "autofix.explorer.complete",
                tags={
                    "step": step.value,
                    "referrer": referrer_value,
                    "iteration_index": iteration_index,
                    "mode": mode,
                },
            )
            completed_event_cls = STEP_CONFIGS[step].completed_event
            if completed_event_cls is not None:
                record_autofix_event(
                    completed_event_cls(
                        organization_id=organization.id,
                        project_id=group.project_id,
                        group_id=group.id,
                        referrer=referrer_value,
                        run_id=run_id,
                        iteration_index=iteration_index,
                        mode=mode,
                    )
                )

    @classmethod
    def _format_code_changes_payload(cls, state: SeerRunState) -> dict[str, Any]:
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
        current_step, referrer = get_current_step(state)
        referrer = referrer or fallback_referrer or AutofixReferrer.ON_COMPLETION_HOOK

        if current_step is None:
            logger.warning(
                "autofix.on_completion_hook.no_current_step",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

        # Get pipeline metadata from state, falling back to the Sentry-side run
        # mirror for runs Seer started without it (the autofix feature).
        raw_stopping_point = get_run_stopping_point(organization, run_id, state)
        if raw_stopping_point is None:
            return

        stopping_point = AutofixStoppingPoint(raw_stopping_point)
        if current_step == STOPPING_POINT_TO_STEP.get(stopping_point):
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
        try:
            trigger_autofix_agent(
                group=group,
                step=next_step,
                referrer=referrer,
                run_id=run_id,
            )
        except SeerOutOfCreditsException:
            logger.info(
                "autofix.on_completion_hook.next_step_out_of_credits",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "next_step": next_step,
                },
            )

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

        try:
            trigger_push_changes(
                group,
                run_id,
                referrer=AutofixReferrer.ON_COMPLETION_HOOK,
                state=state,
                verify_content=True,
            )
        except SeerOutOfCreditsException:
            logger.info(
                "autofix.on_completion_hook.push_changes_out_of_credits",
                extra={"run_id": run_id, "organization_id": group.organization.id},
            )
            return False
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
