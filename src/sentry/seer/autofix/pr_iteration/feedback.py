from __future__ import annotations

import logging
from collections.abc import Sequence
from datetime import datetime
from typing import Annotated, Any

import sentry_sdk
from django.utils import timezone
from pydantic import BaseModel, Field, ValidationError, parse_raw_as, root_validator

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


def parse_feedback(raw: str) -> list[Feedback]:
    try:
        return parse_raw_as(list[Feedback], raw)
    except MissingCheckSuiteAutofixRun as e:
        # History / stored feedback that no longer resolves — drop loudly.
        logger.exception("autofix.pr_iteration.parse_feedback.missing_autofix_run")
        sentry_sdk.capture_exception(e)
        return []
    except _PARSE_FEEDBACK_ERRORS:
        pass
    try:
        return [parse_raw_as(Feedback, raw)]
    except MissingCheckSuiteAutofixRun as e:
        logger.exception("autofix.pr_iteration.parse_feedback.missing_autofix_run")
        sentry_sdk.capture_exception(e)
        return []
    except _PARSE_FEEDBACK_ERRORS:
        return []


def serialize_feedback(items: Sequence[Feedback]) -> str:
    return json.dumps([item.dict() for item in items])
