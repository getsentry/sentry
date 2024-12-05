from unittest.mock import Mock, patch

from sentry.integrations.source_code_management.commit_context import (
    CommitContextIntegration,
    SourceLineInfo,
)
from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.repository import Repository
from sentry.testutils.asserts import assert_failure_metric, assert_halt_metric
from sentry.testutils.cases import TestCase
from sentry.users.models.identity import Identity


class MockCommitContextIntegration(CommitContextIntegration):
    """Mock implementation for testing"""

    integration_name = "mock_integration"

    def __init__(self):
        self.client = Mock()

    def get_client(self):
        return self.client


class CommitContextIntegrationTest(TestCase):
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
        assert len(mock_record.mock_calls) == 2

        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_missing_identity(self, mock_record):
        """Test missing identity records failure"""
        self.integration.get_client = Mock(side_effect=Identity.DoesNotExist())

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert len(mock_record.mock_calls) == 2

        start, failure = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert failure.args[0] == EventLifecycleOutcome.FAILURE
        assert_failure_metric(mock_record, Identity.DoesNotExist())

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_blame_for_files_invalid_identity(self, mock_record):
        """Test invalid identity records failure"""
        from sentry.auth.exceptions import IdentityNotValid

        self.integration.client.get_blame_for_files = Mock(side_effect=IdentityNotValid())

        result = self.integration.get_blame_for_files([self.source_line], {})

        assert result == []
        assert len(mock_record.mock_calls) == 2

        start, failure = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert failure.args[0] == EventLifecycleOutcome.FAILURE
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
        assert len(mock_record.mock_calls) == 2

        start, halt = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert halt.args[0] == EventLifecycleOutcome.HALTED
        assert_halt_metric(mock_record, ApiRateLimitedError(text="Rate limited"))

    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_get_commit_context_all_frames(self, mock_record):
        """Test get_commit_context_all_frames records correct lifecycle events"""
        self.integration.client.get_blame_for_files.return_value = []

        result = self.integration.get_commit_context_all_frames([self.source_line], {})

        assert result == []
        assert len(mock_record.mock_calls) == 2

        start, success = mock_record.mock_calls
        assert start.args[0] == EventLifecycleOutcome.STARTED
        assert success.args[0] == EventLifecycleOutcome.SUCCESS
