from __future__ import annotations

from typing import Literal

import pydantic
import sentry_sdk

from sentry import options
from sentry.api.serializers.rest_framework.base import snake_to_camel_case
from sentry.models.project import Project

TriageStrategy = Literal["simple", "agentic"]
IntelligenceLevel = Literal["low", "medium", "high"]
ReasoningEffort = Literal["low", "medium", "high"]


class NightShiftTweaks(pydantic.BaseModel):
    enabled: bool = False
    dry_run: bool = False
    candidate_issues: int = pydantic.Field(
        default_factory=lambda: options.get("seer.night_shift.issues_per_org")
    )
    triage_strategy: TriageStrategy = "agentic"
    extra_triage_instructions: str = ""
    intelligence_level: IntelligenceLevel = "high"
    reasoning_effort: ReasoningEffort = "high"
    issue_fetch_limit: int = 100

    class Config:
        alias_generator = snake_to_camel_case
        allow_population_by_field_name = True


def get_night_shift_tweaks(project: Project) -> NightShiftTweaks:
    raw = project.get_option("sentry:seer_nightshift_tweaks")
    if not raw:
        return NightShiftTweaks()
    if not isinstance(raw, dict):
        sentry_sdk.capture_exception(
            TypeError(f"sentry:seer_nightshift_tweaks must be a dict, got {type(raw).__name__}")
        )
        return NightShiftTweaks()
    try:
        return NightShiftTweaks(**raw)
    except pydantic.ValidationError:
        sentry_sdk.capture_exception()
        return NightShiftTweaks()
