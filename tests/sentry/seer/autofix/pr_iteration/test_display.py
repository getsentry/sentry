from sentry.seer.autofix.pr_iteration.display import pr_feedback_display
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)

_OCTO = {"login": "octo"}


def _pr_comment(body: str = "@sentry rename it") -> Feedback:
    return Feedback(
        source=GithubPrCommentFeedbackSource(comment={"id": 1, "body": body, "user": _OCTO})
    )


def _inline_comment() -> Feedback:
    return Feedback(
        source=GithubPrReviewCommentFeedbackSource(
            comment={"id": 2, "body": "use a set", "path": "app/cart.py", "line": 42, "user": _OCTO}
        )
    )


def _review_body() -> Feedback:
    return Feedback(
        source=GithubPrReviewBodyFeedbackSource(review_id=3, body="looks close", user=_OCTO)
    )


def _check_suite() -> Feedback:
    return Feedback(
        source=CheckSuiteFeedbackSource(
            event={
                "check_suite": {
                    "id": 4,
                    "head_sha": "abc",
                    "check_runs_url": "https://github.com/owner/repo/check-runs",
                    "app": {"name": "GitHub Actions"},
                },
                "repository": {
                    "html_url": "https://github.com/owner/repo",
                    "full_name": "owner/repo",
                },
            }
        )
    )


def test_pr_comment() -> None:
    assert pr_feedback_display([_pr_comment()], 12) == "@octo on #12: rename it"


def test_inline_review_comment() -> None:
    assert (
        pr_feedback_display([_inline_comment()], 12) == "@octo on app/cart.py:42 in #12: use a set"
    )


def test_review_body() -> None:
    assert pr_feedback_display([_review_body()], 12) == "@octo reviewed #12: looks close"


def test_check_suite_failure() -> None:
    assert pr_feedback_display([_check_suite()], 12) == "GitHub Actions failed on #12"


def test_merged_items_get_one_line_each() -> None:
    assert (
        pr_feedback_display([_pr_comment(), _check_suite()], 12)
        == "@octo on #12: rename it\nGitHub Actions failed on #12"
    )


def test_long_comment_is_truncated_to_one_line() -> None:
    line = pr_feedback_display([_pr_comment("@sentry " + "word\n" * 60)], 12)

    text = line.removeprefix("@octo on #12: ")
    assert "\n" not in line
    assert len(text) == 120
    assert text.endswith("…")
