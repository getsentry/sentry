from __future__ import annotations

from typing import Any, Literal, Self

from pydantic import BaseModel, Field

from sentry.seer.agent.on_completion_hook import OnCompletionHookDefinition

# Keep models in sync with src/seer/automation/features/autofix/models.py in Seer

FEATURE_ID = "autofix"
# In-flight runs started before the rename still deliver and persist this id.
LEGACY_FEATURE_ID = "autofix_rca"


class AutofixRCATweaks(BaseModel):
    class Config:
        extra = "ignore"

    intelligence_level: Literal["low", "medium", "high"] = "medium"
    reasoning_effort: Literal["low", "medium", "high"] | None = "medium"
    # Not to be confused with user_org_context, this is free-form context added by the user to the rca run.
    user_context: str | None = None


class RepoPin(BaseModel):
    class Config:
        extra = "forbid"

    sha: str
    branch: str

    @classmethod
    def parse_obj(cls, obj: Any) -> Self:
        # Allow "base_sha" as alias for "sha" and "base_branch" as alias for "branch"
        if "base_sha" in obj and "sha" not in obj:
            obj = dict(obj)
            obj["sha"] = obj.pop("base_sha")
        if "base_branch" in obj and "branch" not in obj:
            obj = dict(obj)
            obj["branch"] = obj.pop("base_branch")
        return super().parse_obj(obj)


RepoPins = dict[str, RepoPin]


class AutofixRCAPayload(BaseModel):
    class Config:
        extra = "ignore"

    group_id: int
    project_id: int
    short_id: str
    title: str
    culprit: str
    on_completion_hook: OnCompletionHookDefinition
    repo_pins: RepoPins | None = None
    tweaks: AutofixRCATweaks = Field(default_factory=AutofixRCATweaks)
