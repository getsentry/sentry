from unittest.mock import MagicMock, patch

from sentry.seer.agent.client_models import SeerRunState
from sentry.seer.autofix.pr_iteration.feedback import Feedback
from sentry.seer.autofix.pr_iteration.feedback_limits import (
    MANUAL_FEEDBACK_MAX_LENGTH,
    check_feedback_length,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.base import Decision
from sentry.seer.autofix.pr_iteration.feedback_sources.check_suite import CheckSuiteFeedbackSource
from sentry.seer.autofix.pr_iteration.feedback_sources.github_comment import (
    GithubPrCommentFeedbackSource,
    GithubPrReviewBodyFeedbackSource,
    GithubPrReviewCommentFeedbackSource,
)
from sentry.seer.autofix.pr_iteration.feedback_sources.user_ui import UserUIFeedbackSource
from sentry.seer.autofix.pr_iteration.logs import PrIterationLogContext
from sentry.testutils.cases import TestCase

LIMITS_PATH = "sentry.seer.autofix.pr_iteration.feedback_limits"
ALLOWLIST_OPTION = "autofix.pr-iteration.bot-feedback-allowlist"


def _check_suite_event() -> dict:
    return {
        "check_suite": {
            "id": 1,
            "head_sha": "abc",
            "check_runs_url": "https://github.com/owner/repo/check-runs",
            "app": {"name": "CI"},
            "updated_at": "2024-01-01T00:00:00Z",
            "pull_requests": [{"id": 99}],
        },
        "repository": {
            "html_url": "https://github.com/owner/repo",
            "full_name": "owner/repo",
            "id": 123,
        },
    }


class CheckFeedbackLengthTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.log = MagicMock()
        self.log_ctx = PrIterationLogContext(
            self.log,
            run_state=SeerRunState(
                run_id=1,
                blocks=[],
                status="completed",
                updated_at="2024-01-01T00:00:00Z",
                repo_pr_states={},
            ),
            organization_id=self.organization.id,
            group_id=1,
        )

    def _check(self, feedback: Feedback) -> tuple[Decision, MagicMock]:
        with patch(f"{LIMITS_PATH}.metrics") as mock_metrics:
            decision = check_feedback_length(self.log_ctx, feedback)
        return decision, mock_metrics

    def _ui_feedback(self, length: int) -> Feedback:
        return Feedback(source=UserUIFeedbackSource(user_id=1, user_feedback="a" * length))

    def _comment_feedback(self, length: int, *, login: str = "octocat") -> Feedback:
        return Feedback(
            source=GithubPrCommentFeedbackSource(
                comment={"id": 5, "body": "@sentry " + "a" * length, "user": {"login": login}}
            )
        )

    def test_a_length_at_the_limit_passes(self) -> None:
        decision, _ = self._check(self._ui_feedback(MANUAL_FEEDBACK_MAX_LENGTH))

        assert decision.ok is True
        assert decision.reason == "within_limit"

    def test_one_character_over_the_limit_is_blocked(self) -> None:
        decision, _ = self._check(self._ui_feedback(MANUAL_FEEDBACK_MAX_LENGTH + 1))

        assert decision.ok is False
        assert decision.reason == "over_length_human"

    def test_a_human_comment_over_the_limit_is_counted(self) -> None:
        decision, mock_metrics = self._check(self._comment_feedback(MANUAL_FEEDBACK_MAX_LENGTH + 1))

        assert decision.ok is False
        assert decision.reason == "over_length_human"
        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.feedback.over_length",
            tags={"source": "github-pr-comment", "actor": "human"},
        )

    def test_a_bot_review_body_over_the_limit_is_counted_as_a_bot(self) -> None:
        feedback = Feedback(
            source=GithubPrReviewBodyFeedbackSource(
                review_id=7,
                body="a" * (MANUAL_FEEDBACK_MAX_LENGTH + 1),
                user={"login": "coverage-bot-with-a-human-name"},
                author_is_bot=True,
            )
        )

        decision, mock_metrics = self._check(feedback)

        assert decision.ok is False
        assert decision.reason == "over_length_bot"
        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.feedback.over_length",
            tags={"source": "github-pr-review-body", "actor": "bot"},
        )

    def test_a_bot_login_suffix_is_enough_on_the_comment_path(self) -> None:
        # The ``@sentry`` comment payload carries no ``author_is_bot`` field.
        decision, mock_metrics = self._check(
            self._comment_feedback(MANUAL_FEEDBACK_MAX_LENGTH + 1, login="codecov[bot]")
        )

        assert decision.ok is False
        assert decision.reason == "over_length_bot"
        mock_metrics.incr.assert_called_once_with(
            "autofix.pr_iteration.feedback.over_length",
            tags={"source": "github-pr-comment", "actor": "bot"},
        )

    def test_an_allowlisted_bot_passes_over_the_limit(self) -> None:
        with self.options({ALLOWLIST_OPTION: ["codecov[bot]"]}):
            decision, mock_metrics = self._check(
                self._comment_feedback(MANUAL_FEEDBACK_MAX_LENGTH + 1, login="codecov[bot]")
            )

        assert decision.ok is True
        assert decision.reason == "bot_allowlisted"
        mock_metrics.incr.assert_not_called()

    def test_the_allowlist_match_ignores_case(self) -> None:
        with self.options({ALLOWLIST_OPTION: ["CodeCov[Bot]"]}):
            decision, _ = self._check(
                self._comment_feedback(MANUAL_FEEDBACK_MAX_LENGTH + 1, login="codecov[bot]")
            )

        assert decision.ok is True
        assert decision.reason == "bot_allowlisted"

    def test_the_allowlist_does_not_cover_a_human(self) -> None:
        with self.options({ALLOWLIST_OPTION: ["octocat"]}):
            decision, _ = self._check(
                self._comment_feedback(MANUAL_FEEDBACK_MAX_LENGTH + 1, login="octocat")
            )

        assert decision.ok is False
        assert decision.reason == "over_length_human"

    def test_a_check_suite_is_not_capped(self) -> None:
        event = _check_suite_event()
        event["check_suite"]["app"]["name"] = "a" * (MANUAL_FEEDBACK_MAX_LENGTH + 1)
        feedback = Feedback(source=CheckSuiteFeedbackSource(event=event))

        decision, mock_metrics = self._check(feedback)

        assert len(feedback.ui_text) > MANUAL_FEEDBACK_MAX_LENGTH

        assert decision.ok is True
        assert decision.reason == "not_capped"
        mock_metrics.incr.assert_not_called()

    def test_a_check_suite_actor_is_a_bot(self) -> None:
        source = CheckSuiteFeedbackSource(event=_check_suite_event())

        assert source.actor_is_bot is True

    def test_an_inline_comment_measures_the_typed_body(self) -> None:
        body = "a" * 20
        feedback = Feedback(
            source=GithubPrReviewCommentFeedbackSource(
                comment={
                    "id": 9,
                    "body": body,
                    "path": "src/sentry/foo.py",
                    "diff_hunk": "d" * (MANUAL_FEEDBACK_MAX_LENGTH + 1),
                    "user": {"login": "octocat"},
                }
            )
        )

        decision, mock_metrics = self._check(feedback)

        assert decision.ok is True
        assert decision.reason == "within_limit"
        assert len(feedback.text) > MANUAL_FEEDBACK_MAX_LENGTH
        mock_metrics.incr.assert_not_called()
