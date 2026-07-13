from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Annotated, Any

from django.utils import timezone
from pydantic import BaseModel, Field, ValidationError, parse_raw_as, root_validator

from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.utils import json

FeedbackSource = Annotated[
    UserUIFeedbackSource | GithubPrCommentFeedbackSource | GithubPrReviewCommentFeedbackSource,
    Field(discriminator="type"),
]


class Feedback(BaseModel):
    source: FeedbackSource
    timestamp: datetime = Field(default_factory=timezone.now)
    # `text` (verbatim prompt text) and `ui_text` (UI display) are derived from
    # `source` by `_populate`. They are declared as real fields, not properties,
    # so pydantic serializes them via .dict()/.json() at every nesting level —
    # the frontend and Seer prompt metadata read them off the wire.
    text: str = ""
    ui_text: str = ""

    @root_validator
    def _populate(cls, values: dict[str, Any]) -> dict[str, Any]:
        source = values.get("source")
        if source is None:
            return values
        # Backwards compat: feedback serialized before sources produced their own
        # text stored it at the top level, and those sources lack the fields this
        # derivation needs (e.g. user-ui had no `user_feedback`), so `source.text`
        # comes back empty. Fall back to the persisted top-level value so old
        # run_state blocks in Seer keep rendering. Seer's run_state TTL is nominally
        # 30 days, but a continuously-triggered run can retain old blocks
        # indefinitely, so this fallback is permanent.
        values["text"] = source.text or values.get("text") or ""
        values["ui_text"] = (
            source.ui_text or source.text or values.get("ui_text") or values.get("text") or ""
        )
        return values


def parse_feedback(raw: str) -> list[Feedback]:
    try:
        return parse_raw_as(list[Feedback], raw)
    except (ValidationError, ValueError):
        pass
    try:
        return [parse_raw_as(Feedback, raw)]
    except (ValidationError, ValueError):
        return []


def serialize_feedback(items: Sequence[Feedback]) -> str:
    return json.dumps([item.dict() for item in items])
