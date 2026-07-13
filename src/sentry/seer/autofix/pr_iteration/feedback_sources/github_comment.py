from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Literal

from pydantic import BaseModel, root_validator

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.pr_iteration.feedback_sources.base import FeedbackSourceBase
from sentry.seer.webhooks import SentryIterateCommand, sentry_command

GithubPrCommentFeedbackType = Literal["github-pr-comment", "github-pr-review-comment"]


class GithubPrCommentUser(BaseModel):
    login: str | None = None

    class Config:
        extra = "allow"


class GithubIssueComment(BaseModel):
    id: int | None = None
    body: str | None = None
    html_url: str | None = None
    user: GithubPrCommentUser | None = None

    class Config:
        extra = "allow"


class GithubPullRequestReviewComment(GithubIssueComment):
    path: str | None = None
    line: int | None = None
    start_line: int | None = None


def _blocks_feedback(blocks: Sequence[Any]) -> list[Any]:
    from sentry.seer.autofix.pr_iteration.feedback import parse_feedback

    items: list[Any] = []
    for block in blocks:
        raw = (block.message.metadata or {}).get("feedback")
        if raw:
            items.extend(parse_feedback(raw))
    return items


def _processed_github_comment_ids(
    run_state: SeerRunState,
    source_cls: type[_GithubPrCommentFeedbackSourceBase],
) -> set[int]:
    # Filtered by concrete source class: issue-comment and review-comment ids
    # live in separate GitHub namespaces, so a review comment must only dedupe
    # against prior review comments (and vice versa), never across the two.
    ids: set[int] = set()
    for item in _blocks_feedback(run_state.blocks):
        source = item.source
        if isinstance(source, source_cls):
            cid = source.comment.id
            if cid is not None:
                ids.add(cid)
    return ids


class _GithubPrCommentFeedbackSourceBase(FeedbackSourceBase):
    comment: GithubIssueComment
    # Derived from `comment` by `_parse_comment` — the single place a comment is
    # turned into feedback. Declared as a field (default "") so it serializes,
    # mirroring `CheckSuiteFeedbackSource.app_name`.
    comment_feedback: str = ""

    @root_validator
    def _parse_comment(cls, values: dict[str, Any]) -> dict[str, Any]:
        comment = values.get("comment")
        body = comment.body if isinstance(comment, GithubIssueComment) else None
        command = sentry_command(body)
        if not isinstance(command, SentryIterateCommand):
            raise ValueError("github-pr-comment feedback comment is not a @sentry iterate command")
        values["comment_feedback"] = command.feedback
        return values

    @property
    def text(self) -> str:
        return self.comment_feedback

    def should_consume(self, run_state: SeerRunState) -> bool:
        comment_id = self.comment.id
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
    comment: GithubPullRequestReviewComment
    file_path: str | None = None
    line: int | None = None
    start_line: int | None = None

    @root_validator
    def _populate_location(cls, values: dict[str, Any]) -> dict[str, Any]:
        comment = values.get("comment")
        if not isinstance(comment, GithubPullRequestReviewComment):
            return values
        values["file_path"] = comment.path
        values["line"] = comment.line
        values["start_line"] = comment.start_line
        return values


__all__ = (
    "GithubIssueComment",
    "GithubPrCommentFeedbackSource",
    "GithubPrCommentFeedbackType",
    "GithubPrCommentUser",
    "GithubPrReviewCommentFeedbackSource",
    "GithubPullRequestReviewComment",
)
