from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Annotated, Any

from django.utils import timezone
from pydantic import BaseModel, Field, ValidationError, root_validator

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

_PARSE_FEEDBACK_ERRORS = (ValidationError, ValueError)


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


def _parse_feedback_item(data: object) -> Feedback | None:
    try:
        return Feedback.parse_obj(data)
    except _PARSE_FEEDBACK_ERRORS:
        return None


def parse_feedback(raw: str) -> list[Feedback]:
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return []

    if isinstance(data, list):
        # Parse item-by-item so one bad element cannot erase sibling
        # comment/UI feedback in the same metadata blob.
        return [
            item for item in (_parse_feedback_item(entry) for entry in data) if item is not None
        ]

    item = _parse_feedback_item(data)
    return [item] if item is not None else []


def serialize_feedback(items: Sequence[Feedback]) -> str:
    return json.dumps([item.dict() for item in items])
