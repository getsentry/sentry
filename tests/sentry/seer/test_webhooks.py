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
        "body",
        [
            "@sentry reviewed this",
            "@sentry  review",
            "@sentry\nreviewed",
        ],
    )
    def test_review_command_not_matched(self, body: str) -> None:
        assert not isinstance(sentry_command(body), SentryReviewCommand)

    @pytest.mark.parametrize(
        "body, expected_feedback",
        [
            ("@sentry fix the typo", "fix the typo"),
            ("@sentry Fix The Bug", "Fix The Bug"),
            ("@sentry    fix this   ", "fix this"),
            ("hey @sentry do the thing", "hey do the thing"),
            ("@sentry a @sentry b", "a b"),
            ("@Sentry fix this", "fix this"),
            ("@sentry reviewed this", "reviewed this"),
            ("@sentry  review", "review"),
            ("@sentry fix docs@sentry.io", "fix docs@sentry.io"),
            ("@sentry fix @sentry-cursor-agent", "fix @sentry-cursor-agent"),
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
            "@sentry-cursor-agent please help",
            "@sentry-bot do something",
            "email@sentry.io",
            "@sentry_bot",
            "check@sentrycode",
        ],
    )
    def test_returns_none(self, body: str | None) -> None:
        assert sentry_command(body) is None
