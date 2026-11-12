from __future__ import annotations

from collections.abc import Sequence

from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)

_MAX_TEXT_LENGTH = 120


def _one_line(text: str) -> str:
    text = " ".join(text.split())
    if len(text) <= _MAX_TEXT_LENGTH:
        return text
    return text[: _MAX_TEXT_LENGTH - 1].rstrip() + "…"


def _login(login: str | None) -> str:
    return f"@{login}" if login else "Someone"


def _display_line(item: Feedback, pr: str) -> str:
    source = item.source
    if isinstance(source, CheckSuiteFeedbackSource):
        return f"{source.app_name or 'A check'} failed on {pr}"
    if isinstance(source, GithubPrReviewBodyFeedbackSource):
        login = source.user.login if source.user else None
        return f"{_login(login)} reviewed {pr}: {_one_line(source.body)}"
    if isinstance(source, GithubPrReviewCommentFeedbackSource):
        login = source.comment.user.login if source.comment.user else None
        anchor = source.anchor()
        where = f"{anchor} in {pr}" if anchor else pr
        return f"{_login(login)} on {where}: {_one_line(source.comment_feedback)}"
    if isinstance(source, GithubPrCommentFeedbackSource):
        login = source.comment.user.login if source.comment.user else None
        return f"{_login(login)} on {pr}: {_one_line(source.comment_feedback)}"
    return _one_line(item.ui_text)


def pr_feedback_display(feedback: Sequence[Feedback], pr_number: int | None) -> str:
    pr = f"#{pr_number}" if pr_number is not None else "the PR"
    return "\n".join(_display_line(item, pr) for item in feedback)
