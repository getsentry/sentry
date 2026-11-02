from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Callable
from enum import Enum
from typing import TYPE_CHECKING, Any
from uuid import uuid4

from sentry_sdk import traces

from sentry import features
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.autofix.autofix_agent import trigger_push_changes
from sentry.seer.autofix.commit_author import SeerCommitAuthor, parse_commit_author
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.feature.dispatch import AutofixFeatureArgs, trigger_autofix_feature
from sentry.seer.autofix.feature.models import PrIterationStepArgs
from sentry.seer.autofix.pr_iteration.current_iteration import triggered_iteration_id
from sentry.seer.autofix.pr_iteration.emit import (
    PrIterationOutcome,
    complete_pr_iteration_details,
    outcome_for_failed_run,
)
from sentry.seer.autofix.pr_iteration.feedback import latest_iteration_feedback_kind
from sentry.seer.autofix.pr_iteration.feedback_sources.base import ConsumeTriggerSource, Decision
from sentry.seer.autofix.pr_iteration.iterations import (
    get_iterations,
    get_latest_iteration_index,
    iteration_repos,
)
from sentry.seer.autofix.pr_iteration.logs import LogCtxIteration, PrIterationLogContext
from sentry.seer.autofix.pr_iteration.missing_permissions import failed_tool_calls
from sentry.seer.autofix.pr_iteration.pause import PauseReason, pause_pr_iteration
from sentry.seer.autofix.pr_iteration.pr_state import (
    iteration_prs_any_closed,
    record_pr_closed,
)
from sentry.seer.autofix.pr_iteration.tracing import set_pr_iteration_attributes
from sentry.seer.autofix.pr_ready_for_review import format_pull_requests_payload
from sentry.seer.autofix.steps import AutofixStep
from sentry.tasks.seer.pr_iteration import consume_queued_autofix_feedback
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.seer.agent.client_models import SeerRunState

logger = logging.getLogger(__name__)

BRANCH_MOVED_RETRY_PROMPT = (
    "Your last push failed because the pull request's branch has new commits. Make sure your "
    "changes are integrated with the latest code on the branch."
)

# Retries one iteration gets when its push is refused because the branch moved. A busy branch
# can outrun every retry, so this is what ends the loop.
MAX_BRANCH_MOVED_RETRIES = 2


class Retrying(Enum):
    """The push didn't end the iteration: another turn of it runs, and that turn's completion
    ends it."""

    BRANCH_MOVED = "branch_moved"


def _iteration_repo_states(state: SeerRunState) -> list[dict[str, Any]]:
    return [
        {
            "scm_repo_full_name": repo_name,
            "commit_sha": pr_state.commit_sha,
            "pr_creation_status": pr_state.pr_creation_status,
            "synced": state._is_repo_synced(repo_name),
        }
        for repo_name, pr_state in state.repo_pr_states.items()
    ]


def iteration_log_context(
    organization: Organization,
    group: Group,
    state: SeerRunState,
) -> PrIterationLogContext:
    return PrIterationLogContext.for_run(
        logger, state, organization.id, group.id, iteration=LogCtxIteration.TRIGGERED
    )


def fail_pr_iteration(
    organization: Organization,
    run_id: int,
    state: SeerRunState,
    group_id: int | None,
) -> None:
    log_ctx = PrIterationLogContext.for_run(
        logger, state, organization.id, group_id, iteration=LogCtxIteration.TRIGGERED
    )
    set_pr_iteration_attributes(group_id=group_id, iteration_id=log_ctx.iteration_id)

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
    complete_pr_iteration_details(
        log_ctx=log_ctx,
        run_state=state,
        organization_id=organization.id,
        outcome=outcome_for_failed_run(state),
    )


def fail_pr_iteration_missing_group(
    organization: Organization,
    state: SeerRunState,
    group_id: int | None,
) -> None:
    log_ctx = PrIterationLogContext.for_run(
        logger, state, organization.id, group_id, iteration=LogCtxIteration.TRIGGERED
    )
    set_pr_iteration_attributes(group_id=group_id, iteration_id=log_ctx.iteration_id)

    log_ctx.error(
        "autofix.pr_iteration.completion_hook.group_unresolved",
        exc_info=False,
        run_status=state.status,
    )
    complete_pr_iteration_details(
        log_ctx=log_ctx,
        run_state=state,
        organization_id=organization.id,
        outcome=PrIterationOutcome.MISSING_GROUP_ID.value,
    )


def log_completion_received(
    organization: Organization,
    group: Group,
    state: SeerRunState,
) -> None:
    log_ctx = iteration_log_context(organization, group, state)
    set_pr_iteration_attributes(
        group_id=group.id,
        iteration_id=log_ctx.iteration_id,
    )
    has_changes, is_synced = state.has_code_changes()
    log_ctx.info(
        "autofix.pr_iteration.completion_hook.received",
        run_status=state.status,
        iteration_index=get_latest_iteration_index(state),
        has_changes=has_changes,
        is_synced=is_synced,
        repos_with_diffs=sorted(state.get_diffs_by_repo()),
    )


def record_failed_tool_calls(
    organization: Organization,
    group: Group,
    state: SeerRunState,
) -> None:
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
            sample_rate=1.0,
        )

    iteration_log_context(organization, group, state).info(
        "autofix.pr_iteration.failed_tool_calls",
        failed_tool_counts=dict(counts),
    )


def iteration_completed_webhook_fields(
    organization: Organization,
    group: Group,
    state: SeerRunState,
    format_code_changes: Callable[[SeerRunState], dict],
    *,
    retrying: bool,
) -> dict[str, Any] | None:
    log_ctx = iteration_log_context(organization, group, state)
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
        return None

    _, is_synced = state.has_code_changes()
    errored_repos = [] if is_synced else iteration_terminal_errored_repos(state)
    if retrying:
        # Another turn of this iteration runs; its completion emits the webhook.
        log_ctx.info(
            "autofix.pr_iteration.iteration_outcome",
            outcome="retrying",
            reason="branch_moved",
            webhook_emitted=False,
            iteration_index=iteration_index,
            errored_repos=errored_repos,
        )
        return None
    if not is_synced and not errored_repos:
        log_ctx.info(
            "autofix.pr_iteration.iteration_outcome",
            outcome="awaiting_push",
            reason="repos_not_synced",
            webhook_emitted=False,
            iteration_index=iteration_index,
            repo_states=_iteration_repo_states(state),
        )
        return None

    log_ctx.info(
        "autofix.pr_iteration.iteration_outcome",
        outcome="changes_pushed" if is_synced else "push_failed",
        reason="all_repos_synced" if is_synced else "pr_creation_errored",
        webhook_emitted=True,
        iteration_index=iteration_index,
        errored_repos=errored_repos,
        repo_states=_iteration_repo_states(state),
    )

    return {
        "pull_requests": format_pull_requests_payload(state),
        "code_changes": format_code_changes(state),
        "iteration_index": iteration_index,
    }


def continue_pr_iteration(
    organization: Organization,
    group: Group,
    run_id: int,
    state: SeerRunState,
    referrer: AutofixReferrer,
) -> bool:
    """Push the iteration's changes or end the iteration. Returns whether another turn of the
    iteration runs."""
    log_ctx = iteration_log_context(organization, group, state)

    outcome = pr_iteration_push_outcome(log_ctx, group, run_id, state, referrer)

    if outcome is None or isinstance(outcome, Retrying):
        metrics.incr(
            "autofix.pr_iteration.step",
            tags={
                "checkpoint": "code_change_completed",
                "referrer": referrer.value,
                "feedback_kind": latest_iteration_feedback_kind(state),
            },
            sample_rate=1.0,
        )
        return isinstance(outcome, Retrying)

    if (
        state.status == "completed"
        and outcome == PrIterationOutcome.PR_CREATION_ERRORED
        and any(
            state.repo_pr_states[repo].pr_creation_error_code == "branch_moved"
            for repo in iteration_terminal_errored_repos(state)
        )
    ):
        # A terminal refusal to overwrite newer PR commits is a failed iteration,
        # not a successful hand-back to the feedback queue.
        pause_pr_iteration(
            run_id=run_id,
            organization_id=organization.id,
            reason=PauseReason.RUN_ERRORED,
        )

    if outcome == PrIterationOutcome.ALREADY_PUSHED:
        metrics.incr(
            "autofix.pr_iteration.step",
            tags={
                "checkpoint": "iteration_completed",
                "referrer": referrer.value,
                "feedback_kind": latest_iteration_feedback_kind(state),
            },
            sample_rate=1.0,
        )

    if outcome in (
        PrIterationOutcome.ALREADY_PUSHED,
        PrIterationOutcome.NO_CODE_CHANGES,
    ):
        consume_queued_feedback(log_ctx, organization, run_id)

    complete_pr_iteration_details(
        log_ctx=log_ctx,
        run_state=state,
        organization_id=organization.id,
        outcome=outcome.value,
    )
    return False


@traces.trace
def consume_queued_feedback(
    log_ctx: PrIterationLogContext,
    organization: Organization,
    run_id: int,
) -> None:
    trigger_id = uuid4().hex
    consume_queued_autofix_feedback.apply_async(
        kwargs={
            "run_id": run_id,
            "organization_id": organization.id,
            "trigger_id": trigger_id,
            "trigger_source": ConsumeTriggerSource.COMPLETION,
        }
    )
    log_ctx.info(
        "autofix.pr_iteration.feedback.trigger",
        outcome="triggered",
        reason="iteration_finished",
        countdown=None,
        trigger_id=trigger_id,
        trigger_source=ConsumeTriggerSource.COMPLETION,
    )


def iteration_terminal_errored_repos(state: SeerRunState) -> list[str]:
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


def _iteration_commit_author(state: SeerRunState) -> SeerCommitAuthor | None:
    try:
        iterations = get_iterations(state)
    except Exception:
        logger.exception("autofix.on_completion_hook.iteration_commit_author_failed")
        return None
    if not iterations:
        return None
    metadata = iterations[-1].blocks[0].message.metadata or {}
    return parse_commit_author(metadata.get("commit_author"))


def _latest_iteration_touched_files(log_ctx: PrIterationLogContext, state: SeerRunState) -> bool:
    try:
        iterations = get_iterations(state)
    except Exception:
        log_ctx.error("autofix.pr_iteration.get_iterations_failed")
        return True

    if not iterations:
        return True

    return bool(iteration_repos(iterations[-1]))


@traces.trace
def pr_iteration_push_outcome(
    log_ctx: PrIterationLogContext,
    group: Group,
    run_id: int,
    state: SeerRunState,
    referrer: AutofixReferrer,
) -> PrIterationOutcome | Retrying | None:
    if not state.repo_pr_states:
        log_ctx.error(
            "autofix.pr_iteration.push",
            outcome="not_pushed",
            reason="no_pull_requests",
            exc_info=False,
        )
        return PrIterationOutcome.NO_PULL_REQUEST

    if not _latest_iteration_touched_files(log_ctx, state):
        log_ctx.info("autofix.pr_iteration.push", outcome="not_pushed", reason="no_changes")
        metrics.incr(
            "autofix.pr_iteration.step",
            tags={
                "checkpoint": "no_code_change",
                "referrer": referrer.value,
                "feedback_kind": latest_iteration_feedback_kind(state),
            },
            sample_rate=1.0,
        )
        return PrIterationOutcome.NO_CODE_CHANGES

    _, is_synced = state.has_code_changes()

    if is_synced:
        log_ctx.info("autofix.pr_iteration.push", outcome="not_pushed", reason="already_synced")
        return PrIterationOutcome.ALREADY_PUSHED

    errored_repos = iteration_terminal_errored_repos(state)
    moved_branch = bool(errored_repos) and _push_failed_on_moved_branch(group, state, errored_repos)
    if errored_repos and not moved_branch:
        log_ctx.info(
            "autofix.pr_iteration.push",
            outcome="not_pushed",
            reason="terminal_push_errors",
            errored_repos=errored_repos,
        )
        return PrIterationOutcome.PR_CREATION_ERRORED

    if iteration_prs_any_closed(group.organization, state):
        record_pr_closed("push")
        pause_pr_iteration(
            run_id=run_id,
            organization_id=group.organization.id,
            reason=PauseReason.PR_CLOSED,
        )
        log_ctx.info("autofix.pr_iteration.push", outcome="not_pushed", reason="pr_closed")
        return PrIterationOutcome.PR_CLOSED

    if moved_branch:
        return _retry_push_on_moved_branch(log_ctx, group, run_id, state)

    metrics.incr(
        "autofix.pr_iteration.step",
        tags={
            "checkpoint": "code_change_started",
            "referrer": referrer.value,
            "feedback_kind": latest_iteration_feedback_kind(state),
        },
        sample_rate=1.0,
    )

    pushed = _push_iteration_changes(
        log_ctx,
        group,
        run_id,
        state,
        author=_iteration_commit_author(state),
    )
    return None if pushed else PrIterationOutcome.PUSH_FAILED


@traces.trace
def _push_iteration_changes(
    log_ctx: PrIterationLogContext,
    group: Group,
    run_id: int,
    state: SeerRunState,
    author: SeerCommitAuthor | None = None,
) -> bool:
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
            # Never overwrite commits on the PR that Seer didn't push.
            allow_force_push=False,
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


def _push_failed_on_moved_branch(
    group: Group, state: SeerRunState, errored_repos: list[str]
) -> bool:
    return features.has(
        "organizations:autofix-pr-iteration-pin-to-pr-head", group.organization
    ) and any(
        state.repo_pr_states[repo].pr_creation_error_code == "branch_moved"
        for repo in errored_repos
    )


def _branch_moved_retry_decision(state: SeerRunState) -> Decision:
    """Whether the latest iteration may run another turn after the branch moved under its push.

    A retry is not a new iteration: it finishes the one it retries on the PR's latest commit, so
    the iteration gates (the project toggle, the automated caps) don't apply. Only
    ``MAX_BRANCH_MOVED_RETRIES`` bounds it. Each retry is a turn with its own PR_ITERATION block
    under the same iteration index, so the blocks sharing that index count the turns so far.
    """
    iterations = get_iterations(state)
    if not iterations:
        return Decision(ok=False, reason="no_iteration")

    latest_index = iterations[-1].index
    retries = sum(1 for iteration in iterations if iteration.index == latest_index) - 1
    if retries >= MAX_BRANCH_MOVED_RETRIES:
        return Decision(ok=False, reason="retry_cap_reached")
    return Decision(ok=True, reason="under_retry_cap")


@traces.trace
def _retry_push_on_moved_branch(
    log_ctx: PrIterationLogContext,
    group: Group,
    run_id: int,
    state: SeerRunState,
) -> PrIterationOutcome | Retrying:
    """Run another turn of the same iteration. It starts on the PR's latest commit, so the push
    that follows it can land on top."""
    decision = _branch_moved_retry_decision(state)
    if not decision.ok:
        log_ctx.info(
            "autofix.pr_iteration.push",
            outcome="not_pushed",
            reason="branch_moved_retry_blocked",
            decision=decision.reason,
        )
        return PrIterationOutcome.PR_CREATION_ERRORED

    iteration = get_iterations(state)[-1]
    metadata = iteration.blocks[0].message.metadata or {}
    try:
        trigger_autofix_feature(
            group,
            AutofixFeatureArgs(
                step=AutofixStep.PR_ITERATION,
                referrer=AutofixReferrer.ON_COMPLETION_HOOK,
                existing_run_id=run_id,
                user_context=BRANCH_MOVED_RETRY_PROMPT,
                step_args=PrIterationStepArgs(
                    iteration_index=iteration.index,
                    iteration_id=triggered_iteration_id(state),
                    feedback=metadata.get("feedback"),
                    commit_author=metadata.get("commit_author"),
                    pr_urls={
                        pr.repo_name: pr.pr_url for pr in state.repo_pr_states.values() if pr.pr_url
                    },
                ),
            ),
        )
    except Exception as e:
        # End the iteration as errored, so the caller pauses the run and records the outcome.
        log_ctx.error(
            "autofix.pr_iteration.push",
            outcome="not_pushed",
            reason="branch_moved_retry_failed",
            error_type=type(e).__name__,
        )
        return PrIterationOutcome.PR_CREATION_ERRORED
    log_ctx.info("autofix.pr_iteration.push", outcome="retrying", reason="branch_moved")
    return Retrying.BRANCH_MOVED
