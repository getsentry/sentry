"""Collect the GitHub logins of the review bots behind feedback."""

from __future__ import annotations

from collections.abc import Iterable

from sentry.integrations.github.utils import is_github_bot_login
from sentry.seer.autofix.pr_iteration.feedback_sources.base import FeedbackSourceBase
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)


def _source_bot_login(source: FeedbackSourceBase) -> str | None:
    """The login for one feedback source. None when it is not a bot review."""
    if isinstance(source, GithubPrReviewBodyFeedbackSource):
        login = source.user.login if source.user else None
        is_bot = source.author_is_bot
    elif isinstance(source, GithubPrReviewCommentFeedbackSource):
        login = source.comment.user.login if source.comment.user else None
        is_bot = source.author_is_bot
    elif isinstance(source, GithubPrCommentFeedbackSource):
        # This source carries no bot flag, so the login is the only signal.
        login = source.comment.user.login if source.comment.user else None
        is_bot = is_github_bot_login(login)
    else:
        return None

    return login if is_bot and login else None


def bot_logins_for_feedback(sources: Iterable[FeedbackSourceBase]) -> list[str]:
    """The review-bot logins behind these feedback sources, sorted and deduped."""
    logins = {login for source in sources if (login := _source_bot_login(source)) is not None}
    return sorted(logins)
