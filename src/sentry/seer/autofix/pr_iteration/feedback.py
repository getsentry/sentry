from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime
from typing import Annotated, Any

import sentry_sdk
from django.utils import timezone
from pydantic import BaseModel, Field, ValidationError, root_validator

from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import (
    CheckSuiteFeedbackSource,
    MissingCheckSuiteAutofixRun,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.utils import json

logger = logging.getLogger(__name__)

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
    except MissingCheckSuiteAutofixRun as e:
        # Re-parse of a stored check-suite item failed (e.g. Autofix run gone).
        # Warn, drop this item, pretend it was never in the list.
        logger.warning(
            "autofix.pr_iteration.parse_feedback.missing_autofix_run",
            exc_info=True,
        )
        sentry_sdk.capture_exception(e)
        return None
    except _PARSE_FEEDBACK_ERRORS:
        return None


def parse_feedback(raw: str) -> list[Feedback]:
    try:
        data = json.loads(raw)
    except (TypeError, ValueError):
        return []

    if isinstance(data, list):
        # Parse item-by-item so one bad element (e.g. unresolvable check-suite)
        # cannot erase sibling comment/UI feedback in the same metadata blob.
        return [
            item for item in (_parse_feedback_item(entry) for entry in data) if item is not None
        ]

    item = _parse_feedback_item(data)
    return [item] if item is not None else []


def serialize_feedback(items: Sequence[Feedback]) -> str:
    return json.dumps([item.dict() for item in items])
