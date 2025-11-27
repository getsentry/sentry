from unittest.mock import MagicMock, patch

import orjson
import pytest
import requests
from pydantic import BaseModel

from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.explorer.client_models import SeerRunState
from sentry.seer.models import SeerPermissionError
from sentry.testutils.cases import TestCase


class TestSeerExplorerClient(TestCase):
    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    def test_client_init_checks_access(self, mock_access):
        """Test that client initialization checks access and raises on denial"""
        mock_access.return_value = (False, "Feature flag not enabled")

        with pytest.raises(SeerPermissionError) as exc_info:
            SeerExplorerClient(self.organization, self.user)
        assert "Feature flag not enabled" in str(exc_info.value)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    def test_client_init_succeeds_with_access(self, mock_access):
        """Test that client initialization succeeds with proper access"""
        mock_access.return_value = (True, None)

        client = SeerExplorerClient(self.organization, self.user)
        assert client.organization == self.organization
        assert client.user == self.user
        assert client.artifact_schema is None

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    def test_client_init_with_artifact_schema(self, mock_access):
        """Test that client stores artifact schema"""
        mock_access.return_value = (True, None)

        class TestSchema(BaseModel):
            count: int

        client = SeerExplorerClient(self.organization, self.user, artifact_schema=TestSchema)
        assert client.artifact_schema == TestSchema

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    @patch("sentry.seer.explorer.client.collect_user_org_context")
    def test_start_run_basic(self, mock_collect_context, mock_post, mock_access):
        """Test starting a new run collects user context"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 123}
        mock_post.return_value = mock_response

        client = SeerExplorerClient(self.organization, self.user)
        run_id = client.start_run("Test query")

        assert run_id == 123
        mock_collect_context.assert_called_once_with(self.user, self.organization)
        assert mock_post.called

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_start_run_with_optional_params(self, mock_post, mock_access):
        """Test starting a run with optional parameters"""
        mock_access.return_value = (True, None)
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 789}
        mock_post.return_value = mock_response

        client = SeerExplorerClient(self.organization, self.user)
        run_id = client.start_run("Query", on_page_context="some context")

        assert run_id == 789
        call_args = mock_post.call_args
        assert call_args is not None

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_start_run_http_error(self, mock_post, mock_access):
        """Test that HTTP errors are propagated"""
        mock_access.return_value = (True, None)
        mock_post.return_value.raise_for_status.side_effect = requests.HTTPError("API Error")

        client = SeerExplorerClient(self.organization, self.user)
        with pytest.raises(requests.HTTPError):
            client.start_run("Test query")

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    @patch("sentry.seer.explorer.client.collect_user_org_context")
    def test_start_run_with_categories(self, mock_collect_context, mock_post, mock_access):
        """Test starting a run with category fields"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 999}
        mock_post.return_value = mock_response

        client = SeerExplorerClient(
            self.organization, self.user, category_key="bug-fixer", category_value="issue-123"
        )
        run_id = client.start_run("Fix bug")

        assert run_id == 999
        body = orjson.loads(mock_post.call_args[1]["data"])
        assert body["category_key"] == "bug-fixer"
        assert body["category_value"] == "issue-123"

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    def test_init_category_key_only_raises_error(self, mock_access):
        """Test that ValueError is raised when only category_key is provided"""
        mock_access.return_value = (True, None)

        with pytest.raises(
            ValueError, match="category_key and category_value must be provided together"
        ):
            SeerExplorerClient(self.organization, self.user, category_key="bug-fixer")

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    def test_init_category_value_only_raises_error(self, mock_access):
        """Test that ValueError is raised when only category_value is provided"""
        mock_access.return_value = (True, None)

        with pytest.raises(
            ValueError, match="category_key and category_value must be provided together"
        ):
            SeerExplorerClient(self.organization, self.user, category_value="issue-123")

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    def test_client_init_with_intelligence_level(self, mock_access):
        """Test that intelligence_level is stored"""
        mock_access.return_value = (True, None)

        client = SeerExplorerClient(self.organization, self.user, intelligence_level="high")
        assert client.intelligence_level == "high"

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    def test_client_init_default_intelligence_level(self, mock_access):
        """Test that intelligence_level defaults to 'medium'"""
        mock_access.return_value = (True, None)

        client = SeerExplorerClient(self.organization, self.user)
        assert client.intelligence_level == "medium"

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    @patch("sentry.seer.explorer.client.collect_user_org_context")
    def test_start_run_includes_intelligence_level(
        self, mock_collect_context, mock_post, mock_access
    ):
        """Test that intelligence_level is included in the payload"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 555}
        mock_post.return_value = mock_response

        client = SeerExplorerClient(self.organization, self.user, intelligence_level="low")
        run_id = client.start_run("Test query")

        assert run_id == 555
        body = orjson.loads(mock_post.call_args[1]["data"])
        assert body["intelligence_level"] == "low"

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_continue_run_basic(self, mock_post, mock_access):
        """Test continuing an existing run"""
        mock_access.return_value = (True, None)
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 456}
        mock_post.return_value = mock_response

        client = SeerExplorerClient(self.organization, self.user)
        run_id = client.continue_run(456, "Follow up query")

        assert run_id == 456
        assert mock_post.called

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_continue_run_with_all_params(self, mock_post, mock_access):
        """Test continuing a run with all optional parameters"""
        mock_access.return_value = (True, None)
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 789}
        mock_post.return_value = mock_response

        client = SeerExplorerClient(self.organization, self.user)
        run_id = client.continue_run(789, "Follow up", insert_index=2, on_page_context="context")

        assert run_id == 789
        call_args = mock_post.call_args
        assert call_args is not None

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_continue_run_http_error(self, mock_post, mock_access):
        """Test that HTTP errors are propagated"""
        mock_access.return_value = (True, None)
        mock_post.return_value.raise_for_status.side_effect = requests.HTTPError("API Error")

        client = SeerExplorerClient(self.organization, self.user)
        with pytest.raises(requests.HTTPError):
            client.continue_run(123, "Test query")

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    def test_get_run_immediate(self, mock_fetch, mock_access):
        """Test getting run status without waiting"""
        mock_access.return_value = (True, None)
        mock_state = SeerRunState(
            run_id=123,
            blocks=[],
            status="processing",
            updated_at="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = mock_state

        client = SeerExplorerClient(self.organization, self.user)
        result = client.get_run(123)

        assert result.run_id == 123
        assert result.status == "processing"
        mock_fetch.assert_called_once_with(123, self.organization)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.poll_until_done")
    def test_get_run_with_blocking(self, mock_poll, mock_access):
        """Test getting run status with polling"""
        mock_access.return_value = (True, None)
        mock_state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )
        mock_poll.return_value = mock_state

        client = SeerExplorerClient(self.organization, self.user)
        result = client.get_run(123, blocking=True, poll_interval=1.0, poll_timeout=30.0)

        assert result.run_id == 123
        assert result.status == "completed"
        mock_poll.assert_called_once_with(123, self.organization, 1.0, 30.0)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    def test_get_run_http_error(self, mock_fetch, mock_access):
        """Test that HTTP errors are propagated"""
        mock_access.return_value = (True, None)
        mock_fetch.side_effect = requests.HTTPError("API Error")

        client = SeerExplorerClient(self.organization, self.user)
        with pytest.raises(requests.HTTPError):
            client.get_run(123)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_get_runs_basic(self, mock_post, mock_access):
        """Test getting runs with filters"""
        mock_access.return_value = (True, None)
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "data": [
                {
                    "run_id": 1,
                    "title": "Test",
                    "last_triggered_at": "2024-01-01T00:00:00",
                    "created_at": "2024-01-01T00:00:00",
                    "category_key": "bug-fixer",
                    "category_value": "issue-123",
                }
            ]
        }
        mock_post.return_value = mock_response

        client = SeerExplorerClient(self.organization, self.user)
        runs = client.get_runs(category_key="bug-fixer", category_value="issue-123")

        assert len(runs) == 1
        assert runs[0].category_key == "bug-fixer"
        body = orjson.loads(mock_post.call_args[1]["data"])
        assert body["category_key"] == "bug-fixer"
        assert body["category_value"] == "issue-123"


class TestSeerExplorerClientArtifacts(TestCase):
    """Test artifact schema passing and reconstruction"""

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    @patch("sentry.seer.explorer.client.collect_user_org_context")
    def test_start_run_with_artifact_schema(self, mock_collect_context, mock_post, mock_access):
        """Test that artifact schema is serialized and sent to API"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 123}
        mock_post.return_value = mock_response

        class IssueAnalysis(BaseModel):
            issue_count: int
            severity: str

        client = SeerExplorerClient(self.organization, self.user, artifact_schema=IssueAnalysis)
        run_id = client.start_run("Analyze errors")

        assert run_id == 123

        # Verify artifact_schema was included in payload
        body = orjson.loads(mock_post.call_args[1]["data"])
        assert "artifact_schema" in body
        assert body["artifact_schema"]["type"] == "object"
        assert "issue_count" in body["artifact_schema"]["properties"]
        assert "severity" in body["artifact_schema"]["properties"]

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    def test_get_run_reconstructs_artifact(self, mock_fetch, mock_access):
        """Test that artifact is automatically reconstructed from dict"""
        mock_access.return_value = (True, None)

        class BugReport(BaseModel):
            bug_count: int
            severity: str

        # Mock API returns dict artifact
        mock_state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            raw_artifact={"bug_count": 5, "severity": "high"},  # Raw dict from API
            artifact_reason="Successfully generated",
        )
        mock_fetch.return_value = mock_state

        client = SeerExplorerClient(self.organization, self.user, artifact_schema=BugReport)
        result = client.get_run(123)

        # Verify artifact was reconstructed as Pydantic model
        assert isinstance(result.artifact, BugReport)
        assert result.artifact.bug_count == 5
        assert result.artifact.severity == "high"
        assert result.artifact_reason == "Successfully generated"

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    def test_get_run_with_none_artifact(self, mock_fetch, mock_access):
        """Test that None artifact is handled gracefully"""
        mock_access.return_value = (True, None)

        class MySchema(BaseModel):
            field: str

        mock_state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            raw_artifact=None,
            artifact_reason="Generation failed",
        )
        mock_fetch.return_value = mock_state

        client = SeerExplorerClient(self.organization, self.user, artifact_schema=MySchema)
        result = client.get_run(123)

        # Verify None artifact is preserved
        assert result.artifact is None
        assert result.artifact_reason == "Generation failed"
