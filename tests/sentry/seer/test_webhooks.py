import pytest

from sentry.seer.webhooks import (
    SentryIterateCommand,
    SentryReviewCommand,
    sentry_command,
)


class TestSentryCommand:
    @pytest.mark.parametrize(
        "body",
        [
            "@sentry review",
            "  @sentry review  ",
            "@Sentry Review",
            "@SENTRY REVIEW",
            "Please @sentry review this PR",
            "@sentry review and also fix this",
        ],
    )
    def test_review_command(self, body: str) -> None:
        assert isinstance(sentry_command(body), SentryReviewCommand)

    @pytest.mark.parametrize(
        "body, expected_feedback",
        [
            ("@sentry fix the typo", "fix the typo"),
            ("@sentry Fix The Bug", "Fix The Bug"),
            ("@sentry    fix this   ", "fix this"),
            ("hey @sentry do the thing", "hey do the thing"),
            ("@sentry a @sentry b", "a b"),
            ("@Sentry fix this", "fix this"),
        ],
    )
    def test_iterate_command(self, body: str, expected_feedback: str) -> None:
        command = sentry_command(body)
        assert isinstance(command, SentryIterateCommand)
        assert command.feedback == expected_feedback

    @pytest.mark.parametrize(
        "body",
        [
            None,
            "",
            "just a regular comment",
            "review",
            "@sentry",
            "@sentry    ",
        ],
    )
    def test_returns_none(self, body: str | None) -> None:
        assert sentry_command(body) is None
