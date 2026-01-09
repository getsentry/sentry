from unittest.mock import MagicMock, patch

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.seer.code_review.metrics import (
    METRICS_PREFIX,
    CodeReviewErrorType,
    WebhookFilteredReason,
    record_webhook_enqueued,
    record_webhook_filtered,
    record_webhook_handler_error,
    record_webhook_received,
)
from sentry.seer.code_review.preflight import PreflightDenialReason


class TestCodeReviewMetrics:
    """Unit tests for code review metric functions."""

    @patch("sentry.seer.code_review.metrics.metrics")
    def test_record_webhook_received(self, mock_metrics: MagicMock) -> None:
        record_webhook_received(GithubWebhookType.CHECK_RUN, "rerequested")

        mock_metrics.incr.assert_called_once_with(
            f"{METRICS_PREFIX}.webhook.received",
            tags={"github_event": "check_run", "github_event_action": "rerequested"},
            sample_rate=1.0,
        )

    @patch("sentry.seer.code_review.metrics.metrics")
    def test_record_webhook_received_issue_comment(self, mock_metrics: MagicMock) -> None:
        record_webhook_received(GithubWebhookType.ISSUE_COMMENT, "created")

        mock_metrics.incr.assert_called_once_with(
            f"{METRICS_PREFIX}.webhook.received",
            tags={"github_event": "issue_comment", "github_event_action": "created"},
            sample_rate=1.0,
        )

    @patch("sentry.seer.code_review.metrics.metrics")
    def test_record_webhook_filtered(self, mock_metrics: MagicMock) -> None:
        record_webhook_filtered(
            GithubWebhookType.CHECK_RUN,
            "completed",
            WebhookFilteredReason.UNSUPPORTED_ACTION,
        )

        mock_metrics.incr.assert_called_once_with(
            f"{METRICS_PREFIX}.webhook.filtered",
            tags={
                "github_event": "check_run",
                "github_event_action": "completed",
                "reason": "unsupported_action",
            },
            sample_rate=1.0,
        )

    @patch("sentry.seer.code_review.metrics.metrics")
    def test_record_webhook_filtered_preflight_denied(self, mock_metrics: MagicMock) -> None:
        record_webhook_filtered(
            GithubWebhookType.ISSUE_COMMENT,
            "created",
            PreflightDenialReason.ORG_NOT_ELIGIBLE_FOR_CODE_REVIEW,
        )

        mock_metrics.incr.assert_called_once_with(
            f"{METRICS_PREFIX}.webhook.filtered",
            tags={
                "github_event": "issue_comment",
                "github_event_action": "created",
                "reason": "org_not_eligible_for_code_review",
            },
            sample_rate=1.0,
        )

    @patch("sentry.seer.code_review.metrics.metrics")
    def test_record_webhook_enqueued(self, mock_metrics: MagicMock) -> None:
        record_webhook_enqueued(GithubWebhookType.CHECK_RUN, "rerequested")

        mock_metrics.incr.assert_called_once_with(
            f"{METRICS_PREFIX}.webhook.enqueued",
            tags={"github_event": "check_run", "github_event_action": "rerequested"},
            sample_rate=1.0,
        )

    @patch("sentry.seer.code_review.metrics.metrics")
    def test_record_webhook_handler_error(self, mock_metrics: MagicMock) -> None:
        record_webhook_handler_error(
            GithubWebhookType.CHECK_RUN,
            "rerequested",
            CodeReviewErrorType.INVALID_PAYLOAD,
        )

        mock_metrics.incr.assert_called_once_with(
            f"{METRICS_PREFIX}.webhook.error",
            tags={
                "github_event": "check_run",
                "github_event_action": "rerequested",
                "error_type": "invalid_payload",
            },
            sample_rate=1.0,
        )

    @patch("sentry.seer.code_review.metrics.metrics")
    def test_record_webhook_handler_error_missing_integration(
        self, mock_metrics: MagicMock
    ) -> None:
        record_webhook_handler_error(
            GithubWebhookType.ISSUE_COMMENT,
            "created",
            CodeReviewErrorType.MISSING_INTEGRATION,
        )

        mock_metrics.incr.assert_called_once_with(
            f"{METRICS_PREFIX}.webhook.error",
            tags={
                "github_event": "issue_comment",
                "github_event_action": "created",
                "error_type": "missing_integration",
            },
            sample_rate=1.0,
        )
