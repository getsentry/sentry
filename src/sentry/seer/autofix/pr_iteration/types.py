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


def _processed_github_comment_ids(run_state: SeerRunState) -> set[int]:
    ids: set[int] = set()
    for block in run_state.blocks:
        raw = (block.message.metadata or {}).get("feedback")
        if not raw:
            continue

        for item in parse_feedback(raw):
            source = item.source
            if isinstance(source, GithubPrCommentFeedbackSource):
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


class GithubPrCommentFeedbackSource(FeedbackSourceBase):
    type: Literal["github-pr-comment"] = "github-pr-comment"
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
        return comment_id not in _processed_github_comment_ids(run_state)


FeedbackSource = Annotated[
    UserUIFeedbackSource | GithubPrCommentFeedbackSource,
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
