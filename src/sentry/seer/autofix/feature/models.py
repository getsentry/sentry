from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from sentry.seer.agent.on_completion_hook import OnCompletionHookDefinition
from sentry.seer.autofix.steps import AutofixStep

# Keep models in sync with src/seer/automation/features/autofix/models.py in Seer

FEATURE_ID = "autofix"
# In-flight runs started before the rename still deliver and persist this id.
LEGACY_FEATURE_ID = "autofix_rca"


class AutofixRCATweaks(BaseModel):
    """Deprecated RCA arguments retained until Seer reads step_args."""

    class Config:
        extra = "ignore"

    intelligence_level: Literal["low", "medium", "high"] = "medium"
    reasoning_effort: Literal["low", "medium", "high"] | None = "medium"
    # Not to be confused with user_org_context, this is free-form context added by the user.
    user_context: str | None = None


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
    reasoning_effort: Literal["low", "medium", "high"] | None = "medium"
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

    # Deprecated: the current Seer feature still reads these RCA-only fields.
    # Keep them in sync with step_args until Seer accepts the step_args.
    repo_pins: RepoPins | None = None
    tweaks: AutofixRCATweaks = Field(default_factory=AutofixRCATweaks)

    step: AutofixStep = AutofixStep.ROOT_CAUSE
    step_args: RCAStepArgs
    # Not to be confused with user_org_context, this is free-form context added by the user.
    user_context: str | None = None
    stopping_point: str | None = None
