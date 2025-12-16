from unittest.mock import MagicMock, patch

import orjson
import pytest
import requests
from pydantic import BaseModel

from sentry.seer.explorer.client import SeerExplorerClient
from sentry.seer.explorer.client_models import (
    ExplorerFilePatch,
    FilePatch,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
)
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
    """Test artifact schema passing and retrieval"""

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    @patch("sentry.seer.explorer.client.collect_user_org_context")
    def test_start_run_with_artifact_schema(self, mock_collect_context, mock_post, mock_access):
        """Test that artifact key and schema are serialized and sent to API"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 123}
        mock_post.return_value = mock_response

        class IssueAnalysis(BaseModel):
            issue_count: int
            severity: str

        client = SeerExplorerClient(self.organization, self.user)
        run_id = client.start_run(
            "Analyze errors", artifact_key="analysis", artifact_schema=IssueAnalysis
        )

        assert run_id == 123

        # Verify artifact_key and artifact_schema were included in payload
        body = orjson.loads(mock_post.call_args[1]["data"])
        assert body["artifact_key"] == "analysis"
        assert "artifact_schema" in body
        assert body["artifact_schema"]["type"] == "object"
        assert "issue_count" in body["artifact_schema"]["properties"]
        assert "severity" in body["artifact_schema"]["properties"]

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_start_run_artifact_schema_requires_key(self, mock_post, mock_access):
        """Test that artifact_schema without artifact_key raises ValueError"""
        mock_access.return_value = (True, None)

        class IssueAnalysis(BaseModel):
            issue_count: int

        client = SeerExplorerClient(self.organization, self.user)
        with pytest.raises(
            ValueError, match="artifact_key and artifact_schema must be provided together"
        ):
            client.start_run("Analyze", artifact_schema=IssueAnalysis)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    @patch("sentry.seer.explorer.client.collect_user_org_context")
    def test_continue_run_with_artifact_schema(self, mock_collect_context, mock_post, mock_access):
        """Test continuing a run with a new artifact key and schema"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 123}
        mock_post.return_value = mock_response

        class Solution(BaseModel):
            description: str
            steps: list[str]

        client = SeerExplorerClient(self.organization, self.user)
        run_id = client.continue_run(
            123, "Propose a fix", artifact_key="solution", artifact_schema=Solution
        )

        assert run_id == 123

        body = orjson.loads(mock_post.call_args[1]["data"])
        assert body["artifact_key"] == "solution"
        assert "artifact_schema" in body
        assert body["artifact_schema"]["type"] == "object"
        assert "description" in body["artifact_schema"]["properties"]

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_continue_run_artifact_schema_requires_key(self, mock_post, mock_access):
        """Test that artifact_schema without artifact_key raises ValueError"""
        mock_access.return_value = (True, None)

        class Solution(BaseModel):
            description: str

        client = SeerExplorerClient(self.organization, self.user)
        with pytest.raises(
            ValueError, match="artifact_key and artifact_schema must be provided together"
        ):
            client.continue_run(123, "Fix it", artifact_schema=Solution)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    def test_get_run_with_artifacts_on_blocks(self, mock_fetch, mock_access):
        """Test that artifacts on blocks are returned and can be retrieved typed"""
        from sentry.seer.explorer.client_models import Artifact, MemoryBlock, Message

        mock_access.return_value = (True, None)

        class BugReport(BaseModel):
            bug_count: int
            severity: str

        # Mock API returns blocks with artifacts attached
        mock_state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Found the issue"),
                    timestamp="2024-01-01T00:00:00Z",
                    artifacts=[
                        Artifact(
                            key="root_cause",
                            data={"bug_count": 5, "severity": "high"},
                            reason="Successfully generated",
                        )
                    ],
                )
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = mock_state

        client = SeerExplorerClient(self.organization, self.user)
        result = client.get_run(123)

        # Verify artifacts can be retrieved via get_artifacts()
        artifacts = result.get_artifacts()
        assert "root_cause" in artifacts
        assert artifacts["root_cause"].data == {"bug_count": 5, "severity": "high"}

        # Verify typed retrieval via get_artifact helper
        artifact = result.get_artifact("root_cause", BugReport)
        assert isinstance(artifact, BugReport)
        assert artifact.bug_count == 5
        assert artifact.severity == "high"

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    def test_get_artifact_returns_none_when_missing(self, mock_fetch, mock_access):
        """Test that get_artifact returns None for missing or pending artifacts"""
        from sentry.seer.explorer.client_models import Artifact, MemoryBlock, Message

        mock_access.return_value = (True, None)

        class MySchema(BaseModel):
            field: str

        # Mock API returns block with artifact that has no data (pending)
        mock_state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Working..."),
                    timestamp="2024-01-01T00:00:00Z",
                    artifacts=[
                        Artifact(
                            key="pending",
                            data=None,  # Not yet generated
                            reason="Waiting for more info",
                        )
                    ],
                )
            ],
            status="processing",
            updated_at="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = mock_state

        client = SeerExplorerClient(self.organization, self.user)
        result = client.get_run(123)

        # Missing key returns None
        assert result.get_artifact("nonexistent", MySchema) is None
        # Pending artifact (data=None) returns None
        assert result.get_artifact("pending", MySchema) is None

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    def test_get_run_with_multiple_artifacts_on_blocks(self, mock_fetch, mock_access):
        """Test retrieving multiple artifacts from blocks in a multi-step run"""
        from sentry.seer.explorer.client_models import Artifact, MemoryBlock, Message

        mock_access.return_value = (True, None)

        class RootCause(BaseModel):
            cause: str
            confidence: float

        class Solution(BaseModel):
            description: str
            steps: list[str]

        # Mock API returns blocks with artifacts attached at different points
        mock_state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Found root cause"),
                    timestamp="2024-01-01T00:00:00Z",
                    artifacts=[
                        Artifact(
                            key="root_cause",
                            data={"cause": "Memory leak", "confidence": 0.95},
                            reason="Found the issue",
                        )
                    ],
                ),
                MemoryBlock(
                    id="block-2",
                    message=Message(role="assistant", content="Here's the solution"),
                    timestamp="2024-01-01T00:01:00Z",
                    artifacts=[
                        Artifact(
                            key="solution",
                            data={"description": "Fix the leak", "steps": ["Step 1", "Step 2"]},
                            reason="Generated fix",
                        )
                    ],
                ),
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = mock_state

        client = SeerExplorerClient(self.organization, self.user)
        result = client.get_run(123)

        # Retrieve both artifacts typed
        root_cause = result.get_artifact("root_cause", RootCause)
        solution = result.get_artifact("solution", Solution)

        assert root_cause is not None
        assert root_cause.cause == "Memory leak"
        assert root_cause.confidence == 0.95

        assert solution is not None
        assert solution.description == "Fix the leak"
        assert solution.steps == ["Step 1", "Step 2"]

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    def test_get_artifacts_returns_latest_version(self, mock_fetch, mock_access):
        """Test that get_artifacts returns the latest version when artifact is updated"""
        from sentry.seer.explorer.client_models import Artifact, MemoryBlock, Message

        mock_access.return_value = (True, None)

        class RootCause(BaseModel):
            cause: str

        # Mock API returns blocks with same artifact updated in later block
        mock_state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Initial analysis"),
                    timestamp="2024-01-01T00:00:00Z",
                    artifacts=[
                        Artifact(
                            key="root_cause",
                            data={"cause": "Old cause"},
                            reason="Initial analysis",
                        )
                    ],
                ),
                MemoryBlock(
                    id="block-2",
                    message=Message(role="assistant", content="Updated analysis"),
                    timestamp="2024-01-01T00:01:00Z",
                    artifacts=[
                        Artifact(
                            key="root_cause",
                            data={"cause": "New cause"},
                            reason="Updated after feedback",
                        )
                    ],
                ),
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )
        mock_fetch.return_value = mock_state

        client = SeerExplorerClient(self.organization, self.user)
        result = client.get_run(123)

        # Should get the latest version
        root_cause = result.get_artifact("root_cause", RootCause)
        assert root_cause is not None
        assert root_cause.cause == "New cause"


class TestSeerExplorerClientPushChanges(TestCase):
    """Test push_changes method"""

    def setUp(self):
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    @patch("sentry.seer.explorer.client.requests.post")
    def test_push_changes_sends_correct_payload(self, mock_post, mock_fetch, mock_access):
        """Test that push_changes sends correct payload"""
        mock_access.return_value = (True, None)
        mock_post.return_value = MagicMock()
        mock_fetch.return_value = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo",
                    pr_creation_status="completed",
                    pr_url="https://github.com/owner/repo/pull/1",
                )
            },
        )

        client = SeerExplorerClient(self.organization, self.user, enable_coding=True)
        result = client.push_changes(123, repo_name="owner/repo")

        body = orjson.loads(mock_post.call_args[1]["data"])
        assert body["run_id"] == 123
        assert body["payload"]["type"] == "create_pr"
        assert body["payload"]["repo_name"] == "owner/repo"
        assert result.repo_pr_states["owner/repo"].pr_url == "https://github.com/owner/repo/pull/1"

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    @patch("sentry.seer.explorer.client.requests.post")
    @patch("sentry.seer.explorer.client.time.sleep")
    def test_push_changes_polls_until_complete(
        self, mock_sleep, mock_post, mock_fetch, mock_access
    ):
        """Test that push_changes polls until PR creation completes"""
        mock_access.return_value = (True, None)
        mock_post.return_value = MagicMock()

        creating_state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                "owner/repo": RepoPRState(repo_name="owner/repo", pr_creation_status="creating")
            },
        )
        completed_state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                "owner/repo": RepoPRState(repo_name="owner/repo", pr_creation_status="completed")
            },
        )
        mock_fetch.side_effect = [creating_state, completed_state]

        client = SeerExplorerClient(self.organization, self.user, enable_coding=True)
        result = client.push_changes(123)

        assert mock_fetch.call_count == 2
        assert mock_sleep.call_count == 1
        assert result.repo_pr_states["owner/repo"].pr_creation_status == "completed"

    @patch("sentry.seer.explorer.client.has_seer_explorer_access_with_detail")
    @patch("sentry.seer.explorer.client.fetch_run_status")
    @patch("sentry.seer.explorer.client.requests.post")
    @patch("sentry.seer.explorer.client.time.time")
    def test_push_changes_timeout(self, mock_time, mock_post, mock_fetch, mock_access):
        """Test that push_changes raises TimeoutError after timeout"""
        mock_access.return_value = (True, None)
        mock_post.return_value = MagicMock()
        mock_fetch.return_value = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                "owner/repo": RepoPRState(repo_name="owner/repo", pr_creation_status="creating")
            },
        )
        mock_time.side_effect = [0, 0, 200]  # Exceeds 120s timeout

        client = SeerExplorerClient(self.organization, self.user, enable_coding=True)
        with pytest.raises(TimeoutError, match="PR creation timed out"):
            client.push_changes(123, poll_timeout=120.0)


class TestSeerRunStateCodeChanges(TestCase):
    """Test SeerRunState helper methods for code changes"""

    def test_has_code_changes_no_patches(self):
        """Test has_code_changes with no patches returns (False, True)"""
        state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Hello"),
                    timestamp="2024-01-01T00:00:00Z",
                )
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

        has_changes, is_synced = state.has_code_changes()
        assert has_changes is False
        assert is_synced is True

    def test_has_code_changes_unsynced(self):
        """Test has_code_changes with patches but no PR"""
        state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Fixed"),
                    timestamp="2024-01-01T00:00:00Z",
                    merged_file_patches=[
                        ExplorerFilePatch(
                            repo_name="owner/repo",
                            patch=FilePatch(path="file.py", type="M", added=10, removed=5),
                        )
                    ],
                )
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

        has_changes, is_synced = state.has_code_changes()
        assert has_changes is True
        assert is_synced is False

    def test_has_code_changes_synced(self):
        """Test has_code_changes when changes are synced to PR"""
        state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Fixed"),
                    timestamp="2024-01-01T00:00:00Z",
                    merged_file_patches=[
                        ExplorerFilePatch(
                            repo_name="owner/repo",
                            patch=FilePatch(path="file.py", type="M", added=10, removed=5),
                        )
                    ],
                    pr_commit_shas={"owner/repo": "abc123"},
                )
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo",
                    commit_sha="abc123",
                    pr_creation_status="completed",
                )
            },
        )

        has_changes, is_synced = state.has_code_changes()
        assert has_changes is True
        assert is_synced is True

    def test_get_diffs_by_repo(self):
        """Test get_diffs_by_repo groups merged patches correctly"""
        state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Fixed"),
                    timestamp="2024-01-01T00:00:00Z",
                    merged_file_patches=[
                        ExplorerFilePatch(
                            repo_name="owner/repo1",
                            patch=FilePatch(path="file1.py", type="M", added=10, removed=5),
                        ),
                        ExplorerFilePatch(
                            repo_name="owner/repo2",
                            patch=FilePatch(path="file2.py", type="A", added=20, removed=0),
                        ),
                        ExplorerFilePatch(
                            repo_name="owner/repo1",
                            patch=FilePatch(path="file3.py", type="M", added=5, removed=2),
                        ),
                    ],
                )
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

        result = state.get_diffs_by_repo()
        assert len(result) == 2
        assert len(result["owner/repo1"]) == 2
        assert len(result["owner/repo2"]) == 1

    def test_get_diffs_by_repo_latest_patch_wins(self):
        """Test get_diffs_by_repo returns latest merged patch per file"""
        state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="First edit"),
                    timestamp="2024-01-01T00:00:00Z",
                    merged_file_patches=[
                        ExplorerFilePatch(
                            repo_name="owner/repo1",
                            patch=FilePatch(path="file1.py", type="M", added=10, removed=5),
                        ),
                    ],
                ),
                MemoryBlock(
                    id="block-2",
                    message=Message(role="assistant", content="Second edit"),
                    timestamp="2024-01-01T00:01:00Z",
                    merged_file_patches=[
                        ExplorerFilePatch(
                            repo_name="owner/repo1",
                            patch=FilePatch(path="file1.py", type="A", added=100, removed=0),
                        ),
                    ],
                ),
            ],
            status="completed",
            updated_at="2024-01-01T00:01:00Z",
        )

        result = state.get_diffs_by_repo()
        # Should only have one patch for file1.py (the latest one)
        assert len(result) == 1
        assert len(result["owner/repo1"]) == 1
        assert result["owner/repo1"][0].patch.type == "A"
        assert result["owner/repo1"][0].patch.added == 100
