from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Annotated, Any, Literal

from django.utils import timezone
from pydantic import BaseModel, Field, ValidationError, parse_raw_as

from sentry.seer.agent.client_models import SeerRunState
from sentry.utils import json

GithubPrCommentFeedbackType = Literal["github-pr-comment", "github-pr-review-comment"]


def _processed_github_comment_ids(
    run_state: SeerRunState,
    source_cls: type[_GithubPrCommentFeedbackSourceBase],
) -> set[int]:
    # Filtered by concrete source class: issue-comment and review-comment ids
    # live in separate GitHub namespaces, so a review comment must only dedupe
    # against prior review comments (and vice versa), never across the two.
    ids: set[int] = set()
    for block in run_state.blocks:
        raw = (block.message.metadata or {}).get("feedback")
        if not raw:
            continue

        for item in parse_feedback(raw):
            source = item.source
            if isinstance(source, source_cls):
                cid = source.comment.get("id")
                if cid is not None:
                    ids.add(cid)
    return ids


class FeedbackSourceBase(BaseModel):
    class Config:
        extra = "ignore"

    def is_valid_for_run_state(self, run_state: SeerRunState) -> bool:
        return True


class UserUIFeedbackSource(FeedbackSourceBase):
    type: Literal["user-ui"] = "user-ui"
    user_id: int
    user: Any = None


class _GithubPrCommentFeedbackSourceBase(FeedbackSourceBase):
    comment: Mapping[str, Any]

    def is_valid_for_run_state(self, run_state: SeerRunState) -> bool:
        comment_id = self.comment.get("id")
        if comment_id is None:
            return True
        # Dedupe against prior feedback of the same concrete source type so a
        # repeated comment webhook can't re-trigger an iteration.
        return comment_id not in _processed_github_comment_ids(run_state, type(self))


class GithubPrCommentFeedbackSource(_GithubPrCommentFeedbackSourceBase):
    """Feedback submitted as a top-level GitHub PR comment (``@sentry <feedback>``)."""

    type: Literal["github-pr-comment"] = "github-pr-comment"


class GithubPrReviewCommentFeedbackSource(_GithubPrCommentFeedbackSourceBase):
    """Feedback submitted as an inline GitHub PR review comment (``@sentry <feedback>``).

    Carries the review-comment anchor so the UI can link the feedback back to the
    diff location it was left on.
    """

    type: Literal["github-pr-review-comment"] = "github-pr-review-comment"
    file_path: str | None = None
    line: int | None = None
    start_line: int | None = None


FeedbackSource = Annotated[
    UserUIFeedbackSource | GithubPrCommentFeedbackSource | GithubPrReviewCommentFeedbackSource,
    Field(discriminator="type"),
]


class Feedback(BaseModel):
    text: str
    source: FeedbackSource
    timestamp: datetime = Field(default_factory=timezone.now)

    def is_valid_for_run_state(self, run_state: SeerRunState) -> bool:
        return self.source.is_valid_for_run_state(run_state)


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
