from __future__ import annotations

import logging
from collections import Counter
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from django.db import router, transaction
from django.utils import timezone
from pydantic import ValidationError
from scm.manager import SourceCodeManager

from sentry import analytics, features
from sentry.analytics.events.autofix_events import (
    AiAutofixIntrospectionEvent,
    AiAutofixPrCreatedCompletedEvent,
)
from sentry.integrations.github.utils import is_github_rate_limit_sensitive
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.scm.factory import new as make_scm
from sentry.seer.agent.client_models import Artifact
from sentry.seer.agent.client_utils import fetch_run_status
from sentry.seer.agent.on_completion_hook import AgentOnCompletionHook
from sentry.seer.autofix.artifact_schemas import FixabilityAssessment, RootCauseArtifact
from sentry.seer.autofix.autofix_agent import (
    STEP_CONFIGS,
    AutofixStep,
    get_iterations,
    get_latest_iteration_index,
    should_open_autofix_pr_as_draft,
    trigger_autofix_agent,
    trigger_coding_agent_handoff,
    trigger_push_changes,
)
from sentry.seer.autofix.coding_agent import IntegrationNotFound
from sentry.seer.autofix.commit_author import SeerCommitAuthor, parse_commit_author
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.github_perms import failed_tool_calls
from sentry.seer.autofix.pr_iteration.emit import complete_pr_iteration_details
from sentry.seer.autofix.pr_iteration.feedback import parse_feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTriggerSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.seer.autofix.pr_iteration.pause import PauseReason, pause_pr_iteration
from sentry.seer.autofix.pr_ready_for_review import (
    emit_pr_ready_for_review,
    format_pull_requests_payload,
)
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    clear_preference_automation_handoff,
    get_automation_handoff,
)
from sentry.seer.autofix_rca.models import FEATURE_ID as AUTOFIX_FEATURE_ID
from sentry.seer.autofix_rca.models import LEGACY_FEATURE_ID as LEGACY_AUTOFIX_FEATURE_ID
from sentry.seer.entrypoints.operator import (
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
from sentry.tasks.seer.pr_iteration import (
    UnsupportedProviderError,
    _add_comment_reaction,
    _delete_own_comment_eyes_reaction,
    _resolve_review_comment_threads,
    consume_queued_autofix_feedback,
)
from sentry.utils import metrics

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


def _record_completion_reaction(outcome: str, amount: int = 1) -> None:
    """Record where a completion-reaction attempt exited so silent drop-offs of
    the :tada: ack are visible in aggregate rather than invisible."""
    metrics.incr(
        "autofix.on_completion_hook.completion_reaction",
        amount=amount,
        tags={"outcome": outcome},
    )


def _iteration_repo_states(state: SeerRunState) -> list[dict[str, Any]]:
    """Where each of the run's PRs stands on this pass."""
    return [
        {
            "scm_repo_full_name": repo_name,
            "commit_sha": pr_state.commit_sha,
            "pr_creation_status": pr_state.pr_creation_status,
            "synced": state._is_repo_synced(repo_name),
        }
        for repo_name, pr_state in state.repo_pr_states.items()
    ]


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
    - No-op'ing when the run did not complete (errors / timeouts), so Seer can
      invoke this hook with ``call_on_failure=True`` without advancing the pipeline
    """

    @classmethod
    def execute(cls, organization: Organization, run_id: int) -> None:
        """
        Execute the hook when the agent completes a step.

        Args:
            organization: The organization context
            run_id: The ID of the completed run
        """
        try:
            state = fetch_run_status(run_id, organization)
        except Exception:
            logger.exception(
                "autofix.on_completion_hook.fetch_state_failed",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

        if state.status != "completed":
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
            return

        metadata = state.metadata or {}
        group_id = metadata.get("group_id")
        run_referrer = None
        if group_id is None:
            group_id, run_referrer = _group_and_referrer_from_run(organization, run_id)
        if group_id is None:
            logger.warning(
                "autofix.on_completion_hook.missing_group_id",
                extra={"run_id": run_id, "organization_id": organization.id},
            )
            return

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
            return
        now = timezone.now()
        with transaction.atomic(using=router.db_for_write(Group)):
            group.update(seer_explorer_autofix_last_triggered=now)
            SeerRun.objects.filter(
                organization_id=organization.id,
                seer_run_state_id=run_id,
            ).update(last_triggered_at=now)

        current_step, _ = cls._get_current_step(state)
        if current_step == AutofixStep.PR_ITERATION:
            has_changes, is_synced = state.has_code_changes()
            cls._iteration_log_context(organization, group, state).info(
                "autofix.pr_iteration.completion_hook.received",
                run_status=state.status,
                iteration_index=get_latest_iteration_index(state),
                has_changes=has_changes,
                is_synced=is_synced,
                repos_with_diffs=sorted(state.get_diffs_by_repo()),
            )

        # Send webhook for the completed step
        cls._send_step_webhook(organization, run_id, state, group, fallback_referrer=run_referrer)

        cls._record_failed_tool_calls(organization, group, state)

        # Acknowledge the comment(s) that triggered a completed PR iteration; no
        # outcomes means it was never an ack candidate, so there's nothing to log.
        reaction_outcomes = cls._maybe_react_to_completed_iteration(organization, run_id, state)
        if reaction_outcomes:
            logger.info(
                "autofix.on_completion_hook.completion_reaction.summary",
                extra={
                    "run_id": run_id,
                    "organization_id": organization.id,
                    "outcomes": dict(reaction_outcomes),
                },
            )

        # Continue the automated pipeline if stopping_point hasn't been reached
        cls._maybe_continue_pipeline(
            organization, run_id, state, group, fallback_referrer=run_referrer
        )

    @classmethod
    def _iteration_log_context(
        cls,
        organization: Organization,
        group: Group,
        state: SeerRunState,
    ) -> PrIterationLogContext:
        """The shared PR-iteration identity, from what the caller already holds."""
        return PrIterationLogContext.for_run(logger, state, organization.id, group.id)

    @classmethod
    def _record_failed_tool_calls(
        cls,
        organization: Organization,
        group: Group,
        state: SeerRunState,
    ) -> None:
        """Log and count PR-iteration tool calls Seer marked ``is_error``."""
        current_step, _ = cls._get_current_step(state)
        if current_step != AutofixStep.PR_ITERATION:
            return

        # The hook re-fires after a successful push. Count only on the
        # agent-completion pass (or a no-diff pass), not the post-push one.
        has_changes, is_synced = state.has_code_changes()
        if has_changes and is_synced:
            return

        iterations = get_iterations(state)
        if not iterations:
            return

        failed = failed_tool_calls(iterations[-1].blocks)
        if not failed:
            return

        counts = Counter(call.function for call in failed)
        for function, amount in counts.items():
            metrics.incr(
                "autofix.pr_iteration.failed_tool_call",
                amount=amount,
                tags={"tool": function},
            )

        cls._iteration_log_context(organization, group, state).info(
            "autofix.pr_iteration.failed_tool_calls",
            failed_tool_functions=[call.function for call in failed],
            failed_tool_counts=dict(counts),
        )

    @classmethod
    def _repo_name_for_feedback(
        cls,
        state: SeerRunState,
        source: GithubPrCommentFeedbackSource | GithubPrReviewCommentFeedbackSource,
        run_id: int,
        organization_id: int,
    ) -> str | None:
        # Only top-level PR comments capture ``repo_name`` at trigger time; review
        # comments fall back to the sole repo when the run touches exactly one.
        repo_name = getattr(source, "repo_name", None)
        if repo_name is not None:
            return repo_name
        if len(state.repo_pr_states) == 1:
            # Backward-compat path for feedback serialized before repo_name was
            # captured at trigger time; unambiguous only with a single repo.
            logger.info(
                "autofix.on_completion_hook.completion_reaction.legacy_repo_inference",
                extra={"run_id": run_id, "organization_id": organization_id},
            )
            return next(iter(state.repo_pr_states))
        logger.warning(
            "autofix.on_completion_hook.completion_reaction.repo_unresolved",
            extra={"run_id": run_id, "organization_id": organization_id},
        )
        return None

    @classmethod
    def _maybe_react_to_completed_iteration(
        cls,
        organization: Organization,
        run_id: int,
        state: SeerRunState,
    ) -> Counter[str]:
        """Acknowledge the comment(s) that triggered a completed iteration.

        Returns every recorded outcome so the caller can log what this attempt did;
        empty means the run wasn't an ack candidate at all.
        """
        # Mirrors what's recorded to the outcome metric, so a single run's story is
        # readable in logs and not only in aggregate.
        outcomes: Counter[str] = Counter()

        def record(outcome: str, amount: int = 1) -> None:
            outcomes[outcome] += amount
            _record_completion_reaction(outcome, amount)

        if not features.has("organizations:autofix-pr-iteration-manual", organization=organization):
            return outcomes

        current_step, _ = cls._get_current_step(state)
        if current_step != AutofixStep.PR_ITERATION or state.status != "completed":
            return outcomes

        # Don't react before the commit lands.
        _, is_synced = state.has_code_changes()
        if not is_synced:
            record("not_synced")
            return outcomes

        # The consumed feedback is serialized onto the latest iteration's
        # opening PR_ITERATION block.
        iterations = get_iterations(state)
        raw = (
            (iterations[-1].blocks[0].message.metadata or {}).get("feedback")
            if iterations
            else None
        )
        if not raw:
            record("no_feedback")
            return outcomes

        sources: list[GithubPrCommentFeedbackSource | GithubPrReviewCommentFeedbackSource] = []
        for feedback in parse_feedback(raw):
            if isinstance(
                feedback.source,
                (GithubPrCommentFeedbackSource, GithubPrReviewCommentFeedbackSource),
            ):
                sources.append(feedback.source)
        if not sources:
            record("no_pr_comment_sources")
            return outcomes

        # Rate-limit-sensitive orgs skip the extra reaction-delete / resolve API calls.
        rate_limit_sensitive = is_github_rate_limit_sensitive(organization.slug)
        delete_eyes = not rate_limit_sensitive

        scm_by_repo: dict[str, SourceCodeManager] = {}
        # Inline review-comment node ids to resolve, grouped by (repo, PR).
        resolve_by_repo_pr: dict[tuple[str, int], list[str]] = {}
        for source in sources:
            comment_id = source.comment.id
            if comment_id is None:
                record("no_comment_id")
                continue

            repo_name = cls._repo_name_for_feedback(state, source, run_id, organization.id)
            if repo_name is None:
                record("no_repo_name")
                continue

            scm = scm_by_repo.get(repo_name)
            if scm is None:
                # Refuse to guess when the same name spans providers; None on both
                # "not found" and "ambiguous".
                repo, resolution = Repository.objects.resolve_active(
                    organization_id=organization.id,
                    name=repo_name,
                    normalized_provider=None,
                )
                if repo is None:
                    logger.warning(
                        "autofix.on_completion_hook.completion_reaction.repo_not_found",
                        extra={
                            "run_id": run_id,
                            "organization_id": organization.id,
                            "resolution": resolution,
                        },
                    )
                    record("repo_not_found")
                    continue
                try:
                    scm = make_scm(organization.id, repo.id, referrer="seer")
                except Exception:
                    logger.warning(
                        "autofix.on_completion_hook.completion_reaction.scm_init_failed",
                        extra={"run_id": run_id, "organization_id": organization.id},
                        exc_info=True,
                    )
                    record("scm_init_failed")
                    continue
                scm_by_repo[repo_name] = scm

            pr_state = state.repo_pr_states.get(repo_name)
            if not pr_state or not pr_state.pr_number:
                record("no_pr_number")
                continue
            pr_number = pr_state.pr_number

            source_type = source.type
            # Only top-level PR comments get the :tada:; inline comments resolve below (CW-1688).
            if source_type == "github-pr-comment":
                _add_comment_reaction(
                    scm,
                    source_type=source_type,
                    pr_number=pr_number,
                    comment_id=comment_id,
                    reaction="hooray",
                )
                record("reacted")
            elif source_type == "github-pr-review-comment" and not rate_limit_sensitive:
                unique_id = getattr(source.comment, "unique_id", None)
                if unique_id is None:
                    record("resolve_no_unique_id")
                else:
                    resolve_by_repo_pr.setdefault((repo_name, pr_number), []).append(unique_id)
            if delete_eyes:
                _delete_own_comment_eyes_reaction(
                    scm,
                    source_type=source_type,
                    pr_number=pr_number,
                    comment_id=comment_id,
                )

        if rate_limit_sensitive and any(
            source.type == "github-pr-review-comment" for source in sources
        ):
            record("resolve_rate_limited")

        for (repo_name, pr_number), unique_ids in resolve_by_repo_pr.items():
            log_extra = {
                "run_id": run_id,
                "organization_id": organization.id,
                "repo_name": repo_name,
                "pr_number": pr_number,
                "comment_count": len(unique_ids),
            }
            try:
                result = _resolve_review_comment_threads(
                    scm_by_repo[repo_name],
                    pr_number=pr_number,
                    comment_unique_ids=unique_ids,
                )
            except UnsupportedProviderError:
                logger.warning(
                    "autofix.on_completion_hook.completion_reaction.resolve_unsupported_provider",
                    extra=log_extra,
                    exc_info=True,
                )
                record("resolve_unsupported_provider")
                continue
            except Exception:
                logger.exception(
                    "autofix.on_completion_hook.completion_reaction.resolve_failed",
                    extra=log_extra,
                )
                record("resolve_failed")
                continue

            resolve_outcomes = {
                "resolved": result.resolved,
                "resolve_skipped_already_resolved": result.already_resolved,
                "resolve_thread_not_found": result.not_found,
            }
            for outcome, amount in resolve_outcomes.items():
                if amount:
                    record(outcome, amount)

        return outcomes

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
                analytics.record(
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
        elif current_step == AutofixStep.PR_ITERATION:
            log_ctx = cls._iteration_log_context(organization, group, state)
            iteration_index = get_latest_iteration_index(state)

            if not state.repo_pr_states:
                log_ctx.error(
                    "autofix.pr_iteration.iteration_outcome",
                    outcome="push_failed",
                    reason="no_pull_requests",
                    webhook_emitted=False,
                    iteration_index=iteration_index,
                    exc_info=False,
                )
                return

            # we only want to emit this webhook after the iteration changes are pushed
            _, is_synced = state.has_code_changes()
            errored_repos = [] if is_synced else cls._iteration_terminal_errored_repos(state)
            if not is_synced and not errored_repos:
                # Haven't _pushed_ changes yet
                log_ctx.info(
                    "autofix.pr_iteration.iteration_outcome",
                    outcome="awaiting_push",
                    reason="repos_not_synced",
                    webhook_emitted=False,
                    iteration_index=iteration_index,
                    repo_states=_iteration_repo_states(state),
                )
                return

            # We tried pushing since `is_synced` or `errored_repos` are true
            log_ctx.info(
                "autofix.pr_iteration.iteration_outcome",
                outcome="changes_pushed" if is_synced else "push_failed",
                reason="all_repos_synced" if is_synced else "pr_creation_errored",
                webhook_emitted=True,
                iteration_index=iteration_index,
                errored_repos=errored_repos,
                repo_states=_iteration_repo_states(state),
            )

            webhook_action_type = SeerActionType.ITERATION_COMPLETED
            webhook_payload["pull_requests"] = format_pull_requests_payload(state)
            webhook_payload["code_changes"] = cls._format_code_changes_payload(state)
            webhook_payload["iteration_index"] = iteration_index

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
                record_seer_activity(
                    group=group,
                    event_type=sentry_app_event_type,
                    event_payload=webhook_payload,
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
                analytics.record(
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

        # PR iteration runs against an existing PR rather than the automated
        # pipeline. Once the agent finishes iterating, push the new changes to
        # update that PR. _push_changes is a no-op once the repos are synced, so
        # the hook re-fire after the push doesn't loop.
        if current_step == AutofixStep.PR_ITERATION:
            log_ctx = cls._iteration_log_context(organization, group, state)

            if state.status == "error":
                paused = pause_pr_iteration(
                    run_id=run_id,
                    organization_id=organization.id,
                    reason=PauseReason.RUN_ERRORED,
                )
                log_ctx.info(
                    "autofix.pr_iteration.paused_on_error",
                    run_status=state.status,
                    paused=paused,
                    failure_reason=state.failure_reason,
                )
                return

            pushed = cls._push_iteration_changes(
                log_ctx,
                group,
                run_id,
                state,
                author=cls._iteration_commit_author(state),
            )

            # we assume that after we push, we'll get more feedback in the queue and we'll consume then
            if not pushed:
                # we want to consume queued feedback _after_ we know changes have been pushed
                # because some feedback in the queue could be filtered out
                cls._consume_queued_feedback(log_ctx, organization, run_id)

            complete_pr_iteration_details(
                log_ctx=log_ctx,
                run_state=state,
                organization_id=organization.id,
                pushed_changes=pushed,
            )
            return

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
    def _consume_queued_feedback(
        cls,
        log_ctx: PrIterationLogContext,
        organization: Organization,
        run_id: int,
    ) -> None:
        """Drain any feedback enqueued while the iteration was running.

        No GitHub App permission check here, deliberately. We only reach this
        from a finished PR_ITERATION step, and an iteration can only have been
        started by ``trigger_consume_pr_iteration_feedback``, which refuses to
        schedule one while a permission is missing. So reaching this point is
        itself evidence the permissions were there — re-checking would only
        catch a lapse mid-iteration, which the next queue-time gate handles.
        """
        # Minted here because `apply_async` returns `None`, so passing our own id
        # down is the only direction the link travels.
        trigger_id = uuid4().hex
        consume_queued_autofix_feedback.apply_async(
            kwargs={
                "run_id": run_id,
                "organization_id": organization.id,
                "trigger_id": trigger_id,
                "trigger_source": ConsumeTriggerSource.FEEDBACK,
            }
        )
        log_ctx.info(
            "autofix.pr_iteration.feedback.trigger",
            # `triggered_by` counts the two producers apart: arrival vs iteration-end.
            triggered_by="completion_hook",
            outcome="triggered",
            reason="iteration_finished",
            countdown=None,
            trigger_id=trigger_id,
            trigger_source=ConsumeTriggerSource.FEEDBACK,
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
    def _iteration_terminal_errored_repos(cls, state: SeerRunState) -> list[str]:
        """
        Return the errored repos when unsynced repos have terminal push failures.

        Returns an empty list when there are no errored repos, or when some
        non-errored repo is still unsynced (i.e. a push can still make progress).
        Used to stop waiting for a synced PR after push errors without retrying.
        """
        diffs_by_repo = state.get_diffs_by_repo()
        errored_repos = [
            repo
            for repo in diffs_by_repo
            if (pr_state := state.repo_pr_states.get(repo)) is not None
            and pr_state.pr_creation_status == "error"
        ]
        if not errored_repos:
            return []

        if all(state._is_repo_synced(repo) or repo in errored_repos for repo in diffs_by_repo):
            return errored_repos

        return []

    @classmethod
    def _iteration_commit_author(cls, state: SeerRunState) -> SeerCommitAuthor | None:
        """The author stored on the latest iteration's opening PR_ITERATION block."""
        try:
            iterations = get_iterations(state)
        except Exception:
            logger.exception("autofix.on_completion_hook.iteration_commit_author_failed")
            return None
        if not iterations:
            return None
        metadata = iterations[-1].blocks[0].message.metadata or {}
        return parse_commit_author(metadata.get("commit_author"))

    @classmethod
    def _push_iteration_changes(
        cls,
        log_ctx: PrIterationLogContext,
        group: Group,
        run_id: int,
        state: SeerRunState,
        author: SeerCommitAuthor | None = None,
    ) -> bool:
        """Push an iteration's changes to the PRs it already has. True if it pushed.

        Branched off :meth:`_push_changes`
        """
        if not state.repo_pr_states:
            log_ctx.error(
                "autofix.pr_iteration.push",
                outcome="not_pushed",
                reason="no_pull_requests",
                exc_info=False,
            )
            return False

        has_changes, is_synced = state.has_code_changes()

        if not has_changes:
            log_ctx.info("autofix.pr_iteration.push", outcome="not_pushed", reason="no_changes")
            return False

        if is_synced:
            log_ctx.info("autofix.pr_iteration.push", outcome="not_pushed", reason="already_synced")
            return False

        errored_repos = cls._iteration_terminal_errored_repos(state)
        if errored_repos:
            log_ctx.info(
                "autofix.pr_iteration.push",
                outcome="not_pushed",
                reason="terminal_push_errors",
                errored_repos=errored_repos,
            )
            return False

        try:
            trigger_push_changes(
                group,
                run_id,
                referrer=AutofixReferrer.ON_COMPLETION_HOOK,
                state=state,
                verify_content=features.has(
                    "organizations:autofix-verify-pr-content", organization=group.organization
                ),
                author=author,
            )
        except Exception as e:
            log_ctx.error(
                "autofix.pr_iteration.push",
                outcome="failed",
                reason="exception",
                error_type=type(e).__name__,
            )
            return False

        log_ctx.info("autofix.pr_iteration.push", outcome="pushed", reason="ok")
        return True

    @classmethod
    def _push_changes(
        cls,
        group: Group,
        run_id: int,
        state: SeerRunState,
    ) -> bool:
        """Push code changes to create PRs. Returns True if changes were pushed.

        The automated pipeline's open-PR step; PR iteration branched off into
        :meth:`_push_iteration_changes` and took the ``author`` with it.
        """
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
        errored_repos = cls._iteration_terminal_errored_repos(state)
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
