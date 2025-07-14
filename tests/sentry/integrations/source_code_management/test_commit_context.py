from unittest.mock import Mock, patch

import pytest

from sentry.integrations.gitlab.constants import GITLAB_CLOUD_BASE_URL
from sentry.integrations.source_code_management.commit_context import (
    CommitContextIntegration,
    SourceLineInfo,
)
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.repository import Repository
from sentry.shared_integrations.exceptions import ApiError, ApiHostError
from sentry.testutils.asserts import assert_failure_metric, assert_halt_metric, assert_slo_metric
from sentry.testutils.cases import TestCase
from sentry.users.models.identity import Identity


class MockCommitContextIntegration(CommitContextIntegration):
    """Mock implementation for testing"""

    integration_name = "mock_integration"

    def __init__(self):
        self.client = Mock()
        self.client.base_url = "https://example.com"

    def get_client(self):
        return self.client

    def on_create_or_update_comment_error(self, api_error: ApiError, metrics_base: str) -> bool:
        raise NotImplementedError


class TestCommitContextIntegrationSLO(TestCase):
    def setUp(self):
        super().setUp()
        self.integration = MockCommitContextIntegration()
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example/repo",
        )
        self.source_line = SourceLineInfo(
            lineno=10, path="src/file.py", ref="main", repo=self.repo, code_mapping=Mock()
        )

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_success(self, mock_record):
        """Test successful blame retrieval records correct lifecycle events"""
        self.integration.client.get_blame_for_files.return_value = []

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_missing_identity(self, mock_record):
        """Test missing identity records failure"""
        self.integration.get_client = Mock(side_effect=Identity.DoesNotExist())

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert len(mock_record.mock_calls) == 2
        assert_slo_metric(mock_record, EventLifecycleOutcome.FAILURE)
        assert_failure_metric(mock_record, Identity.DoesNotExist())

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_invalid_identity(self, mock_record):
        """Test invalid identity records failure"""
        from sentry.auth.exceptions import IdentityNotValid

        self.integration.client.get_blame_for_files = Mock(side_effect=IdentityNotValid())

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert_slo_metric(mock_record, EventLifecycleOutcome.FAILURE)
        assert_failure_metric(mock_record, IdentityNotValid())

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_rate_limited(self, mock_record):
        """Test rate limited requests record halt"""
        from sentry.shared_integrations.exceptions import ApiRateLimitedError

        self.integration.client.get_blame_for_files = Mock(
            side_effect=ApiRateLimitedError(text="Rate limited")
        )

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)
        assert_halt_metric(mock_record, ApiRateLimitedError(text="Rate limited"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_invalid_request(self, mock_record):
        """Test invalid request records failure"""
        from sentry.shared_integrations.exceptions import ApiInvalidRequestError

        self.integration.client.get_blame_for_files = Mock(
            side_effect=ApiInvalidRequestError(text="Invalid request")
        )

        with pytest.raises(ApiInvalidRequestError):
            self.integration.get_blame_for_files([self.source_line], {})

        assert_slo_metric(mock_record, EventLifecycleOutcome.FAILURE)
        assert_failure_metric(mock_record, ApiInvalidRequestError(text="Invalid request"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_invalid_request_gitlab(self, mock_record):
        """Test invalid request for GitLab records halt"""
        from sentry.shared_integrations.exceptions import ApiInvalidRequestError

        class MockGitlabIntegration(MockCommitContextIntegration):
            integration_name = "gitlab"

        self.integration = MockGitlabIntegration()

        self.integration.client.get_blame_for_files = Mock(
            side_effect=ApiInvalidRequestError(text="Invalid request")
        )

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)
        assert_halt_metric(mock_record, ApiInvalidRequestError(text="Invalid request"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_api_host_error_gitlab(self, mock_record):
        class MockGitlabIntegration(MockCommitContextIntegration):
            integration_name = "gitlab"

        self.integration = MockGitlabIntegration()

        self.integration.client.get_blame_for_files = Mock(
            side_effect=ApiHostError(text="retried too many times")
        )

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)
        assert_halt_metric(mock_record, ApiHostError(text="retried too many times"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_retry_error(self, mock_record):
        """Test retry error for Gitlab Self-hosted records halt"""
        from sentry.shared_integrations.exceptions import ApiRetryError

        # Because this is Gitlab Self-hosted, this should be halt
        class MockGitlabIntegration(MockCommitContextIntegration):
            integration_name = "gitlab"
            base_url = "https://bufo-bot.gitlab.com"

            def __init__(self):
                super().__init__()
                self.client.base_url = self.base_url

        self.integration = MockGitlabIntegration()

        self.integration.client.get_blame_for_files = Mock(
            side_effect=ApiRetryError(text="Host error")
        )

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert_slo_metric(mock_record, EventLifecycleOutcome.HALTED)
        assert_halt_metric(mock_record, ApiRetryError(text="Host error"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_retry_error_gitlab(self, mock_record):
        """Test retry error for GitLab saas records failure"""
        from sentry.shared_integrations.exceptions import ApiRetryError

        # Because this is Gitlab SAAS, this should be failure
        class MockGitlabIntegration(MockCommitContextIntegration):
            integration_name = "gitlab"
            base_url = GITLAB_CLOUD_BASE_URL

            def __init__(self):
                super().__init__()
                self.client.base_url = self.base_url

        self.integration = MockGitlabIntegration()

        self.integration.client.get_blame_for_files = Mock(
            side_effect=ApiRetryError(text="Host error")
        )

        with pytest.raises(ApiRetryError):
            self.integration.get_blame_for_files([self.source_line], {})

        assert_slo_metric(mock_record, EventLifecycleOutcome.FAILURE)
        assert_failure_metric(mock_record, ApiRetryError(text="Host error"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_commit_context_all_frames(self, mock_record):
        """Test get_commit_context_all_frames records correct lifecycle events"""
        self.integration.client.get_blame_for_files.return_value = []

        result = self.integration.get_commit_context_all_frames([self.source_line], {})

        assert result == []
        assert len(mock_record.mock_calls) == 2
        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)
