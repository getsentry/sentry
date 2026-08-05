from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# Keep models in sync with src/seer/automation/features/autofix_rca/models.py in Seer

FEATURE_ID = "autofix_rca"


class AutofixRCATweaks(BaseModel):
    class Config:
        extra = "ignore"

    intelligence_level: Literal["low", "medium", "high"] = "medium"
    reasoning_effort: Literal["low", "medium", "high"] | None = "medium"
    # Free-form context a user attached to the issue
    user_context: str | None = None


class AutofixRCAPayload(BaseModel):
    class Config:
        extra = "ignore"

    group_id: int
    short_id: str
    title: str
    culprit: str
    tweaks: AutofixRCATweaks = Field(default_factory=AutofixRCATweaks)
