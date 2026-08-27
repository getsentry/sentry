from __future__ import annotations

import logging
from collections import Counter
from collections.abc import Sequence
from typing import TYPE_CHECKING

from sentry import analytics, features
from sentry.analytics.events.pr_iteration_events import (
    AiAutofixPrIterationDetailsCompletedEvent,
    AiAutofixPrIterationDetailsStartedEvent,
    PrIterationFailureStage,
    PrIterationOutcome,
)
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.seer.agent.client_models import AgentFilePatch, MemoryBlock, SeerRunState
from sentry.seer.autofix.github_perms import (
    failed_tool_calls,
    get_out_of_date_github_permissions,
)
from sentry.seer.autofix.pr_iteration.constants import PR_ITERATION_PROVIDER_SLUG
from sentry.seer.autofix.pr_iteration.feedback import (
    Feedback,
    automated_iteration_streak,
    blocks_feedback,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.run_markers import record_run_extras
from sentry.seer.models.run import SeerRun
from sentry.utils import json, metrics

if TYPE_CHECKING:
    from sentry.seer.autofix.autofix_agent import Iteration

logger = logging.getLogger(__name__)

DETAILS_EMITTED_EXTRA = "pr_iteration_details_emitted"

CONSUME_ID_METADATA_KEY = "consume_id"

WORKFLOW_DIR = ".github/workflows"

PR_ITERATION_FLAGS = (
    "organizations:autofix-pr-iteration",
    "organizations:autofix-pr-iteration-cap-assign",
    "organizations:autofix-pr-iteration-manual",
    "organizations:autofix-pr-iteration-review-request",
)


def _trigger_head_sha(feedbacks: Sequence[Feedback]) -> str | None:
    for feedback in feedbacks:
        source = feedback.source
        if isinstance(source, CheckSuiteFeedbackSource) and source.event.check_suite.head_sha:
            return source.event.check_suite.head_sha

    return None


def _feedback_window(feedbacks: Sequence[Feedback]) -> tuple[str | None, str | None]:
    timestamps = sorted(feedback.timestamp for feedback in feedbacks)
    if not timestamps:
        return None, None

    return timestamps[0].isoformat(), timestamps[-1].isoformat()


def _iteration_patches(blocks: Sequence[MemoryBlock]) -> list[AgentFilePatch]:
    merged: dict[tuple[str, str], AgentFilePatch] = {}
    for block in blocks:
        for patch in block.merged_file_patches or []:
            merged[(patch.repo_name, patch.patch.path)] = patch
    return list(merged.values())


def _tool_call_counts(blocks: Sequence[MemoryBlock]) -> tuple[int, int, dict[str, int]]:
    total = sum(len(block.message.tool_calls or []) for block in blocks)
    failed_by_name = Counter(call.function for call in failed_tool_calls(blocks))
    return total, sum(failed_by_name.values()), dict(failed_by_name)


def _sentry_pull_request(seer_run: SeerRun | None) -> tuple[int | None, int | None]:
    if seer_run is None:
        return None, None

    pull_requests = list(seer_run.pull_requests.values_list("id", "repository_id")[:2])
    if len(pull_requests) != 1:
        return None, None

    pull_request_id, repository_id = pull_requests[0]
    return repository_id, pull_request_id


def _iteration_consume_id(iteration: Iteration | None) -> str | None:
    if iteration is None or not iteration.blocks:
        return None

    metadata = iteration.blocks[0].message.metadata or {}
    consume_id = metadata.get(CONSUME_ID_METADATA_KEY)
    return consume_id or None


def _iteration_repo_name(state: SeerRunState) -> str | None:
    if len(state.repo_pr_states) == 1:
        return next(iter(state.repo_pr_states))

    return None


def _push_error_code(state: SeerRunState, errored_repos: Sequence[str]) -> str | None:
    for repo_name in errored_repos:
        pr_state = state.repo_pr_states.get(repo_name)
        if pr_state is not None and pr_state.pr_creation_error_code is not None:
            return pr_state.pr_creation_error_code

    return None


def _path_is_workflow(path: str) -> bool:
    return path == WORKFLOW_DIR or path.startswith(f"{WORKFLOW_DIR}/")


def _patches_touch_workflows(patches: Sequence[AgentFilePatch]) -> bool:
    return any(_path_is_workflow(patch.patch.path) for patch in patches)


def _terminal_outcome(
    state: SeerRunState, iteration: Iteration | None, errored_repos: Sequence[str]
) -> tuple[PrIterationOutcome, PrIterationFailureStage] | None:
    if state.status != "completed":
        return "agent_error", "agent"

    if iteration is None:
        return "no_iteration", "agent"

    if not _iteration_patches(iteration.blocks):
        return "no_code_changes", "agent"

    if errored_repos:
        return "push_failed", "push"

    _, is_synced = state.has_code_changes()
    if is_synced:
        return "code_changes_pushed", "none"

    return None


def build_pr_iteration_details_row(
    *,
    organization: Organization,
    group: Group,
    run_id: int,
    state: SeerRunState,
    iteration: Iteration | None,
    iterations: Sequence[Iteration],
    outcome: PrIterationOutcome,
    failure_stage: PrIterationFailureStage,
    errored_repos: Sequence[str],
    seer_run: SeerRun | None = None,
    referrer: str | None = None,
) -> AiAutofixPrIterationDetailsCompletedEvent:
    repo_name = _iteration_repo_name(state)
    pr_state = state.repo_pr_states.get(repo_name) if repo_name is not None else None
    repository_id, pull_request_id = _sentry_pull_request(seer_run)

    blocks = iteration.blocks if iteration is not None else []
    feedbacks = blocks_feedback(blocks)
    first_received_at, last_received_at = _feedback_window(feedbacks)
    tool_calls_total, tool_calls_failed, failed_by_name = _tool_call_counts(blocks)
    patches = _iteration_patches(blocks)

    missing_scopes: list[str] = []
    if tool_calls_failed:
        missing_by_repo = get_out_of_date_github_permissions(organization, blocks)
        missing_scopes = sorted(
            {scope for info in missing_by_repo.values() for scope in info.missing_scopes}
        )

    return AiAutofixPrIterationDetailsCompletedEvent(
        organization_id=organization.id,
        project_id=group.project_id,
        group_id=group.id,
        run_id=run_id,
        consume_id=_iteration_consume_id(iteration),
        repository_id=repository_id,
        pull_request_id=pull_request_id,
        repository_provider=PR_ITERATION_PROVIDER_SLUG if repository_id is not None else None,
        referrer=referrer,
        enabled_flags=[
            flag for flag in PR_ITERATION_FLAGS if features.has(flag, organization=organization)
        ],
        iteration_index=iteration.index if iteration is not None else None,
        consecutive_automated_iterations=automated_iteration_streak(iterations),
        trigger_feedback_count=len(feedbacks),
        trigger_head_sha=_trigger_head_sha(feedbacks),
        feedback_first_received_at=first_received_at,
        feedback_last_received_at=last_received_at,
        outcome=outcome,
        failure_stage=failure_stage,
        run_status=state.status,
        result_head_sha=(
            pr_state.commit_sha if pr_state and outcome == "code_changes_pushed" else None
        ),
        files_changed=len(patches),
        lines_added=sum(patch.patch.added for patch in patches),
        lines_removed=sum(patch.patch.removed for patch in patches),
        has_workflow_patches=_patches_touch_workflows(patches),
        tool_calls_total=tool_calls_total,
        tool_calls_failed=tool_calls_failed,
        tool_calls_failed_by_name=json.dumps(failed_by_name),
        missing_permission_scopes=missing_scopes,
        push_error_code=_push_error_code(state, errored_repos),
    )


def _claim_details_emission(seer_run: SeerRun | None, key: str) -> bool:
    if seer_run is None:
        return True

    try:
        with record_run_extras(seer_run) as extras:
            emitted = dict(extras.get(DETAILS_EMITTED_EXTRA) or {})
            if key in emitted:
                return False
            emitted[key] = True
            extras[DETAILS_EMITTED_EXTRA] = emitted
    except SeerRun.DoesNotExist:
        return False
    return True


def emit_pr_iteration_details(
    *,
    organization: Organization,
    group: Group,
    run_id: int,
    state: SeerRunState,
    errored_repos: Sequence[str],
    referrer: str | None = None,
) -> bool:
    from sentry.seer.autofix.autofix_agent import get_iterations

    log_extra = {"run_id": run_id, "organization_id": organization.id}

    try:
        iterations = get_iterations(state)
    except Exception:
        logger.exception("autofix.pr_iteration.details.get_iterations_failed", extra=log_extra)
        return False

    iteration = iterations[-1] if iterations else None

    terminal = _terminal_outcome(state, iteration, errored_repos)
    if terminal is None:
        return False

    outcome, failure_stage = terminal

    seer_run = SeerRun.objects.filter(seer_run_state_id=run_id, organization=organization).first()
    iteration_index = iteration.index if iteration is not None else None
    consume_id = _iteration_consume_id(iteration)
    if not _claim_details_emission(seer_run, consume_id or str(iteration_index)):
        metrics.incr("autofix.pr_iteration.details.skipped", tags={"reason": "already_emitted"})
        return False

    row = build_pr_iteration_details_row(
        organization=organization,
        group=group,
        run_id=run_id,
        state=state,
        iteration=iteration,
        iterations=iterations,
        outcome=outcome,
        failure_stage=failure_stage,
        errored_repos=errored_repos,
        seer_run=seer_run,
        referrer=referrer,
    )
    analytics.record(row)
    metrics.incr("autofix.pr_iteration.details.recorded", tags={"outcome": outcome})
    logger.info(
        "autofix.pr_iteration.details.recorded",
        extra={
            **log_extra,
            "iteration_index": iteration_index,
            "consume_id": consume_id,
            "outcome": outcome,
        },
    )
    return True


def emit_pr_iteration_details_started(
    *,
    run_id: int,
    organization_id: int,
    group_id: int,
    consume_id: str,
    feedback: Feedback,
    referrer: str | None = None,
) -> bool:
    project_id = (
        Group.objects.filter(id=group_id, project__organization_id=organization_id)
        .values_list("project_id", flat=True)
        .first()
    )
    if project_id is None:
        logger.warning(
            "autofix.pr_iteration.details.started.group_not_found",
            extra={"run_id": run_id, "organization_id": organization_id, "group_id": group_id},
        )
        return False

    analytics.record(
        AiAutofixPrIterationDetailsStartedEvent(
            organization_id=organization_id,
            project_id=project_id,
            group_id=group_id,
            run_id=run_id,
            consume_id=consume_id,
            referrer=referrer,
            trigger_head_sha=_trigger_head_sha([feedback]),
            feedback_received_at=feedback.timestamp.isoformat(),
        )
    )
    metrics.incr("autofix.pr_iteration.details.started")
    logger.info(
        "autofix.pr_iteration.details.started",
        extra={"run_id": run_id, "organization_id": organization_id, "consume_id": consume_id},
    )
    return True


__all__ = (
    "build_pr_iteration_details_row",
    "emit_pr_iteration_details",
    "emit_pr_iteration_details_started",
)
