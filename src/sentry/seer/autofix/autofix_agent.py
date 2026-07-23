from __future__ import annotations

import logging
import re
from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal, cast

import sentry_sdk
from pydantic import BaseModel
from rest_framework.exceptions import PermissionDenied
from scm.types import GetBranchProtocol, GetRepositoryProtocol

from sentry import analytics, features, quotas
from sentry.analytics.events.autofix_events import (
    AiAutofixAgentHandoffEvent,
    AiAutofixCodeChangesCompletedEvent,
    AiAutofixCodeChangesStartedEvent,
    AiAutofixIterationCompletedEvent,
    AiAutofixIterationStartedEvent,
    AiAutofixPhaseEvent,
    AiAutofixPrCreatedStartedEvent,
    AiAutofixRootCauseCompletedEvent,
    AiAutofixRootCauseStartedEvent,
    AiAutofixSolutionCompletedEvent,
    AiAutofixSolutionStartedEvent,
)
from sentry.constants import ENABLE_SEER_CODING_DEFAULT, DataCategory
from sentry.integrations.services.integration import integration_service
from sentry.seer.agent.client import SeerAgentClient
from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.artifact_schemas import (
    RootCauseArtifact,
    SolutionArtifact,
)
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.pr_iteration.feedback import Feedback, serialize_feedback
from sentry.seer.autofix.prompts import (
    PromptBuilder,
    code_changes_prompt,
    pr_iteration_prompt,
    root_cause_prompt,
    solution_prompt,
)
from sentry.seer.autofix.types import AutofixHandoffResponse
from sentry.seer.autofix.utils import (
    AutofixStoppingPoint,
    read_preference_from_sentry_db,
)
from sentry.seer.entrypoints.operator import SeerAutofixOperator, process_autofix_updates
from sentry.seer.models import SeerRepoDefinition
from sentry.seer.models.run import SeerRun
from sentry.seer.models.seer_api_models import SeerPermissionError
from sentry.sentry_apps.event_types import SentryAppEventType
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.sentry_apps.utils.webhooks import SeerActionType
from sentry.utils import json, metrics

if TYPE_CHECKING:
    from django.contrib.auth.models import AnonymousUser

    from sentry.models.group import Group
    from sentry.models.organization import Organization
    from sentry.seer.agent.client_models import MemoryBlock
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser

logger = logging.getLogger(__name__)

UNKNOWN_RUN_ID_FOR_GROUP = "Unknown run id for group"


class NoSeerQuotaException(Exception):
    pass


class PrIterationNoPullRequestException(Exception):
    pass


class PrIterationNotEnabledException(Exception):
    pass


class AutofixStep(StrEnum):
    """Available autofix steps."""

    ROOT_CAUSE = "root_cause"
    SOLUTION = "solution"
    CODE_CHANGES = "code_changes"
    PR_ITERATION = "pr_iteration"

    @staticmethod
    def from_autofix_stopping_point(
        autofix_stopping_point: AutofixStoppingPoint,
    ) -> AutofixStep:
        match autofix_stopping_point:
            case AutofixStoppingPoint.ROOT_CAUSE:
                return AutofixStep.ROOT_CAUSE
            case AutofixStoppingPoint.SOLUTION:
                return AutofixStep.SOLUTION
            case AutofixStoppingPoint.CODE_CHANGES:
                return AutofixStep.CODE_CHANGES
            case AutofixStoppingPoint.OPEN_PR:
                # This depends on the last step being
                # code changes and we should look for
                # the PR elsewhere in the agent results
                return AutofixStep.CODE_CHANGES
            case _:
                raise ValueError(f"Unsupported AutofixStoppingPoint: {autofix_stopping_point}")


class StepConfig:
    """Configuration for an autofix step."""

    def __init__(
        self,
        artifact_schema: type[BaseModel] | None,
        prompt_fn: PromptBuilder,
        enable_coding: bool = False,
        reasoning_effort: Literal["low", "medium", "high"] | None = None,
        started_event: type[AiAutofixPhaseEvent] | None = None,
        completed_event: type[AiAutofixPhaseEvent] | None = None,
    ):
        self.artifact_schema = artifact_schema
        self.prompt_fn = prompt_fn
        self.enable_coding = enable_coding
        self.reasoning_effort = reasoning_effort
        self.started_event = started_event
        self.completed_event = completed_event


# Step configurations mapping step to its artifact schema and prompt
STEP_CONFIGS: dict[AutofixStep, StepConfig] = {
    AutofixStep.ROOT_CAUSE: StepConfig(
        artifact_schema=RootCauseArtifact,
        prompt_fn=root_cause_prompt,
        reasoning_effort="medium",
        started_event=AiAutofixRootCauseStartedEvent,
        completed_event=AiAutofixRootCauseCompletedEvent,
    ),
    AutofixStep.SOLUTION: StepConfig(
        artifact_schema=SolutionArtifact,
        prompt_fn=solution_prompt,
        started_event=AiAutofixSolutionStartedEvent,
        completed_event=AiAutofixSolutionCompletedEvent,
    ),
    AutofixStep.CODE_CHANGES: StepConfig(
        artifact_schema=None,  # Code changes read from file_patches
        prompt_fn=code_changes_prompt,
        enable_coding=True,
        started_event=AiAutofixCodeChangesStartedEvent,
        completed_event=AiAutofixCodeChangesCompletedEvent,
    ),
    AutofixStep.PR_ITERATION: StepConfig(
        artifact_schema=None,  # Iteration changes read from file_patches
        prompt_fn=pr_iteration_prompt,
        enable_coding=True,
        started_event=AiAutofixIterationStartedEvent,
        completed_event=AiAutofixIterationCompletedEvent,
    ),
}


def build_step_prompt(
    step: AutofixStep,
    group: Group,
    user_context: str | None = None,
    run_state: SeerRunState | None = None,
) -> str:
    """
    Build the prompt for a step using issue details.

    Args:
        step: The autofix step to build prompt for
        group: The Sentry group (issue) being analyzed
        run_state: The current run state, used to surface PR links for iteration

    Returns:
        Formatted prompt string
    """
    config = STEP_CONFIGS[step]
    prompt = config.prompt_fn(
        short_id=group.qualified_short_id or str(group.id),
        title=group.title or "Unknown error",
        culprit=group.culprit or "unknown",
        artifact_key=step.value,
        run_state=run_state,
    )

    parts = [prompt]

    user_context = user_context or ""
    user_context = user_context.strip()
    if user_context:
        parts.append("")
        parts.append("Use the following user context to aid your thinking")
        parts.append(user_context)

    return "\n".join(parts)


def get_step_webhook_action_type(step: AutofixStep, is_completed: bool) -> SeerActionType:
    step_to_action_type = {
        AutofixStep.ROOT_CAUSE: {
            False: SeerActionType.ROOT_CAUSE_STARTED,
            True: SeerActionType.ROOT_CAUSE_COMPLETED,
        },
        AutofixStep.SOLUTION: {
            False: SeerActionType.SOLUTION_STARTED,
            True: SeerActionType.SOLUTION_COMPLETED,
        },
        AutofixStep.CODE_CHANGES: {
            False: SeerActionType.CODING_STARTED,
            True: SeerActionType.CODING_COMPLETED,
        },
        AutofixStep.PR_ITERATION: {
            False: SeerActionType.ITERATION_STARTED,
            True: SeerActionType.ITERATION_COMPLETED,
        },
    }
    return step_to_action_type[step][is_completed]


@dataclass(frozen=True)
class Iteration:
    index: int
    start_index: int
    blocks: list[MemoryBlock]


def get_iterations(state: SeerRunState) -> list[Iteration]:
    """PR iterations in order, each holding its own blocks. A PR_ITERATION block
    opens an iteration; every following block belongs to it until the next
    PR_ITERATION block."""
    iterations: list[Iteration] = []
    for i, block in enumerate(state.blocks):
        metadata = block.message.metadata or {}

        if metadata.get("step") == AutofixStep.PR_ITERATION.value:
            iter_idx = metadata.get("iteration_index")
            assert iter_idx is not None, "PR_ITERATION block missing iteration_index"

            # PR_ITERATION is always started with feedback today (UI + consume
            # queue). Missing metadata is unexpected; report but keep going.
            raw_feedback = metadata.get("feedback")
            if not raw_feedback or (isinstance(raw_feedback, str) and not raw_feedback.strip()):
                sentry_sdk.capture_message(
                    "PR_ITERATION block missing feedback metadata",
                    level="warning",
                    extras={
                        "run_id": state.run_id,
                        "block_index": i,
                        "iteration_index": iter_idx,
                        "block_id": block.id,
                    },
                )

            iterations.append(Iteration(index=int(iter_idx), start_index=i, blocks=[block]))
        elif iterations:
            iterations[-1].blocks.append(block)

    return iterations


def get_latest_iteration_index(state: SeerRunState) -> int:
    try:
        iterations = get_iterations(state)
    except Exception:
        logger.exception("autofix.get_latest_iteration_index.failed")
        return 0
    return iterations[-1].index if iterations else 0


def get_iteration_for_insert_index(state: SeerRunState, insert_index: int) -> int:
    block = state.blocks[insert_index]
    metadata = block.message.metadata or {}
    return int(metadata["iteration_index"])


def get_autofix_agent_client(
    group: Group,
    intelligence_level: Literal["low", "medium", "high"] = "medium",
    reasoning_effort: Literal["low", "medium", "high"] | None = None,
    enable_coding: bool = False,
    code_review_enabled: bool = False,
    enable_bash_tools: bool = False,
    enable_pr_context_tools: bool = False,
    user: User | RpcUser | AnonymousUser | None = None,
) -> SeerAgentClient:
    from sentry.seer.autofix.on_completion_hook import (
        AutofixOnCompletionHook,  # nested to avoid circular import
    )

    return SeerAgentClient(
        organization=group.organization,
        project=group.project,
        group=group,
        user=user,
        category_key="autofix",
        category_value=str(group.id),
        intelligence_level=intelligence_level,
        reasoning_effort=reasoning_effort,
        on_completion_hook=AutofixOnCompletionHook,
        enable_coding=enable_coding,
        code_review_enabled=code_review_enabled,
        enable_bash_tools=enable_bash_tools,
        enable_pr_context_tools=enable_pr_context_tools,
    )


def get_autofix_run_state(group: Group, run_id: int) -> SeerRunState:
    client = get_autofix_agent_client(group)
    return _get_group_run_state(client, group, run_id)


def _validate_run_belongs_to_group(state: SeerRunState, group: Group) -> None:
    group_id = state.metadata.get("group_id") if state.metadata else None
    if group_id != group.id:
        raise SeerPermissionError(UNKNOWN_RUN_ID_FOR_GROUP)


def _get_group_run_state(client: SeerAgentClient, group: Group, run_id: int) -> SeerRunState:
    try:
        state = client.get_run(run_id)
    except ValueError:
        raise SeerPermissionError(UNKNOWN_RUN_ID_FOR_GROUP)

    _validate_run_belongs_to_group(state, group)
    return state


def _build_base_shas_metadata(group: Group, referrer: AutofixReferrer) -> str | None:
    preference = read_preference_from_sentry_db(group.project)
    # Imported lazily to avoid a circular import: sentry.scm pulls in the
    # github/slack integrations, which import notifications templates that
    # import back into sentry.seer.autofix.
    from sentry.scm import factory as scm_factory

    base_shas: dict[str, dict[str, str]] = {}
    for repo in preference.repositories:
        if repo.repository_id is None:
            continue

        full_name = f"{repo.owner}/{repo.name}"
        try:
            scm = scm_factory.new(group.organization.id, repo.repository_id, referrer.value)
            if repo.branch_name:
                base_branch: str | None = repo.branch_name
            elif isinstance(scm, GetRepositoryProtocol):
                base_branch = scm.get_repository()["data"]["default_branch"]
            else:
                continue
            if not base_branch:
                continue
            if not isinstance(scm, GetBranchProtocol):
                continue
            base_sha = scm.get_branch(base_branch)["data"]["sha"]
        except Exception:
            logger.exception(
                "autofix.base_shas.resolve_failed",
                extra={"repo": full_name, "group_id": group.id},
            )
            continue

        if base_sha:
            base_shas[full_name] = {"base_sha": base_sha, "base_branch": base_branch}

    if not base_shas:
        return None
    return json.dumps(base_shas)


def trigger_autofix_agent(
    group: Group,
    step: AutofixStep,
    referrer: AutofixReferrer,
    run_id: int | None = None,
    stopping_point: AutofixStoppingPoint | None = None,
    user_context: str | None = None,
    insert_index: int | None = None,
    feedback: Sequence[Feedback] | None = None,
    user: User | RpcUser | AnonymousUser | None = None,
    enable_bash_tools: bool = False,
) -> int:
    """
    Start or continue an agent-based autofix run.

    Args:
        group: The Sentry group (issue) to analyze
        step: Which autofix step to run
        run_id: Existing run ID to continue, or None for new run
        stopping_point: Where to stop the automated pipeline (only used for new runs)

    Returns:
        The run ID
    """
    # check billing quota for triggering a new autofix run
    if run_id is None:
        has_budget: bool = quotas.backend.check_seer_quota(
            org_id=group.organization.id,
            data_category=DataCategory.SEER_AUTOFIX,
        )
        if not has_budget:
            raise NoSeerQuotaException()

    config = STEP_CONFIGS[step]

    pr_iteration_enabled = features.has("organizations:autofix-pr-iteration", group.organization)
    is_iteration_step = step == AutofixStep.PR_ITERATION

    client = get_autofix_agent_client(
        group,
        enable_bash_tools=enable_bash_tools,
        enable_coding=config.enable_coding,
        enable_pr_context_tools=is_iteration_step,
        user=user,
    )

    run_state: SeerRunState | None = None
    if run_id is not None:
        run_state = _get_group_run_state(client, group, run_id)

    iteration_index: int | None = None
    if is_iteration_step:
        if not pr_iteration_enabled:
            raise PrIterationNotEnabledException()

        if run_state is None or not run_state.repo_pr_states:
            raise PrIterationNoPullRequestException()

        if insert_index is not None:
            iteration_index = get_iteration_for_insert_index(run_state, insert_index)
        else:
            iteration_index = get_latest_iteration_index(run_state) + 1

    prompt = build_step_prompt(step, group, user_context, run_state=run_state)
    prompt_metadata = {
        "step": step.value,
        "referrer": referrer.value,
        "has_user_context": "no" if user_context is None else "yes",
        "is_retry": "no" if insert_index is None else "yes",
    }
    feedback_items = list(feedback or [])
    if step == AutofixStep.PR_ITERATION and feedback_items:
        prompt_metadata["feedback"] = serialize_feedback(feedback_items)

    if iteration_index is not None:
        prompt_metadata["iteration_index"] = str(iteration_index)

    if step == AutofixStep.ROOT_CAUSE:
        base_shas = _build_base_shas_metadata(group, referrer)
        if base_shas:
            prompt_metadata["base_shas"] = base_shas

    artifact_key = step.value if config.artifact_schema else None
    artifact_schema = config.artifact_schema

    run: SeerRun | None = None
    if run_id is None:
        metadata: dict[str, Any] = {
            "group_id": group.id,
            "referrer": referrer.value,
        }
        if stopping_point:
            metadata["stopping_point"] = stopping_point.value
        run = client.start_run(
            prompt=prompt,
            prompt_metadata=prompt_metadata,
            artifact_key=artifact_key,
            artifact_schema=artifact_schema,
            metadata=metadata,
        )
        run_id = run.seer_run_state_id

        # Make sure to log billing event for seer autofix whenever a new run is started
        quotas.backend.record_seer_run(
            group.organization.id, group.project.id, DataCategory.SEER_AUTOFIX
        )
    else:
        client.continue_run(
            run_id=run_id,
            prompt=prompt,
            prompt_metadata=prompt_metadata,
            artifact_key=artifact_key,
            artifact_schema=artifact_schema,
            insert_index=insert_index,
        )

    if run is None:
        run = SeerRun.objects.filter(
            organization_id=group.organization.id,
            seer_run_state_id=run_id,
        ).first()

    # Emit the started event after run_id is resolved so it can be joined to
    # downstream completed/PR events.
    if config.started_event is not None:
        analytics.record(
            config.started_event(
                organization_id=group.organization.id,
                project_id=group.project_id,
                group_id=group.id,
                referrer=referrer.value,
                run_id=run_id,
                iteration_index=iteration_index,
            )
        )

    payload: dict[str, Any] = {
        "run_id": run_id,
        "sentry_run_id": str(run.uuid) if run is not None else None,
        "group_id": group.id,
    }
    if iteration_index is not None:
        payload["iteration_index"] = iteration_index

    webhook_action_type = get_step_webhook_action_type(step, is_completed=False)
    event_name = webhook_action_type.value

    event_type = f"seer.{event_name}"
    try:
        sentry_app_event_type = SentryAppEventType(event_type)
        if SeerAutofixOperator.has_access(organization=group.organization):
            process_autofix_updates.apply_async(
                kwargs={
                    "event_type": sentry_app_event_type,
                    "event_payload": payload,
                    "organization_id": group.organization.id,
                }
            )
    except ValueError:
        logger.exception(
            "autofix.trigger.webhook_invalid_event_type",
            extra={"event_type": event_type},
        )

    # Send "started" webhook after we have the run_id
    try:
        broadcast_webhooks_for_organization.delay(
            resource_name="seer",
            event_name=event_name,
            organization_id=group.organization.id,
            payload=payload,
        )
    except Exception:
        logger.exception(
            "autofix.trigger.webhook_failed",
            extra={
                "organization_id": group.organization.id,
                "webhook_event": event_name,
                "step": step.value,
                "run_id": run_id,
                "group_id": group.id,
                "iteration_index": iteration_index,
            },
        )

    metrics.incr(
        "autofix.explorer.trigger",
        tags={
            "step": step.value,
            "referrer": referrer.value,
            "iteration_index": iteration_index,
        },
    )

    return run_id


def get_autofix_agent_state(organization: Organization, group_id: int):
    """
    Get the current state of an agent-based autofix run for a group.

    Args:
        organization: The organization
        group_id: The group ID to get state for

    Returns:
        SeerRunState if a run exists, None otherwise
    """
    client = SeerAgentClient(
        organization=organization,
        user=None,
        category_key="autofix",
        category_value=str(group_id),
    )

    runs = client.get_runs(category_key="autofix", category_value=str(group_id))
    if not runs:
        return None

    # Return the most recent run's state
    return client.get_run(runs[0].run_id)


def generate_autofix_handoff_prompt(
    state: SeerRunState,
    instruction: str | None = None,
    short_id: str | None = None,
    issue_url: str | None = None,
) -> str:
    """
    Generate a prompt for coding agents from autofix run state.

    Extracts root_cause and solution artifacts to create a comprehensive
    prompt for the coding agent.
    """
    parts = ["Please fix the following issue. Ensure that your fix is fully working."]

    if short_id:
        if issue_url:
            parts.append(
                f"Include 'Fixes [{short_id}]({issue_url})' in the commit message and PR description."
            )
        else:
            parts.append(f"Include 'Fixes {short_id}' in the commit message.")

    if instruction and instruction.strip():
        parts.append(instruction.strip())

    artifacts = state.get_artifacts()

    # Add root cause if present
    root_cause = artifacts.get("root_cause")
    if root_cause and root_cause.data:
        parts.append("## Root Cause Analysis")
        if "one_line_description" in root_cause.data:
            parts.append(root_cause.data["one_line_description"])
        if "five_whys" in root_cause.data:
            for i, why in enumerate(root_cause.data["five_whys"], 1):
                parts.append(f"{i}. {why}")
        if "reproduction_steps" in root_cause.data:
            for step in root_cause.data["reproduction_steps"]:
                parts.append(f"- {step}")

    # Add solution if present
    solution = artifacts.get("solution")
    if solution and solution.data:
        parts.append("## Proposed Solution")
        if "one_line_summary" in solution.data:
            parts.append(solution.data["one_line_summary"])
        if "steps" in solution.data:
            for step in solution.data["steps"]:
                if isinstance(step, dict):
                    title = step.get("title", "")
                    desc = step.get("description", "")
                    parts.append(f"- **{title}**: {desc}")

    return "\n\n".join(parts)


def _get_relevant_repo(
    state: SeerRunState,
    repo_definitions: list[SeerRepoDefinition],
    run_id: int,
    group: Group,
) -> SeerRepoDefinition:
    root_cause_artifact = state.get_artifacts().get("root_cause")
    relevant_repo: str | None = (
        (root_cause_artifact.data or {}).get("relevant_repo") if root_cause_artifact else None
    )
    warning_extras = {
        "organization_id": group.organization.id,
        "run_id": run_id,
        "project_id": group.project_id,
    }
    if relevant_repo:
        match = next((r for r in repo_definitions if f"{r.owner}/{r.name}" == relevant_repo), None)
        if match:
            return match
        logger.warning(
            "autofix.coding_agent_handoff.relevant_repo_not_found",
            extra={**warning_extras, "relevant_repo": relevant_repo},
        )
    else:
        logger.warning(
            "autofix.coding_agent_handoff.no_relevant_repo",
            extra=warning_extras,
        )
    return repo_definitions[0]


def _resolve_coding_agent_name(
    organization_id: int, integration_id: int | None, provider: str | None
) -> str | None:
    """Resolve a human-readable coding agent name for analytics."""
    if provider:
        return provider
    if integration_id is not None:
        try:
            integration = integration_service.get_integration(
                integration_id=integration_id,
            )
            if integration:
                return integration.provider
        except Exception:
            logger.exception(
                "autofix.resolve_coding_agent_name.error",
                extra={
                    "organization_id": organization_id,
                    "integration_id": integration_id,
                },
            )
    return None


def trigger_coding_agent_handoff(
    group: Group,
    run_id: int,
    referrer: AutofixReferrer,
    integration_id: int | None = None,
    provider: str | None = None,
    user_id: int | None = None,
    auto_create_pr: bool | None = None,
) -> AutofixHandoffResponse:
    """
    Trigger a coding agent handoff for an existing agent-based autofix run.

    This fetches the current run state, generates a prompt from artifacts
    (root cause, solution, file patches), and launches coding agents.

    Args:
        group: The Sentry group (issue)
        run_id: The existing agent run ID
        integration_id: The coding agent integration ID (e.g., Cursor)
        provider: The coding agent provider (e.g., 'github_copilot') - alternative to integration_id
        user_id: The user ID (required for user-authenticated providers like GitHub Copilot)
        auto_create_pr: Optional override for whether the coding agent should create a PR

    Returns:
        Dictionary with 'successes' and 'failures' lists
    """
    if not group.organization.get_option(
        "sentry:enable_seer_coding", default=ENABLE_SEER_CODING_DEFAULT
    ):
        raise PermissionDenied("Code generation is disabled for this organization")

    preference = read_preference_from_sentry_db(group.project)
    repo_definitions: list[SeerRepoDefinition] = preference.repositories
    if auto_create_pr is None:
        auto_create_pr = False
        if preference.automation_handoff:
            auto_create_pr = preference.automation_handoff.auto_create_pr

    if not repo_definitions:
        return {
            "successes": [],
            "failures": [{"error_message": "No repositories configured in project preferences"}],
        }

    client = get_autofix_agent_client(group)
    state = _get_group_run_state(client, group, run_id)

    repo = _get_relevant_repo(state, repo_definitions, run_id, group)

    short_id = group.qualified_short_id
    issue_url = group.get_absolute_url() if short_id else None

    prompt = generate_autofix_handoff_prompt(state, short_id=short_id, issue_url=issue_url)

    coding_agents = client.launch_coding_agents(
        run_id=run_id,
        integration_id=integration_id,
        provider=provider,
        user_id=user_id,
        prompt=prompt,
        repos=[repo],
        branch_name_base=group.title or "seer",
        auto_create_pr=auto_create_pr,
        issue_short_id=short_id,
        issue_url=issue_url,
    )

    coding_agent_name = _resolve_coding_agent_name(group.organization.id, integration_id, provider)

    analytics.record(
        AiAutofixAgentHandoffEvent(
            organization_id=group.organization.id,
            project_id=group.project_id,
            group_id=group.id,
            referrer=referrer.value,
            run_id=run_id,
            coding_agent=coding_agent_name,
        )
    )

    metrics.incr(
        "autofix.explorer.trigger",
        tags={
            "step": "coding_agent_handoff",
            "referrer": referrer.value,
            "coding_agent": coding_agent_name or "unknown",
        },
    )

    # cast() sanctioned: `client.launch_coding_agents` returns loose
    # dict[str, list]; the runtime shape is the `{successes, failures}`
    # envelope captured by AutofixHandoffResponse.
    return cast(AutofixHandoffResponse, coding_agents)


def trigger_push_changes(
    group: Group,
    run_id: int,
    referrer: AutofixReferrer,
    state: SeerRunState | None = None,
    repo_name: str | None = None,
    ready_for_review: bool = True,
):
    if not group.organization.get_option(
        "sentry:enable_seer_coding", default=ENABLE_SEER_CODING_DEFAULT
    ):
        raise PermissionDenied("Code generation is disabled for this organization")

    client = get_autofix_agent_client(group)

    if state is None:
        state = _get_group_run_state(client, group, run_id)
    else:
        _validate_run_belongs_to_group(state, group)

    analytics.record(
        AiAutofixPrCreatedStartedEvent(
            organization_id=group.organization.id,
            project_id=group.project_id,
            group_id=group.id,
            referrer=referrer.value,
            run_id=run_id,
        )
    )

    client.push_changes(
        run_id,
        repo_name=repo_name,
        pr_description_suffix=build_pr_description_suffix(group),
        ready_for_review=ready_for_review,
        blocking=False,
    )

    metrics.incr(
        "autofix.explorer.trigger",
        tags={"step": "open_pr", "referrer": referrer.value},
    )


def build_pr_description_suffix(group: Group) -> str | None:
    lines = []

    if group.qualified_short_id:
        issue_url = group.get_absolute_url(params={"seerDrawer": "true"})
        lines.append(f"Fixes [{group.qualified_short_id}]({issue_url})")

    for external_issue in PlatformExternalIssue.objects.filter(group_id=group.id):
        if external_issue.service_type == "linear":
            is_valid = bool(re.match(r"^[A-Z0-9]+#\d+$", external_issue.display_name))
            if not is_valid:
                logger.warning(
                    "autofix.linear.unknown-id",
                    extra={
                        "group": group.id,
                        "project": group.project_id,
                        "linear_id": external_issue.display_name,
                    },
                )
                continue
            linear_id = external_issue.display_name.replace("#", "-")
            lines.append(f"Fixes [{linear_id}]({external_issue.web_url})")

    if features.has("organizations:autofix-pr-iteration", group.organization):
        lines.append(
            "\n<sub>Comment `@sentry <feedback>` on this PR to have Autofix iterate on the changes.</sub>"
        )

    if lines:
        return "\n".join(lines)

    return None
