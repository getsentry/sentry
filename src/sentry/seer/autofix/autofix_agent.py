from __future__ import annotations

from collections.abc import Callable
from enum import StrEnum
from typing import TYPE_CHECKING

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
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.explorer.client import SeerExplorerClient

if TYPE_CHECKING:
    from sentry.models.group import Group
    from sentry.models.organization import Organization


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
        on_completion_hook=AutofixOnCompletionHook,
        enable_coding=config.enable_coding,
    )

    prompt = build_step_prompt(step, group)

    if run_id is None:
        metadata = None
        if stopping_point:
            metadata = {"stopping_point": stopping_point.value, "group_id": group.id}
        return client.start_run(
            prompt=prompt,
            artifact_key=step.value if config.artifact_schema else None,
            artifact_schema=config.artifact_schema,
            metadata=metadata,
        )
    else:
        return client.continue_run(
            run_id=run_id,
            prompt=prompt,
            artifact_key=step.value if config.artifact_schema else None,
            artifact_schema=config.artifact_schema,
        )


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
