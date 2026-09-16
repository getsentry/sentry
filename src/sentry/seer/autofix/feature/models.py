from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from sentry.seer.agent.on_completion_hook import OnCompletionHookDefinition
from sentry.seer.autofix.steps import AutofixStep

# Keep models in sync with src/seer/automation/features/autofix/models.py in Seer

FEATURE_ID = "autofix"
# In-flight runs started before the rename still deliver and persist this id.
LEGACY_FEATURE_ID = "autofix_rca"


class RepoPin(BaseModel):
    class Config:
        extra = "forbid"

    sha: str
    branch: str | None = None
    # Deprecated: this is the same as sha, but poorly named.
    base_sha: str
    # Deprecated: this is the same as branch, but poorly named.
    base_branch: str | None = None


RepoPins = dict[str, RepoPin]


class RCAStepArgs(BaseModel):
    """RCA-specific arguments for the generic Autofix feature payload."""

    class Config:
        extra = "ignore"

    intelligence_level: Literal["low", "medium", "high"] = "medium"
    reasoning_effort: Literal["low", "medium", "high"] = "medium"
    repo_pins: RepoPins | None = None


class AutofixFeaturePayload(BaseModel):
    class Config:
        extra = "ignore"

    # Universal params across all steps
    group_id: int
    project_id: int
    short_id: str
    title: str
    culprit: str
    on_completion_hook: OnCompletionHookDefinition
    step: AutofixStep
    step_args: RCAStepArgs | None = None
    existing_run_id: int | None = None
    insert_index: int | None = None
    # Not to be confused with user_org_context, this is free-form context added by the user.
    user_context: str | None = None
    stopping_point: str | None = None
