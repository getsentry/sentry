import pytest

from sentry.seer.autofix.pr_iteration.bot_identity import (
    OTHER_BOT_SLUG,
    bot_slug,
    bot_slugs_for_feedback,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource


@pytest.mark.parametrize(
    "login,expected",
    [
        ("seer-by-sentry[bot]", "seer"),
        ("seer-dev-testing[bot]", "seer"),
        ("seer[bot]", "seer"),
        ("coderabbitai[bot]", "coderabbit"),
        ("CodeRabbitAI[bot]", "coderabbit"),
        ("cursor[bot]", "cursor"),
        ("some-new-reviewer[bot]", OTHER_BOT_SLUG),
        (None, OTHER_BOT_SLUG),
        ("", OTHER_BOT_SLUG),
    ],
)
def test_a_bot_login_maps_to_its_slug(login: str | None, expected: str) -> None:
    assert bot_slug(login, author_is_bot=True) == expected


def test_a_human_author_gets_no_slug() -> None:
    assert bot_slug("some-person", author_is_bot=False) is None


def _review_body(login: str | None, *, author_is_bot: bool) -> GithubPrReviewBodyFeedbackSource:
    return GithubPrReviewBodyFeedbackSource(
        review_id=1,
        body="fix it",
        user={"id": 1, "login": login},
        author_is_bot=author_is_bot,
    )


def _review_comment(login: str, *, author_is_bot: bool) -> GithubPrReviewCommentFeedbackSource:
    return GithubPrReviewCommentFeedbackSource(
        comment={"id": 2, "body": "fix it", "user": {"id": 2, "login": login}},
        author_is_bot=author_is_bot,
    )


def _pr_comment(login: str) -> GithubPrCommentFeedbackSource:
    return GithubPrCommentFeedbackSource(
        comment={"id": 3, "body": "@sentry fix it", "user": {"id": 3, "login": login}}
    )


def test_the_slugs_are_sorted_and_deduped() -> None:
    sources = [
        _review_body("coderabbitai[bot]", author_is_bot=True),
        _review_comment("coderabbitai[bot]", author_is_bot=True),
        _review_body("seer-by-sentry[bot]", author_is_bot=True),
    ]

    assert bot_slugs_for_feedback(sources) == ["coderabbit", "seer"]


def test_a_human_review_contributes_no_slug() -> None:
    sources = [
        _review_body("some-person", author_is_bot=False),
        _review_comment("some-person", author_is_bot=False),
    ]

    assert bot_slugs_for_feedback(sources) == []


def test_a_top_level_comment_is_classified_by_its_login() -> None:
    assert bot_slugs_for_feedback([_pr_comment("cursor[bot]")]) == ["cursor"]
    assert bot_slugs_for_feedback([_pr_comment("some-person")]) == []


def test_check_suite_feedback_is_ci_and_contributes_no_slug() -> None:
    source = CheckSuiteFeedbackSource(
        event={
            "check_suite": {
                "id": 1,
                "head_sha": "abc",
                "check_runs_url": "https://github.com/owner/repo/check-runs",
                "app": {"name": "CI"},
            },
            "repository": {"html_url": "https://github.com/owner/repo"},
        }
    )

    assert bot_slugs_for_feedback([source]) == []


def test_ui_feedback_contributes_no_slug() -> None:
    source = UserUIFeedbackSource(user_id=1, user_feedback="fix it")

    assert bot_slugs_for_feedback([source]) == []
