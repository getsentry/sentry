from __future__ import annotations

import logging
from collections.abc import Callable
from enum import StrEnum
from typing import TYPE_CHECKING

from django.utils import timezone
from pydantic import BaseModel

from sentry.seer.autofix.artifact_schemas import (
    ImpactAssessmentArtifact,
    RootCauseArtifact,
    SolutionArtifact,
    TriageArtifact,
)
from sentry.seer.autofix.prompts import (
    code_changes_prompt,
    impact_assessment_prompt,
    root_cause_prompt,
    solution_prompt,
    triage_prompt,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint, get_project_seer_preferences
from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.explorer.client_models import SeerRunState
from sentry.sentry_apps.tasks.sentry_apps import broadcast_webhooks_for_organization
from sentry.sentry_apps.utils.webhooks import SeerActionType

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.models.organization import Organization

logger = logging.getLogger(__name__)


class AutofixStep(StrEnum):
    """Available autofix steps."""

    ROOT_CAUSE = "root_cause"
    SOLUTION = "solution"
    CODE_CHANGES = "code_changes"
    IMPACT_ASSESSMENT = "impact_assessment"
    TRIAGE = "triage"


class StepConfig:
    """Configuration for an autofix step."""

    def __init__(
        self,
        artifact_schema: type[BaseModel] | None,
        prompt_fn: Callable[..., str],
        enable_coding: bool = False,
    ):
        self.artifact_schema = artifact_schema
        self.prompt_fn = prompt_fn
        self.enable_coding = enable_coding


# Step configurations mapping step to its artifact schema and prompt
STEP_CONFIGS: dict[AutofixStep, StepConfig] = {
    AutofixStep.ROOT_CAUSE: StepConfig(
        artifact_schema=RootCauseArtifact,
        prompt_fn=root_cause_prompt,
    ),
    AutofixStep.SOLUTION: StepConfig(
        artifact_schema=SolutionArtifact,
        prompt_fn=solution_prompt,
    ),
    AutofixStep.CODE_CHANGES: StepConfig(
        artifact_schema=None,  # Code changes read from file_patches
        prompt_fn=code_changes_prompt,
        enable_coding=True,
    ),
    AutofixStep.IMPACT_ASSESSMENT: StepConfig(
        artifact_schema=ImpactAssessmentArtifact,
        prompt_fn=impact_assessment_prompt,
    ),
    AutofixStep.TRIAGE: StepConfig(
        artifact_schema=TriageArtifact,
        prompt_fn=triage_prompt,
    ),
}


def build_step_prompt(step: AutofixStep, group: Group) -> str:
    """
    Build the prompt for a step using issue details.

    Args:
        step: The autofix step to build prompt for
        group: The Sentry group (issue) being analyzed

    Returns:
        Formatted prompt string
    """
    config = STEP_CONFIGS[step]
    return config.prompt_fn(
        short_id=group.qualified_short_id or str(group.id),
        title=group.title or "Unknown error",
        culprit=group.culprit or "unknown",
    )


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
        AutofixStep.IMPACT_ASSESSMENT: {
            False: SeerActionType.IMPACT_ASSESSMENT_STARTED,
            True: SeerActionType.IMPACT_ASSESSMENT_COMPLETED,
        },
        AutofixStep.TRIAGE: {
            False: SeerActionType.TRIAGE_STARTED,
            True: SeerActionType.TRIAGE_COMPLETED,
        },
    }
    return step_to_action_type[step][is_completed]


def trigger_autofix_explorer(
    group: Group,
    step: AutofixStep,
    run_id: int | None = None,
    stopping_point: AutofixStoppingPoint | None = None,
) -> int:
    """
    Start or continue an Explorer-based autofix run.

    Args:
        group: The Sentry group (issue) to analyze
        step: Which autofix step to run
        run_id: Existing run ID to continue, or None for new run
        stopping_point: Where to stop the automated pipeline (only used for new runs)

    Returns:
        The run ID
    """
    from sentry.seer.autofix.on_completion_hook import (
        AutofixOnCompletionHook,  # nested to avoid circular import
    )

    config = STEP_CONFIGS[step]
    client = SeerExplorerClient(
        organization=group.organization,
        user=None,  # No user personalization for autofix
        category_key="autofix",
        category_value=str(group.id),
        intelligence_level="high",
        on_completion_hook=AutofixOnCompletionHook,
        enable_coding=config.enable_coding,
    )

    prompt = build_step_prompt(step, group)

    if run_id is None:
        metadata = None
        if stopping_point:
            metadata = {"stopping_point": stopping_point.value, "group_id": group.id}
        run_id = client.start_run(
            prompt=prompt,
            artifact_key=step.value if config.artifact_schema else None,
            artifact_schema=config.artifact_schema,
            metadata=metadata,
        )
    else:
        client.continue_run(
            run_id=run_id,
            prompt=prompt,
            artifact_key=step.value if config.artifact_schema else None,
            artifact_schema=config.artifact_schema,
        )

    group.update(seer_autofix_last_triggered=timezone.now())

    # Send "started" webhook after we have the run_id
    webhook_action_type = get_step_webhook_action_type(step, is_completed=False)
    try:
        broadcast_webhooks_for_organization.delay(
            resource_name="seer",
            event_name=webhook_action_type.value,
            organization_id=group.organization.id,
            payload={"run_id": run_id},
        )
    except Exception:
        logger.exception(
            "autofix.trigger_webhook_failed",
            extra={
                "organization_id": group.organization.id,
                "webhook_event": webhook_action_type.value,
                "step": step.value,
                "run_id": run_id,
            },
        )

    return run_id


def get_autofix_explorer_state(organization: Organization, group_id: int):
    """
    Get the current state of an Explorer-based autofix run for a group.

    Args:
        organization: The organization
        group_id: The group ID to get state for

    Returns:
        SeerRunState if a run exists, None otherwise
    """
    client = SeerExplorerClient(
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
) -> str:
    """
    Generate a prompt for coding agents from autofix run state.

    Extracts root_cause and solution artifacts to create a comprehensive
    prompt for the coding agent.
    """
    parts = ["Please fix the following issue. Ensure that your fix is fully working."]

    if short_id:
        parts.append(f"Include 'Fixes {short_id}' in the pull request description.")

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


def trigger_coding_agent_handoff(
    group: Group,
    run_id: int,
    integration_id: int,
) -> dict[str, list]:
    """
    Trigger a coding agent handoff for an existing Explorer-based autofix run.

    This fetches the current run state, generates a prompt from artifacts
    (root cause, solution, file patches), and launches coding agents.

    Args:
        group: The Sentry group (issue)
        run_id: The existing Explorer run ID
        integration_id: The coding agent integration ID (e.g., Cursor)

    Returns:
        Dictionary with 'successes' and 'failures' lists
    """
    # Fetch project preferences for repos and auto_create_pr setting
    auto_create_pr = False
    repos: list[str] = []
    try:
        preference_response = get_project_seer_preferences(group.project_id)
        if preference_response and preference_response.preference:
            repos = [
                f"{repo.owner}/{repo.name}" for repo in preference_response.preference.repositories
            ]
            if preference_response.preference.automation_handoff:
                auto_create_pr = preference_response.preference.automation_handoff.auto_create_pr
    except Exception:
        logger.exception(
            "autofix.coding_agent_handoff.get_preferences_error",
            extra={
                "organization_id": group.organization.id,
                "run_id": run_id,
                "project_id": group.project_id,
            },
        )

    if not repos:
        return {
            "successes": [],
            "failures": [{"error_message": "No repositories configured in project preferences"}],
        }

    client = SeerExplorerClient(
        organization=group.organization,
        user=None,
        category_key="autofix",
        category_value=str(group.id),
    )
    state = client.get_run(run_id)

    short_id = None
    if auto_create_pr:
        short_id = group.qualified_short_id

    prompt = generate_autofix_handoff_prompt(state, short_id=short_id)

    return client.launch_coding_agents(
        run_id=run_id,
        integration_id=integration_id,
        prompt=prompt,
        repos=repos,
        branch_name_base=group.title or "seer",
        auto_create_pr=auto_create_pr,
    )
