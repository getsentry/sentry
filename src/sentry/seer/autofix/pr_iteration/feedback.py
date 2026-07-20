from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Annotated, Any

from django.utils import timezone
from pydantic import BaseModel, Field, ValidationError, parse_raw_as, root_validator

from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.utils import json

FeedbackSource = Annotated[
    UserUIFeedbackSource
    | GithubPrCommentFeedbackSource
    | GithubPrReviewCommentFeedbackSource
    | CheckSuiteFeedbackSource,
    Field(discriminator="type"),
]


class Feedback(BaseModel):
    source: FeedbackSource
    timestamp: datetime = Field(default_factory=timezone.now)
    text: str = ""
    ui_text: str = ""

    @root_validator
    def _populate(cls, values: dict[str, Any]) -> dict[str, Any]:
        source = values.get("source")
        if source is None:
            return values
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
