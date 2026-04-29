from __future__ import annotations

from typing import Literal

import pydantic
import sentry_sdk

from sentry import options
from sentry.api.serializers.rest_framework.base import snake_to_camel_case
from sentry.models.project import Project

IntelligenceLevel = Literal["low", "medium", "high"]
ReasoningEffort = Literal["low", "medium", "high"]

# Defaults shared by the Tweaks model and SeerNightShiftRunOptions. Keep the
# frontend constants in `static/gsApp/views/seerAutomation/components/projectDetails/nightShift.tsx`
# in sync with these.
DEFAULT_INTELLIGENCE_LEVEL: IntelligenceLevel = "high"
DEFAULT_REASONING_EFFORT: ReasoningEffort = "high"
DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS = ""


def default_max_candidates() -> int:
    return options.get("seer.night_shift.issues_per_org")


class NightShiftTweaks(pydantic.BaseModel):
    # Global settings — apply to scheduled (cron) runs as well as manual ones.
    enabled: bool = False
    # Manual-run-only settings — read by the manual trigger endpoint and
    # forwarded into SeerNightShiftRunOptions; cron runs use the shared
    # defaults instead.
    max_candidates: int = pydantic.Field(default_factory=default_max_candidates)
    extra_triage_instructions: str = DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS
    intelligence_level: IntelligenceLevel = DEFAULT_INTELLIGENCE_LEVEL
    reasoning_effort: ReasoningEffort = DEFAULT_REASONING_EFFORT

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
