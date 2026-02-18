"""
Tests for CodeReviewRun lifecycle tracking in the code review pipeline.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch

from django.utils import timezone as django_timezone
from urllib3 import BaseHTTPResponse

from sentry.integrations.github.webhook_types import GithubWebhookType
from sentry.models.codereviewrun import CodeReviewRun, CodeReviewRunStatus
from sentry.seer.code_review.webhooks.task import (
    _create_code_review_run,
    _update_code_review_run,
    process_github_webhook_event,
)
from sentry.testutils.cases import TestCase


class CreateCodeReviewRunTest(TestCase):
    def test_creates_record_with_required_fields(self) -> None:
        run_id = _create_code_review_run(
            organization_id=self.organization.id,
            repository_id=1,
            pull_request_number=42,
            commit_sha="abc123",
            github_delivery_id="delivery-123",
        )

        assert run_id is not None
        run = CodeReviewRun.objects.get(id=run_id)
        assert run.organization_id == self.organization.id
        assert run.repository_id == 1
        assert run.pull_request_number == 42
        assert run.commit_sha == "abc123"
        assert run.github_delivery_id == "delivery-123"
        assert run.status == CodeReviewRunStatus.TASK_ENQUEUED

    def test_returns_none_when_pr_number_missing(self) -> None:
        run_id = _create_code_review_run(
            organization_id=self.organization.id,
            repository_id=1,
            pull_request_number=None,
            commit_sha="abc123",
            github_delivery_id="delivery-123",
        )
        assert run_id is None

    def test_returns_none_when_delivery_id_missing(self) -> None:
        run_id = _create_code_review_run(
            organization_id=self.organization.id,
            repository_id=1,
            pull_request_number=42,
            commit_sha="abc123",
            github_delivery_id=None,
        )
        assert run_id is None

    def test_returns_none_and_logs_on_db_error(self) -> None:
        with patch("sentry.seer.code_review.webhooks.task.CodeReviewRun.objects") as mock_manager:
            mock_manager.create.side_effect = Exception("DB error")
            run_id = _create_code_review_run(
                organization_id=self.organization.id,
                repository_id=1,
                pull_request_number=42,
                commit_sha="abc123",
                github_delivery_id="delivery-123",
            )
        assert run_id is None


class UpdateCodeReviewRunTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.cr_run = CodeReviewRun.objects.create(
            organization_id=self.organization.id,
            repository_id=1,
            pull_request_number=42,
            commit_sha="abc123",
            github_delivery_id="delivery-123",
            status=CodeReviewRunStatus.TASK_ENQUEUED,
        )

    def test_updates_status(self) -> None:
        _update_code_review_run(self.cr_run.id, CodeReviewRunStatus.SEER_REQUEST_SENT)
        self.cr_run.refresh_from_db()
        assert self.cr_run.status == CodeReviewRunStatus.SEER_REQUEST_SENT

    def test_updates_status_with_error_message(self) -> None:
        _update_code_review_run(
            self.cr_run.id,
            CodeReviewRunStatus.SEER_REQUEST_FAILED,
            error_message="Connection refused",
        )
        self.cr_run.refresh_from_db()
        assert self.cr_run.status == CodeReviewRunStatus.SEER_REQUEST_FAILED
        assert self.cr_run.error_message == "Connection refused"

    def test_no_op_when_run_id_is_none(self) -> None:
        _update_code_review_run(None, CodeReviewRunStatus.SEER_REQUEST_SUCCEEDED)
        self.cr_run.refresh_from_db()
        assert self.cr_run.status == CodeReviewRunStatus.TASK_ENQUEUED

    def test_silently_ignores_db_error(self) -> None:
        with patch("sentry.seer.code_review.webhooks.task.CodeReviewRun.objects") as mock_manager:
            mock_manager.filter.side_effect = Exception("DB error")
            _update_code_review_run(self.cr_run.id, CodeReviewRunStatus.SEER_REQUEST_SENT)
        self.cr_run.refresh_from_db()
        assert self.cr_run.status == CodeReviewRunStatus.TASK_ENQUEUED


class ProcessGitHubWebhookEventRunTrackingTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enqueued_at_str = datetime.now(tz=timezone.utc).isoformat()
        self.cr_run = CodeReviewRun.objects.create(
            organization_id=self.organization.id,
            repository_id=1,
            pull_request_number=42,
            commit_sha="abc123",
            github_delivery_id="delivery-123",
            status=CodeReviewRunStatus.TASK_ENQUEUED,
        )
        self.event_payload = {
            "request_type": "pr-review",
            "external_owner_id": "456",
            "data": {
                "repo": {
                    "provider": "github",
                    "owner": "getsentry",
                    "name": "sentry",
                    "external_id": "123456",
                    "base_commit_sha": "abc123",
                    "organization_id": self.organization.id,
                },
                "pr_id": 42,
                "bug_prediction_specific_information": {
                    "organization_id": self.organization.id,
                    "organization_slug": self.organization.slug,
                },
                "config": {
                    "features": {},
                    "trigger": "on_new_commit",
                    "trigger_at": "2026-01-01T00:00:00Z",
                    "sentry_received_trigger_at": "2026-01-01T00:00:00Z",
                },
            },
        }

    def _mock_response(self, status: int, data: bytes) -> BaseHTTPResponse:
        mock_response = MagicMock(spec=BaseHTTPResponse)
        mock_response.status = status
        mock_response.data = data
        return mock_response

    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    def test_successful_request_updates_status_to_succeeded(self, mock_request: MagicMock) -> None:
        mock_request.return_value = self._mock_response(200, b"{}")

        process_github_webhook_event._func(
            github_event=GithubWebhookType.PULL_REQUEST,
            event_payload=self.event_payload,
            enqueued_at_str=self.enqueued_at_str,
            code_review_run_id=self.cr_run.id,
        )

        self.cr_run.refresh_from_db()
        assert self.cr_run.status == CodeReviewRunStatus.SEER_REQUEST_SUCCEEDED

    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    def test_client_error_updates_status_to_failed(self, mock_request: MagicMock) -> None:
        from sentry.seer.code_review.utils import ClientError

        mock_request.return_value = self._mock_response(400, b'{"detail": "Bad request"}')

        import pytest

        with pytest.raises(ClientError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.PULL_REQUEST,
                event_payload=self.event_payload,
                enqueued_at_str=self.enqueued_at_str,
                code_review_run_id=self.cr_run.id,
            )

        self.cr_run.refresh_from_db()
        assert self.cr_run.status == CodeReviewRunStatus.SEER_REQUEST_FAILED

    @patch("sentry.seer.code_review.webhooks.task.current_task")
    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    def test_retryable_error_on_final_attempt_updates_status_to_failed(
        self, mock_request: MagicMock, mock_current_task: MagicMock
    ) -> None:
        from urllib3.exceptions import HTTPError

        mock_request.return_value = self._mock_response(500, b'{"detail": "Server error"}')
        mock_task_state = MagicMock()
        mock_task_state.retries_remaining = False
        mock_current_task.return_value = mock_task_state

        import pytest

        with pytest.raises(HTTPError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.PULL_REQUEST,
                event_payload=self.event_payload,
                enqueued_at_str=self.enqueued_at_str,
                code_review_run_id=self.cr_run.id,
            )

        self.cr_run.refresh_from_db()
        assert self.cr_run.status == CodeReviewRunStatus.SEER_REQUEST_FAILED

    @patch("sentry.seer.code_review.webhooks.task.current_task")
    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    def test_retryable_error_with_retries_remaining_leaves_status_as_sent(
        self, mock_request: MagicMock, mock_current_task: MagicMock
    ) -> None:
        from urllib3.exceptions import HTTPError

        mock_request.return_value = self._mock_response(500, b'{"detail": "Server error"}')
        mock_task_state = MagicMock()
        mock_task_state.retries_remaining = True
        mock_current_task.return_value = mock_task_state

        import pytest

        with pytest.raises(HTTPError):
            process_github_webhook_event._func(
                github_event=GithubWebhookType.PULL_REQUEST,
                event_payload=self.event_payload,
                enqueued_at_str=self.enqueued_at_str,
                code_review_run_id=self.cr_run.id,
            )

        self.cr_run.refresh_from_db()
        assert self.cr_run.status == CodeReviewRunStatus.SEER_REQUEST_SENT

    @patch("sentry.seer.code_review.utils.make_signed_seer_api_request")
    def test_no_run_id_still_processes_request(self, mock_request: MagicMock) -> None:
        """Task should work normally when no code_review_run_id is provided."""
        mock_request.return_value = self._mock_response(200, b"{}")

        process_github_webhook_event._func(
            github_event=GithubWebhookType.PULL_REQUEST,
            event_payload=self.event_payload,
            enqueued_at_str=self.enqueued_at_str,
            code_review_run_id=None,
        )

        assert mock_request.call_count == 1


class CleanupOldCodeReviewRunsTest(TestCase):
    def test_deletes_old_runs(self) -> None:
        from sentry.seer.code_review.tasks.cleanup import (
            RETENTION_DAYS,
            cleanup_old_code_review_runs,
        )

        old_run = CodeReviewRun.objects.create(
            organization_id=self.organization.id,
            repository_id=1,
            pull_request_number=1,
            commit_sha="old",
            github_delivery_id="old-delivery",
            status=CodeReviewRunStatus.SEER_REQUEST_SUCCEEDED,
        )
        CodeReviewRun.objects.filter(id=old_run.id).update(
            date_added=django_timezone.now() - timedelta(days=RETENTION_DAYS + 1)
        )

        recent_run = CodeReviewRun.objects.create(
            organization_id=self.organization.id,
            repository_id=1,
            pull_request_number=2,
            commit_sha="new",
            github_delivery_id="new-delivery",
            status=CodeReviewRunStatus.TASK_ENQUEUED,
        )

        cleanup_old_code_review_runs()

        assert not CodeReviewRun.objects.filter(id=old_run.id).exists()
        assert CodeReviewRun.objects.filter(id=recent_run.id).exists()

    def test_retains_recent_runs(self) -> None:
        from sentry.seer.code_review.tasks.cleanup import (
            RETENTION_DAYS,
            cleanup_old_code_review_runs,
        )

        run = CodeReviewRun.objects.create(
            organization_id=self.organization.id,
            repository_id=1,
            pull_request_number=3,
            commit_sha="abc",
            github_delivery_id="delivery-x",
            status=CodeReviewRunStatus.SEER_REQUEST_SUCCEEDED,
        )
        CodeReviewRun.objects.filter(id=run.id).update(
            date_added=django_timezone.now() - timedelta(days=RETENTION_DAYS - 1)
        )

        cleanup_old_code_review_runs()

        assert CodeReviewRun.objects.filter(id=run.id).exists()
