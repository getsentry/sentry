from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Annotated, Any

from django.utils import timezone
from pydantic import BaseModel, Field, ValidationError, root_validator

from sentry import options
from sentry.seer.agent.client_models import MemoryBlock, SeerRunState
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.utils import json

FeedbackSource = Annotated[
    UserUIFeedbackSource
    | GithubPrCommentFeedbackSource
    | GithubPrReviewCommentFeedbackSource
    | GithubPrReviewBodyFeedbackSource
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


def iteration_is_automated(iteration_blocks: Sequence[MemoryBlock]) -> bool:
    """Whether a PR iteration was driven *only* by automated feedback.

    A human comment or UI feedback mixed into an iteration makes it human-driven
    (and resets the streak); an iteration is automated only when every feedback
    item in it is automated (see ``FeedbackSourceBase.is_automated``).
    """
    feedbacks = [
        feedback
        for block in iteration_blocks
        for feedback in parse_feedback((block.message.metadata or {}).get("feedback", ""))
    ]
    # An iteration with no parseable feedback isn't a human iteration, so treat it
    # as automated (don't let a metadata gap reset the streak).
    return all(feedback.source.is_automated for feedback in feedbacks)


def automated_iteration_cap_reached(run_state: SeerRunState) -> bool:
    """Whether the last N PR iterations were *all* automated (bots + CI).

    Shared streak cap for the automated feedback loops (check suites, bot
    re-reviews). ``N`` is ``autofix.pr-iteration.max-iterations``. Human feedback
    (a review, a comment, or UI) mixed into any of the last N iterations breaks
    the streak, so a person can always keep iterating past the cap. Once the
    streak is unbroken for N iterations we stop triggering further automated ones
    — they'd loop forever without human input.
    """
    from sentry.seer.autofix.autofix_agent import get_iterations

    cap = options.get("autofix.pr-iteration.max-iterations")
    if cap <= 0:
        return False

    last_iterations = get_iterations(run_state)[-cap:]
    if len(last_iterations) < cap:
        return False

    return all(iteration_is_automated(iteration.blocks) for iteration in last_iterations)
