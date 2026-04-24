from __future__ import annotations

import pydantic
import sentry_sdk

from sentry import options
from sentry.models.project import Project


class NightShiftTweaks(pydantic.BaseModel):
    enabled: bool = False
    candidate_issues: int = pydantic.Field(
        default_factory=lambda: options.get("seer.night_shift.issues_per_org")
    )


def get_night_shift_tweaks(project: Project) -> NightShiftTweaks:
    raw = project.get_option("sentry:seer_nightshift_tweaks")
    if not raw:
        return NightShiftTweaks()
    try:
        return NightShiftTweaks(**raw)
    except pydantic.ValidationError:
        sentry_sdk.capture_exception()
        return NightShiftTweaks()
