"""Wire types for the night_shift feature, in sync with Seer's
seer.automation.features.night_shift.feature. Covers both the request payload
(Sentry -> Seer) and the result payload (Seer -> Sentry)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from sentry.tasks.seer.night_shift.models import TriageAction


class _Base(BaseModel):
    class Config:
        extra = "ignore"


# Request payload (Sentry -> Seer): the `payload` block of the feature run.


class TriageCandidate(_Base):
    group_id: int
    title: str
    culprit: str | None = None
    fixability: float | None = None
    times_seen: int
    first_seen: str  # ISO 8601; Seer parses it back to a datetime.
    priority: str | None = None


class TriageTweaks(_Base):
    intelligence_level: Literal["low", "medium", "high"] = "medium"
    reasoning_effort: Literal["low", "medium", "high"] | None = None
    extra_triage_instructions: str = ""


class NightShiftPayload(_Base):
    candidates: list[TriageCandidate]
    tweaks: TriageTweaks


# Result payload (Seer -> Sentry): the triage verdicts pushed back.


class TriageVerdict(_Base):
    group_id: int
    action: TriageAction
    reason: str = ""


class TriageResponse(_Base):
    verdicts: list[TriageVerdict]
