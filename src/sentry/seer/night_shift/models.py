"""Wire types for the night_shift feature result payload from Seer."""

from __future__ import annotations

from pydantic import BaseModel

from sentry.tasks.seer.night_shift.models import TriageAction


class _Base(BaseModel):
    class Config:
        extra = "ignore"


class TriageVerdict(_Base):
    group_id: int
    action: TriageAction
    reason: str = ""


class TriageResponse(_Base):
    verdicts: list[TriageVerdict]
