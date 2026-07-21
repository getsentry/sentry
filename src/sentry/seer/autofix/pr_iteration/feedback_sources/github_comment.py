from __future__ import annotations

from collections.abc import Sequence
from typing import Any, ClassVar, Literal

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
    diff_hunk: str | None = None


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
    return {
        item.source.comment.id
        for item in _blocks_feedback(run_state.blocks)
        if isinstance(item.source, source_cls) and item.source.comment.id is not None
    }


def _processed_github_review_ids(run_state: SeerRunState) -> set[int]:
    # Review-body feedback dedupes on the review id (its own GitHub namespace),
    # so a re-delivered ``pull_request_review`` can't re-add its summary body.
    return {
        item.source.review_id
        for item in _blocks_feedback(run_state.blocks)
        if isinstance(item.source, GithubPrReviewBodyFeedbackSource)
        and item.source.review_id is not None
    }


class _GithubPrCommentFeedbackSourceBase(FeedbackSourceBase):
    # Per-subclass contract: must the comment be an ``@sentry`` iterate command?
    # Top-level PR comments require it; inline review comments don't.
    require_command: ClassVar[bool]
    comment: GithubIssueComment
    # Derived from `comment` by `_parse_comment` — the single place a comment is
    # turned into feedback. Declared as a field (default "") so it serializes,
    # mirroring `CheckSuiteFeedbackSource.app_name`.
    comment_feedback: str = ""

    @root_validator
    def _parse_comment(cls, values: dict[str, Any]) -> dict[str, Any]:
        comment = values.get("comment")
        body = comment.body if isinstance(comment, GithubIssueComment) else None
        if cls.require_command:
            command = sentry_command(body)
            if not isinstance(command, SentryIterateCommand):
                raise ValueError(
                    "github-pr-comment feedback comment is not a @sentry iterate command"
                )
            values["comment_feedback"] = command.feedback
        else:
            values["comment_feedback"] = body or ""
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

    require_command: ClassVar[bool] = True
    type: Literal["github-pr-comment"] = "github-pr-comment"


class GithubPrReviewCommentFeedbackSource(_GithubPrCommentFeedbackSourceBase):
    """Feedback submitted as an inline GitHub PR review comment (``@sentry <feedback>``).

    Carries the review-comment anchor so the UI can link the feedback back to the
    diff location it was left on.
    """

    require_command: ClassVar[bool] = False
    type: Literal["github-pr-review-comment"] = "github-pr-review-comment"
    comment: GithubPullRequestReviewComment
    file_path: str | None = None
    line: int | None = None
    start_line: int | None = None
    diff_hunk: str | None = None
    # Whether the review author is a bot (e.g. a test-coverage bot). Bot reviews
    # count toward the automated-iteration streak cap; human reviews reset it.
    author_is_bot: bool = False

    @property
    def is_automated(self) -> bool:
        return self.author_is_bot

    @root_validator
    def _populate_location(cls, values: dict[str, Any]) -> dict[str, Any]:
        comment = values.get("comment")
        if not isinstance(comment, GithubPullRequestReviewComment):
            return values
        values["file_path"] = comment.path
        values["line"] = comment.line
        values["start_line"] = comment.start_line
        values["diff_hunk"] = comment.diff_hunk
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

    @property
    def text(self) -> str:
        """Prompt text: prefixes the comment with its diff anchor when present.

        GitHub's review-comment listing endpoint returns legacy comment objects
        anchored by ``position``/``diff_hunk`` rather than a resolved ``line``, so
        ``line`` is often ``None`` and ``anchor()`` degrades to just the file. When
        we have no line, fall back to the diff hunk so the agent still sees the
        exact code the comment is on.
        # TODO: resolve ``position`` + ``diff_hunk`` -> line number in the scm
        # library so ``line`` is populated and this fallback can be dropped.
        """
        anchor = self.anchor()
        if self.line and anchor:
            return f"Inline comment on {anchor}:\n{self.comment_feedback}"
        if self.file_path and self.diff_hunk:
            return (
                f"Inline comment on {self.file_path} at diff hunk:\n"
                f"{self.diff_hunk}\n{self.comment_feedback}"
            )
        if anchor:
            return f"Inline comment on {anchor}:\n{self.comment_feedback}"
        return self.comment_feedback

    @property
    def ui_text(self) -> str | None:
        # UI shows the comment body only; the anchor is rendered separately.
        return self.comment_feedback


class GithubPrReviewBodyFeedbackSource(FeedbackSourceBase):
    """The summary body of a submitted GitHub PR review.

    Unlike an inline review comment this has no diff anchor — it is the free-form
    text a reviewer types when submitting a review. Emitted as its own feedback
    item alongside the inline-comment sources (see decision 1 in the plan). No
    ``@sentry`` command gate: any non-empty review body is acted on.
    """

    type: Literal["github-pr-review-body"] = "github-pr-review-body"
    # The GitHub review id, used to dedupe re-delivered reviews.
    review_id: int | None = None
    body: str = ""
    html_url: str | None = None
    # Whether the review author is a bot (e.g. a test-coverage bot). Bot reviews
    # count toward the automated-iteration streak cap; human reviews reset it.
    author_is_bot: bool = False

    @property
    def text(self) -> str:
        return self.body

    @property
    def is_automated(self) -> bool:
        return self.author_is_bot

    def should_consume(self, run_state: SeerRunState) -> bool:
        if self.review_id is None:
            return True
        return self.review_id not in _processed_github_review_ids(run_state)


__all__ = (
    "GithubIssueComment",
    "GithubPrCommentFeedbackSource",
    "GithubPrCommentFeedbackType",
    "GithubPrCommentUser",
    "GithubPrReviewBodyFeedbackSource",
    "GithubPrReviewCommentFeedbackSource",
    "GithubPullRequestReviewComment",
)
