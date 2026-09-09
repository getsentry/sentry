from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from sentry.seer.agent.on_completion_hook import OnCompletionHookDefinition
from sentry.seer.autofix.steps import AutofixStep

# Keep models in sync with src/seer/automation/features/autofix/models.py in Seer

FEATURE_ID = "autofix"
# In-flight runs started before the rename still deliver and persist this id.
LEGACY_FEATURE_ID = "autofix_rca"


class AutofixStepArgs(BaseModel):
    class Config:
        extra = "ignore"

    run_id: int | None = None
    insert_index: int | None = None
    intelligence_level: Literal["low", "medium", "high"] = "medium"
    reasoning_effort: Literal["low", "medium", "high"] | None = "medium"
    user_context: str | None = None


class AutofixPayload(BaseModel):
    class Config:
        extra = "ignore"

    group_id: int
    short_id: str
    title: str
    culprit: str
    on_completion_hook: OnCompletionHookDefinition
    step: AutofixStep
    args: AutofixStepArgs
