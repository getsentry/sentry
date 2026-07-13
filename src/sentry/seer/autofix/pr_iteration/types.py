from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from functools import cached_property
from typing import Annotated, Any, Literal

from django.utils import timezone
from pydantic import BaseModel, Field, ValidationError, parse_raw_as, root_validator

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.webhooks import SentryIterateCommand, sentry_command
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
        keep_untouched = (cached_property,)

    @property
    def text(self) -> str:
        """Verbatim text passed to the explorer agent in the prompt."""
        raise NotImplementedError

    @property
    def ui_text(self) -> str | None:
        """Text shown in the UI. ``None`` means fall back to ``text``."""
        return None

    def should_queue(self, run_state: SeerRunState) -> bool:
        return True

    def should_consume(self, run_state: SeerRunState) -> bool:
        return True

    def should_trigger(self, run_state: SeerRunState) -> bool:
        return True


class UserUIFeedbackSource(FeedbackSourceBase):
    type: Literal["user-ui"] = "user-ui"
    user_id: int
    user: Any = None
    # The feedback the user typed in the UI. Optional so feedback serialized
    # before this field existed still parses (see Feedback._populate).
    user_feedback: str = ""

    @property
    def text(self) -> str:
        return self.user_feedback


class _GithubPrCommentFeedbackSourceBase(FeedbackSourceBase):
    comment: Mapping[str, Any]
    # Derived from `comment` by `_parse_comment` — the single place a comment is
    # turned into feedback. Declared as a field (default "") so it serializes,
    # mirroring `CheckSuiteFeedbackSource.app_name`.
    comment_feedback: str = ""

    @root_validator
    def _parse_comment(cls, values: dict[str, Any]) -> dict[str, Any]:
        comment = values.get("comment") or {}
        command = sentry_command(comment.get("body"))
        if not isinstance(command, SentryIterateCommand):
            raise ValueError("github-pr-comment feedback comment is not a @sentry iterate command")
        values["comment_feedback"] = command.feedback
        return values

    @property
    def text(self) -> str:
        return self.comment_feedback

    def should_consume(self, run_state: SeerRunState) -> bool:
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

    @root_validator
    def _populate_location(cls, values: dict[str, Any]) -> dict[str, Any]:
        comment = values.get("comment") or {}
        values["file_path"] = comment.get("path")
        values["line"] = comment.get("line")
        values["start_line"] = comment.get("start_line")
        return values

    def anchor(self) -> str | None:
        """``file_path:line`` (or ``file_path:start-end``) the inline comment is
        attached to, or ``None`` when it isn't line-anchored."""
        if not self.file_path:
            return None
        if self.start_line and self.line and self.start_line != self.line:
            return f"{self.file_path}:{self.start_line}-{self.line}"
        if self.line:
            return f"{self.file_path}:{self.line}"
        return self.file_path


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


def format_feedback_for_prompt(feedback: Feedback) -> str:
    """Render a feedback item for the Seer prompt.

    Inline GitHub review comments are prefixed with their diff anchor so Seer
    knows which file/line the comment targets; every other source passes
    through verbatim.
    """
    source = feedback.source
    if isinstance(source, GithubPrReviewCommentFeedbackSource):
        anchor = source.anchor()
        if anchor:
            return f"Inline comment on {anchor}:\n{feedback.text}"
    return feedback.text


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
