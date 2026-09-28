from __future__ import annotations

from typing import Literal

import pydantic
import sentry_sdk

from sentry import options
from sentry.api.serializers.rest_framework.base import snake_to_camel_case
from sentry.models.project import Project

IntelligenceLevel = Literal["low", "medium", "high"]
ReasoningEffort = Literal["low", "medium", "high"]

# Defaults shared by the Tweaks model and SeerAgenticTriageRunOptions. Keep the
# frontend constants in `static/gsApp/views/seerAutomation/components/projectDetails/nightShift.tsx`
# in sync with these.
DEFAULT_INTELLIGENCE_LEVEL: IntelligenceLevel = "medium"
DEFAULT_REASONING_EFFORT: ReasoningEffort = "medium"
DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS = ""


def default_max_candidates() -> int:
    return options.get("seer.night_shift.issues_per_org")


class AgenticTriageTweaks(pydantic.BaseModel):
    # Global settings — apply to scheduled (cron) runs as well as manual ones.
    enabled: bool = True
    # Manual-run-only settings — read by the manual trigger endpoint and
    # forwarded into SeerAgenticTriageRunOptions; cron runs use the shared
    # defaults instead.
    max_candidates: int = pydantic.Field(default_factory=default_max_candidates)
    extra_triage_instructions: str = DEFAULT_EXTRA_TRIAGE_INSTRUCTIONS
    intelligence_level: IntelligenceLevel = DEFAULT_INTELLIGENCE_LEVEL
    reasoning_effort: ReasoningEffort = DEFAULT_REASONING_EFFORT
    allowed_project_slugs: list[str] | None = None

    class Config:
        alias_generator = snake_to_camel_case
        allow_population_by_field_name = True


def _parse_tweaks(raw: object, source: str) -> AgenticTriageTweaks | None:
    """Parse a raw tweaks payload into AgenticTriageTweaks, or None if it is
    malformed (reported to Sentry). `source` labels the option in the report."""
    if not isinstance(raw, dict):
        sentry_sdk.capture_exception(
            TypeError(f"{source} must be a dict, got {type(raw).__name__}")
        )
        return None
    try:
        return AgenticTriageTweaks(**raw)
    except pydantic.ValidationError:
        sentry_sdk.capture_exception()
        return None


def get_agentic_triage_tweaks(project: Project) -> AgenticTriageTweaks:
    """Per-project tweaks from the `sentry:seer_nightshift_tweaks` option.
    Falls back to all-default tweaks when unset or malformed."""
    raw = project.get_option("sentry:seer_nightshift_tweaks")
    if not raw:
        return AgenticTriageTweaks()
    return _parse_tweaks(raw, "sentry:seer_nightshift_tweaks") or AgenticTriageTweaks()


def get_agentic_triage_org_tweaks(organization_id: int) -> AgenticTriageTweaks | None:
    """Per-org overrides from the `seer.night_shift.org_tweaks` option, a dict
    keyed by stringified organization id. Each value is a partial
    `AgenticTriageTweaks` payload (e.g. {"max_candidates": 20}); unset fields fall
    back to the same global defaults `AgenticTriageTweaks` uses. Returns None when
    nothing is configured for the org. Malformed entries are reported to Sentry
    and treated as absent."""
    org_tweaks = options.get("seer.night_shift.org_tweaks")
    if not isinstance(org_tweaks, dict):
        return None
    raw = org_tweaks.get(str(organization_id))
    if raw is None:
        return None
    return _parse_tweaks(raw, f"seer.night_shift.org_tweaks[{organization_id}]")
