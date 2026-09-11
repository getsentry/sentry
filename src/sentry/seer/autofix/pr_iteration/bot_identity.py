"""Map the GitHub login of a review bot to a short slug for analytics."""

from __future__ import annotations

from collections.abc import Iterable

from sentry.integrations.github.utils import is_github_bot_login
from sentry.seer.autofix.pr_iteration.feedback_sources.base import FeedbackSourceBase
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)

OTHER_BOT_SLUG = "other_bot"

# Logins normalized by ``_normalize_login``: lowercase, with "[bot]" removed.
_SLUGS_BY_LOGIN = {
    "seer-by-sentry": "seer",
    "seer-dev-testing": "seer",
    "seer": "seer",
    "coderabbitai": "coderabbit",
    "cursor": "cursor",
}


def _normalize_login(login: str) -> str:
    return login.lower().removesuffix("[bot]")


def bot_slug(login: str | None, *, author_is_bot: bool) -> str | None:
    """The slug for a review author. None when the author is not a bot."""
    if not author_is_bot:
        return None
    if not login:
        return OTHER_BOT_SLUG
    return _SLUGS_BY_LOGIN.get(_normalize_login(login), OTHER_BOT_SLUG)


def _source_bot_slug(source: FeedbackSourceBase) -> str | None:
    """The slug for one feedback source. None when it is not a bot review."""
    if isinstance(source, GithubPrReviewBodyFeedbackSource):
        login = source.user.login if source.user else None
        return bot_slug(login, author_is_bot=source.author_is_bot)

    if isinstance(source, GithubPrReviewCommentFeedbackSource):
        login = source.comment.user.login if source.comment.user else None
        return bot_slug(login, author_is_bot=source.author_is_bot)

    if isinstance(source, GithubPrCommentFeedbackSource):
        # This source carries no bot flag, so the login is the only signal.
        login = source.comment.user.login if source.comment.user else None
        return bot_slug(login, author_is_bot=is_github_bot_login(login))

    return None


def bot_slugs_for_feedback(sources: Iterable[FeedbackSourceBase]) -> list[str]:
    """The review-bot slugs behind these feedback sources, sorted and deduped."""
    slugs = {slug for source in sources if (slug := _source_bot_slug(source)) is not None}
    return sorted(slugs)
