from datetime import timedelta
from unittest.mock import MagicMock, Mock, patch

import pytest
from cryptography.fernet import Fernet
from django.test import override_settings
from django.utils import timezone
from pydantic import BaseModel

from sentry.hybridcloud.models.outbox import CellOutbox
from sentry.hybridcloud.outbox.category import OutboxCategory
from sentry.hybridcloud.rpc.service import RpcException
from sentry.seer.agent.client import SeerAgentClient, get_monitoring_provider_connections
from sentry.seer.agent.client_models import (
    AgentFilePatch,
    FilePatch,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
)
from sentry.seer.models import SeerApiError, SeerPermissionError
from sentry.seer.models.run import SeerAgentRun, SeerRun, SeerRunMirrorStatus, SeerRunType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import override_options, with_feature
from sentry.testutils.requests import make_request

TEST_FERNET_KEY = Fernet.generate_key().decode("utf-8")


class TestSeerAgentClient(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    def _mock_run_response(self, run_id: int = 123) -> MagicMock:
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": run_id}
        mock_response.status = 200
        return mock_response

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    def test_client_init_checks_access(self, mock_access):
        """Test that client initialization checks base Seer access and raises on denial"""
        mock_access.return_value = (False, "Feature flag not enabled")

        with pytest.raises(SeerPermissionError) as exc_info:
            SeerAgentClient(self.organization, self.user)
        assert "Feature flag not enabled" in str(exc_info.value)

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    def test_client_init_succeeds_with_access(self, mock_access):
        """Test that client initialization succeeds with proper access"""
        mock_access.return_value = (True, None)

        client = SeerAgentClient(self.organization, self.user)
        assert client.organization == self.organization
        assert client.user == self.user

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    def test_client_init_raises_when_coding_option_disabled(self, mock_access):
        """Test that client initialization raises SeerPermissionError when enable_coding is True but org option is disabled"""
        mock_access.return_value = (True, None)
        self.organization.update_option("sentry:enable_seer_coding", False)

        with pytest.raises(SeerPermissionError):
            SeerAgentClient(self.organization, self.user, enable_coding=True)

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    def test_client_init_succeeds_when_coding_option_not_set(self, mock_access):
        """Test that client initialization succeeds when enable_coding is True and org option is not set (interpreted as True by default)"""
        mock_access.return_value = (True, None)
        client = SeerAgentClient(self.organization, self.user, enable_coding=True)
        assert client.enable_coding is True

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    def test_start_run_basic(self, mock_collect_context, mock_post, mock_access):
        """Test starting a new run collects user context"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response()

        project = self.create_project(organization=self.organization)
        group = self.create_group(project=project)

        client = SeerAgentClient(self.organization, self.user, project=project, group=group)
        run = client.start_run("Test query")

        assert run.seer_run_state_id == 123
        mock_collect_context.assert_called_once_with(self.user, self.organization, request=None)
        assert mock_post.called
        body = mock_post.call_args[0][0]
        assert "enable_frontend_code_search" not in body["agent_run_options"]
        assert body["metadata"]["group_id"] == group.id

        agent_run = SeerAgentRun.objects.get(run=run)
        assert agent_run.project_id == project.id
        assert agent_run.group_id == group.id

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    def test_start_run_with_request(self, mock_collect_context, mock_post, mock_access):
        """Test starting a new run passes request object to collect_user_org_context"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response()

        client = SeerAgentClient(self.organization, self.user)
        request, _ = make_request()
        run_id = client.start_run("Test query", request=request).seer_run_state_id

        assert run_id == 123
        mock_collect_context.assert_called_once_with(self.user, self.organization, request=request)
        assert mock_post.called

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_start_run_with_optional_params(self, mock_post, mock_access):
        """Test starting a run with optional parameters"""
        mock_access.return_value = (True, None)
        mock_post.return_value = self._mock_run_response(run_id=789)

        client = SeerAgentClient(self.organization, self.user)
        run_id = client.start_run("Query", on_page_context="some context").seer_run_state_id

        assert run_id == 789
        call_args = mock_post.call_args
        assert call_args is not None

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_start_run_http_error(self, mock_post, mock_access):
        """Test that HTTP errors are propagated"""
        mock_access.return_value = (True, None)
        mock_post.return_value.status = 500

        client = SeerAgentClient(self.organization, self.user)
        with pytest.raises(SeerApiError):
            client.start_run("Test query")

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_start_run_raises_when_seer_rejects_creation(self, mock_post, mock_access):
        """A 4xx from Seer marks the run FAILED during the synchronous drain, so
        start_run raises instead of returning an unmirrored run."""
        mock_access.return_value = (True, None)
        mock_post.return_value = MagicMock(status=400)

        client = SeerAgentClient(self.organization, self.user)
        with pytest.raises(SeerApiError, match="failed during outbox drain"):
            client.start_run("Test query")

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    def test_start_run_with_categories(self, mock_collect_context, mock_post, mock_access):
        """Test starting a run with category fields"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response(run_id=999)

        client = SeerAgentClient(
            self.organization, self.user, category_key="bug-fixer", category_value="issue-123"
        )
        with self.feature("organizations:seer-agent-source-code-search"):
            run_id = client.start_run("Fix bug").seer_run_state_id

        assert run_id == 999
        body = mock_post.call_args[0][0]
        assert body["category_key"] == "bug-fixer"
        assert body["category_value"] == "issue-123"
        assert body["agent_run_options"]["enable_frontend_code_search"] is True

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    def test_start_run_defaults_code_review_disabled(
        self, mock_collect_context, mock_post, mock_access
    ):
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response()

        client = SeerAgentClient(self.organization, self.user)
        client.start_run("Test query")

        body = mock_post.call_args[0][0]
        assert body["agent_run_options"]["code_review_enabled"] is False

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    def test_start_run_passes_code_review_enabled(
        self, mock_collect_context, mock_post, mock_access
    ):
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response()

        client = SeerAgentClient(self.organization, self.user, code_review_enabled=True)
        client.start_run("Test query")

        body = mock_post.call_args[0][0]
        assert body["agent_run_options"]["code_review_enabled"] is True

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    def test_client_init_raises_when_pr_ctx_tools_flag_disabled(self, mock_access):
        mock_access.return_value = (True, None)

        with pytest.raises(SeerPermissionError):
            SeerAgentClient(self.organization, self.user, enable_pr_context_tools=True)

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @with_feature("organizations:autofix-pr-iteration")
    def test_client_init_succeeds_when_pr_ctx_tools_flag_enabled(self, mock_access):
        mock_access.return_value = (True, None)

        client = SeerAgentClient(self.organization, self.user, enable_pr_context_tools=True)
        assert client.enable_pr_context_tools is True

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    def test_start_run_defaults_pr_context_tools_disabled(
        self, mock_collect_context, mock_post, mock_access
    ):
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response()

        client = SeerAgentClient(self.organization, self.user)
        client.start_run("Test query")

        body = mock_post.call_args[0][0]
        assert body["agent_run_options"]["enable_pr_context_tools"] is False

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    @with_feature("organizations:autofix-pr-iteration")
    def test_start_run_passes_enable_pr_context_tools(
        self, mock_collect_context, mock_post, mock_access
    ):
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response()

        client = SeerAgentClient(self.organization, self.user, enable_pr_context_tools=True)
        client.start_run("Test query")

        body = mock_post.call_args[0][0]
        assert body["agent_run_options"]["enable_pr_context_tools"] is True

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    @with_feature("organizations:seer-explorer-embeds")
    def test_start_run_includes_embed_widgets_by_default(
        self, mock_collect_context, mock_post, mock_access
    ):
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response()

        client = SeerAgentClient(self.organization, self.user)
        client.start_run("Test query")

        body = mock_post.call_args[0][0]
        assert "embed_widgets" in body["agent_run_options"]

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    @with_feature("organizations:seer-explorer-embeds")
    def test_start_run_excludes_embed_widgets_when_disabled(
        self, mock_collect_context, mock_post, mock_access
    ):
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response()

        client = SeerAgentClient(self.organization, self.user, enable_embeds=False)
        client.start_run("Test query")

        body = mock_post.call_args[0][0]
        assert "embed_widgets" not in body["agent_run_options"]

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.make_agent_chat_request")
    @with_feature("organizations:seer-explorer-embeds")
    def test_continue_run_includes_embed_widgets_by_default(self, mock_post, mock_access):
        mock_access.return_value = (True, None)
        mock_post.return_value = self._mock_run_response()

        client = SeerAgentClient(self.organization, self.user)
        client.continue_run(123, "Follow-up query")

        body = mock_post.call_args[0][0]
        assert "embed_widgets" in body["agent_run_options"]

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.make_agent_chat_request")
    @with_feature("organizations:seer-explorer-embeds")
    def test_continue_run_excludes_embed_widgets_when_disabled(self, mock_post, mock_access):
        mock_access.return_value = (True, None)
        mock_post.return_value = self._mock_run_response()

        client = SeerAgentClient(self.organization, self.user, enable_embeds=False)
        client.continue_run(123, "Follow-up query")

        body = mock_post.call_args[0][0]
        assert "embed_widgets" not in body["agent_run_options"]

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    def test_init_category_key_only_raises_error(self, mock_access):
        """Test that ValueError is raised when only category_key is provided"""
        mock_access.return_value = (True, None)

        with pytest.raises(
            ValueError, match="category_key and category_value must be provided together"
        ):
            SeerAgentClient(self.organization, self.user, category_key="bug-fixer")

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    def test_init_category_value_only_raises_error(self, mock_access):
        """Test that ValueError is raised when only category_value is provided"""
        mock_access.return_value = (True, None)

        with pytest.raises(
            ValueError, match="category_key and category_value must be provided together"
        ):
            SeerAgentClient(self.organization, self.user, category_value="issue-123")

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    def test_client_init_with_intelligence_level(self, mock_access):
        """Test that intelligence_level is stored"""
        mock_access.return_value = (True, None)

        client = SeerAgentClient(self.organization, self.user, intelligence_level="high")
        assert client.intelligence_level == "high"

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    def test_client_init_default_intelligence_level(self, mock_access):
        """Test that intelligence_level defaults to 'medium'"""
        mock_access.return_value = (True, None)

        client = SeerAgentClient(self.organization, self.user)
        assert client.intelligence_level == "medium"

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    def test_start_run_includes_intelligence_level(
        self, mock_collect_context, mock_post, mock_access
    ):
        """Test that intelligence_level is included in the payload"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response(run_id=555)

        client = SeerAgentClient(self.organization, self.user, intelligence_level="low")
        run_id = client.start_run("Test query").seer_run_state_id

        assert run_id == 555
        body = mock_post.call_args[0][0]
        assert body["intelligence_level"] == "low"

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    def test_client_init_with_max_iterations(self, mock_access):
        """Test that max_iterations is stored"""
        mock_access.return_value = (True, None)

        client = SeerAgentClient(self.organization, self.user, max_iterations=3)
        assert client.max_iterations == 3

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    def test_client_init_default_max_iterations(self, mock_access):
        """Test that max_iterations defaults to None"""
        mock_access.return_value = (True, None)

        client = SeerAgentClient(self.organization, self.user)
        assert client.max_iterations is None

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    def test_start_run_includes_max_iterations(self, mock_collect_context, mock_post, mock_access):
        """Test that max_iterations is included in the payload when set"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response(run_id=444)

        client = SeerAgentClient(self.organization, self.user, max_iterations=3)
        run_id = client.start_run("Test query").seer_run_state_id

        assert run_id == 444
        body = mock_post.call_args[0][0]
        assert body["max_iterations"] == 3

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    def test_start_run_excludes_max_iterations_when_none(
        self, mock_collect_context, mock_post, mock_access
    ):
        """Test that max_iterations is not included in the payload when None"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_post.return_value = self._mock_run_response(run_id=445)

        client = SeerAgentClient(self.organization, self.user)
        run_id = client.start_run("Test query").seer_run_state_id

        assert run_id == 445
        body = mock_post.call_args[0][0]
        assert "max_iterations" not in body

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.make_agent_chat_request")
    def test_continue_run_basic(self, mock_post, mock_access):
        """Test continuing an existing run"""
        mock_access.return_value = (True, None)
        mock_post.return_value = self._mock_run_response(run_id=456)

        client = SeerAgentClient(self.organization, self.user)
        run_id = client.continue_run(456, "Follow up query")

        assert run_id == 456
        assert mock_post.called
        body = mock_post.call_args[0][0]
        assert "enable_frontend_code_search" not in body["agent_run_options"]

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.make_agent_chat_request")
    def test_continue_run_with_all_params(self, mock_post, mock_access):
        """Test continuing a run with all optional parameters"""
        mock_access.return_value = (True, None)
        mock_post.return_value = self._mock_run_response(run_id=789)

        client = SeerAgentClient(self.organization, self.user)
        with self.feature("organizations:seer-agent-source-code-search"):
            run_id = client.continue_run(
                789, "Follow up", insert_index=2, on_page_context="context"
            )

        assert run_id == 789
        body = mock_post.call_args[0][0]
        assert body["agent_run_options"]["enable_frontend_code_search"] is True

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.make_agent_chat_request")
    @with_feature("organizations:autofix-pr-iteration")
    def test_continue_run_passes_enable_pr_context_tools(self, mock_post, mock_access):
        mock_access.return_value = (True, None)
        mock_post.return_value = self._mock_run_response(run_id=789)

        client = SeerAgentClient(self.organization, self.user, enable_pr_context_tools=True)
        client.continue_run(789, "Follow up")

        body = mock_post.call_args[0][0]
        assert body["agent_run_options"]["enable_pr_context_tools"] is True

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.make_agent_chat_request")
    def test_continue_run_http_error(self, mock_post, mock_access):
        """Test that HTTP errors are propagated"""
        mock_access.return_value = (True, None)
        mock_post.return_value.status = 500

        client = SeerAgentClient(self.organization, self.user)
        with pytest.raises(SeerApiError):
            client.continue_run(123, "Test query")

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.make_agent_chat_request")
    def test_continue_run_bumps_last_triggered_at(self, mock_post, mock_access):
        mock_access.return_value = (True, None)
        mock_post.return_value = self._mock_run_response(run_id=456)

        stale = timezone.now() - timedelta(days=10)
        run = self.create_seer_run(seer_run_state_id=456, last_triggered_at=stale)

        client = SeerAgentClient(self.organization, self.user)
        client.continue_run(456, "Follow up query")

        run.refresh_from_db()
        assert run.last_triggered_at > stale

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.fetch_run_status")
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

        client = SeerAgentClient(self.organization, self.user)
        result = client.get_run(123)

        assert result.run_id == 123
        assert result.status == "processing"
        mock_fetch.assert_called_once_with(
            123, self.organization, viewer_context=client.viewer_context
        )

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.poll_until_done")
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

        client = SeerAgentClient(self.organization, self.user)
        result = client.get_run(123, blocking=True, poll_interval=1.0, poll_timeout=30.0)

        assert result.run_id == 123
        assert result.status == "completed"
        mock_poll.assert_called_once_with(
            123, self.organization, 1.0, 30.0, viewer_context=client.viewer_context
        )

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.fetch_run_status")
    def test_get_run_http_error(self, mock_fetch, mock_access):
        """Test that HTTP errors are propagated"""
        mock_access.return_value = (True, None)
        mock_fetch.side_effect = SeerApiError("API Error", 500)

        client = SeerAgentClient(self.organization, self.user)
        with pytest.raises(SeerApiError):
            client.get_run(123)

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.make_agent_runs_request")
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
        mock_response.status = 200
        mock_post.return_value = mock_response

        client = SeerAgentClient(self.organization, self.user)
        runs = client.get_runs(category_key="bug-fixer", category_value="issue-123")

        assert len(runs) == 1
        assert runs[0].category_key == "bug-fixer"
        body = mock_post.call_args[0][0]
        assert body["category_key"] == "bug-fixer"
        assert body["category_value"] == "issue-123"


class TestSeerAgentClientArtifacts(TestCase):
    """Test artifact schema passing and retrieval"""

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    def test_start_run_with_artifact_schema(self, mock_collect_context, mock_post, mock_access):
        """Test that artifact key and schema are serialized and sent to API"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 123}
        mock_response.status = 200
        mock_post.return_value = mock_response

        class IssueAnalysis(BaseModel):
            issue_count: int
            severity: str

        client = SeerAgentClient(self.organization, self.user)
        run_id = client.start_run(
            "Analyze errors", artifact_key="analysis", artifact_schema=IssueAnalysis
        ).seer_run_state_id

        assert run_id == 123

        # Verify artifact_key and artifact_schema were included in payload
        body = mock_post.call_args[0][0]
        assert body["artifact_key"] == "analysis"
        assert "artifact_schema" in body
        assert body["artifact_schema"]["type"] == "object"
        assert "issue_count" in body["artifact_schema"]["properties"]
        assert "severity" in body["artifact_schema"]["properties"]

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_start_run_artifact_schema_requires_key(self, mock_post, mock_access):
        """Test that artifact_schema without artifact_key raises ValueError"""
        mock_access.return_value = (True, None)

        class IssueAnalysis(BaseModel):
            issue_count: int

        client = SeerAgentClient(self.organization, self.user)
        with pytest.raises(
            ValueError, match="artifact_key and artifact_schema must be provided together"
        ):
            client.start_run("Analyze", artifact_schema=IssueAnalysis)

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.make_agent_chat_request")
    @patch("sentry.seer.agent.client.collect_user_org_context")
    def test_continue_run_with_artifact_schema(self, mock_collect_context, mock_post, mock_access):
        """Test continuing a run with a new artifact key and schema"""
        mock_access.return_value = (True, None)
        mock_collect_context.return_value = {"user_id": self.user.id}
        mock_response = MagicMock()
        mock_response.json.return_value = {"run_id": 123}
        mock_response.status = 200
        mock_post.return_value = mock_response

        class Solution(BaseModel):
            description: str
            steps: list[str]

        client = SeerAgentClient(self.organization, self.user)
        run_id = client.continue_run(
            123, "Propose a fix", artifact_key="solution", artifact_schema=Solution
        )

        assert run_id == 123

        body = mock_post.call_args[0][0]
        assert body["artifact_key"] == "solution"
        assert "artifact_schema" in body
        assert body["artifact_schema"]["type"] == "object"
        assert "description" in body["artifact_schema"]["properties"]

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.make_agent_chat_request")
    def test_continue_run_artifact_schema_requires_key(self, mock_post, mock_access):
        """Test that artifact_schema without artifact_key raises ValueError"""
        mock_access.return_value = (True, None)

        class Solution(BaseModel):
            description: str

        client = SeerAgentClient(self.organization, self.user)
        with pytest.raises(
            ValueError, match="artifact_key and artifact_schema must be provided together"
        ):
            client.continue_run(123, "Fix it", artifact_schema=Solution)

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.fetch_run_status")
    def test_get_run_with_artifacts_on_blocks(self, mock_fetch, mock_access):
        """Test that artifacts on blocks are returned and can be retrieved typed"""
        from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message

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

        client = SeerAgentClient(self.organization, self.user)
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

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.fetch_run_status")
    def test_get_artifact_returns_none_when_missing(self, mock_fetch, mock_access):
        """Test that get_artifact returns None for missing or pending artifacts"""
        from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message

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

        client = SeerAgentClient(self.organization, self.user)
        result = client.get_run(123)

        # Missing key returns None
        assert result.get_artifact("nonexistent", MySchema) is None
        # Pending artifact (data=None) returns None
        assert result.get_artifact("pending", MySchema) is None

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.fetch_run_status")
    def test_get_run_with_multiple_artifacts_on_blocks(self, mock_fetch, mock_access):
        """Test retrieving multiple artifacts from blocks in a multi-step run"""
        from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message

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

        client = SeerAgentClient(self.organization, self.user)
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

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.fetch_run_status")
    def test_get_artifacts_returns_latest_version(self, mock_fetch, mock_access):
        """Test that get_artifacts returns the latest version when artifact is updated"""
        from sentry.seer.agent.client_models import Artifact, MemoryBlock, Message

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

        client = SeerAgentClient(self.organization, self.user)
        result = client.get_run(123)

        # Should get the latest version
        root_cause = result.get_artifact("root_cause", RootCause)
        assert root_cause is not None
        assert root_cause.cause == "New cause"


class TestSeerAgentClientPushChanges(TestCase):
    """Test push_changes method"""

    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.fetch_run_status")
    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_push_changes_sends_correct_payload(self, mock_post, mock_fetch, mock_access):
        """Test that push_changes sends correct payload"""
        mock_access.return_value = (True, None)
        mock_post.return_value = MagicMock(status=200)
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

        client = SeerAgentClient(self.organization, self.user, enable_coding=True)
        result = client.push_changes(123, repo_name="owner/repo")

        body = mock_post.call_args[0][0]
        assert body["run_id"] == 123
        assert body["payload"]["type"] == "create_pr"
        assert body["payload"]["repo_name"] == "owner/repo"
        assert result is not None
        assert result.repo_pr_states["owner/repo"].pr_url == "https://github.com/owner/repo/pull/1"

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.fetch_run_status")
    @patch("sentry.seer.agent.client.make_agent_update_request")
    @patch("sentry.seer.agent.client.time.sleep")
    def test_push_changes_polls_until_complete(
        self, mock_sleep, mock_post, mock_fetch, mock_access
    ):
        """Test that push_changes polls until PR creation completes"""
        mock_access.return_value = (True, None)
        mock_post.return_value = MagicMock(status=200)

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

        client = SeerAgentClient(self.organization, self.user, enable_coding=True)
        result = client.push_changes(123)

        assert mock_fetch.call_count == 2
        assert mock_sleep.call_count == 1
        assert result is not None
        assert result.repo_pr_states["owner/repo"].pr_creation_status == "completed"

    @patch("sentry.seer.agent.client.has_seer_access_with_detail")
    @patch("sentry.seer.agent.client.fetch_run_status")
    @patch("sentry.seer.agent.client.make_agent_update_request")
    @patch("sentry.seer.agent.client.time.sleep")
    @patch("sentry.seer.agent.client.time.time")
    def test_push_changes_timeout(self, mock_time, mock_sleep, mock_post, mock_fetch, mock_access):
        """Test that push_changes raises TimeoutError after timeout"""
        mock_access.return_value = (True, None)
        mock_post.return_value = MagicMock(status=200)
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

        # get_option call in client init interferes with the mock time.time() - patch it
        self.organization.get_option = MagicMock(return_value=True)
        client = SeerAgentClient(self.organization, self.user, enable_coding=True)

        with pytest.raises(TimeoutError, match="PR creation timed out"):
            client.push_changes(123, poll_timeout=120.0)


class TestSeerRunStateCodeChanges(TestCase):
    """Test SeerRunState helper methods for code changes"""

    def test_has_code_changes_no_patches(self) -> None:
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

    def test_has_code_changes_unsynced(self) -> None:
        """Test has_code_changes with patches but no PR"""
        state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Fixed"),
                    timestamp="2024-01-01T00:00:00Z",
                    merged_file_patches=[
                        AgentFilePatch(
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

    def test_has_code_changes_synced(self) -> None:
        """Test has_code_changes when changes are synced to PR"""
        state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Fixed"),
                    timestamp="2024-01-01T00:00:00Z",
                    merged_file_patches=[
                        AgentFilePatch(
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

    def test_get_diffs_by_repo(self) -> None:
        """Test get_diffs_by_repo groups merged patches correctly"""
        state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Fixed"),
                    timestamp="2024-01-01T00:00:00Z",
                    merged_file_patches=[
                        AgentFilePatch(
                            repo_name="owner/repo1",
                            patch=FilePatch(path="file1.py", type="M", added=10, removed=5),
                        ),
                        AgentFilePatch(
                            repo_name="owner/repo2",
                            patch=FilePatch(path="file2.py", type="A", added=20, removed=0),
                        ),
                        AgentFilePatch(
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

    def test_get_diffs_by_repo_latest_patch_wins(self) -> None:
        """Test get_diffs_by_repo returns latest merged patch per file"""
        state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="First edit"),
                    timestamp="2024-01-01T00:00:00Z",
                    merged_file_patches=[
                        AgentFilePatch(
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
                        AgentFilePatch(
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


class TestStartRunExplorerIndexTrigger(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)
        access_patcher = patch(
            "sentry.seer.agent.client.has_seer_access_with_detail",
            return_value=(True, None),
        )
        access_patcher.start()
        self.addCleanup(access_patcher.stop)
        context_patcher = patch(
            "sentry.seer.agent.client.collect_user_org_context",
            return_value={},
        )
        context_patcher.start()
        self.addCleanup(context_patcher.stop)

    def _mock_chat_response(self, run_id: int = 123, **flags: bool | None) -> MagicMock:
        mock_response = MagicMock()
        mock_response.status = 200
        mock_response.json.return_value = {"run_id": run_id, **flags}
        return mock_response

    @patch("sentry.seer.agent.client.dispatch_explorer_index_projects")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_triggers_indexing_when_explorer_index_missing(self, mock_chat, mock_dispatch):
        mock_chat.return_value = self._mock_chat_response(has_explorer_index=False)
        mock_dispatch.return_value = iter([])
        project = self.create_project(organization=self.organization)
        project.flags.has_transactions = True
        project.save()

        client = SeerAgentClient(self.organization, self.user)
        with self.options({"seer.explorer_index.killswitch.enable": False}):
            run_id = client.start_run("Why are my errors spiking?").seer_run_state_id

        assert run_id == 123
        mock_dispatch.assert_called_once()
        projects_batch = list(mock_dispatch.call_args[0][0])
        assert (project.id, self.organization.id) in projects_batch

    @patch("sentry.seer.agent.client.index_org_project_knowledge")
    @patch("sentry.seer.agent.client.build_service_map")
    @patch("sentry.seer.agent.client.dispatch_explorer_index_projects")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_triggers_indexing_when_org_project_context_missing(
        self, mock_chat, mock_dispatch, mock_build_service_map, mock_index_knowledge
    ):
        mock_chat.return_value = self._mock_chat_response(has_org_project_context=False)
        mock_dispatch.return_value = iter([])
        project = self.create_project(organization=self.organization)
        project.flags.has_transactions = True
        project.save()

        client = SeerAgentClient(self.organization, self.user)
        with self.options(
            {
                "seer.explorer_index.killswitch.enable": False,
                "explorer.context_engine_indexing.enable": True,
            }
        ):
            run_id = client.start_run("Why are my errors spiking?").seer_run_state_id

        assert run_id == 123
        mock_dispatch.assert_not_called()
        mock_index_knowledge.apply_async.assert_called_once_with(args=[self.organization.id])
        mock_build_service_map.apply_async.assert_called_once_with(args=[self.organization.id])

    @patch("sentry.seer.agent.client.dispatch_explorer_index_projects")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_excludes_projects_without_transactions_from_batch(self, mock_chat, mock_dispatch):
        mock_chat.return_value = self._mock_chat_response(has_explorer_index=False)
        mock_dispatch.return_value = iter([])
        project_with_txns = self.create_project(organization=self.organization)
        project_with_txns.flags.has_transactions = True
        project_with_txns.save()
        project_without_txns = self.create_project(organization=self.organization)

        client = SeerAgentClient(self.organization, self.user)
        with self.options({"seer.explorer_index.killswitch.enable": False}):
            client.start_run("Why are my errors spiking?")

        projects_batch = list(mock_dispatch.call_args[0][0])
        assert (project_with_txns.id, self.organization.id) in projects_batch
        assert (project_without_txns.id, self.organization.id) not in projects_batch

    @patch("sentry.seer.agent.client.dispatch_explorer_index_projects")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_skips_indexing_when_index_present(self, mock_chat, mock_dispatch):
        mock_chat.return_value = self._mock_chat_response(
            has_explorer_index=True, has_org_project_context=True
        )

        client = SeerAgentClient(self.organization, self.user)
        run_id = client.start_run("Why are my errors spiking?").seer_run_state_id

        assert run_id == 123
        mock_dispatch.assert_not_called()

    @patch("sentry.seer.agent.client.dispatch_explorer_index_projects")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_skips_indexing_when_flags_absent_from_response(self, mock_chat, mock_dispatch):
        mock_chat.return_value = self._mock_chat_response()

        client = SeerAgentClient(self.organization, self.user)
        run_id = client.start_run("Why are my errors spiking?").seer_run_state_id

        assert run_id == 123
        mock_dispatch.assert_not_called()

    @patch("sentry.seer.agent.client.index_org_project_knowledge")
    @patch("sentry.seer.agent.client.build_service_map")
    @patch("sentry.seer.agent.client.dispatch_explorer_index_projects")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_skips_indexing_when_killswitch_on(
        self, mock_chat, mock_dispatch, mock_build_service_map, mock_index_knowledge
    ):
        mock_chat.return_value = self._mock_chat_response(
            has_explorer_index=False, has_org_project_context=False
        )
        project = self.create_project(organization=self.organization)
        project.flags.has_transactions = True
        project.save()

        client = SeerAgentClient(self.organization, self.user)
        with self.options(
            {
                "seer.explorer_index.killswitch.enable": True,
                "explorer.context_engine_indexing.enable": True,
            }
        ):
            client.start_run("Why are my errors spiking?")

        mock_dispatch.assert_not_called()
        mock_index_knowledge.apply_async.assert_not_called()
        mock_build_service_map.apply_async.assert_not_called()

    @patch("sentry.seer.agent.client.dispatch_explorer_index_projects")
    @patch("sentry.receivers.outbox.cell.make_agent_chat_request")
    def test_skips_indexing_when_no_projects_with_transactions(self, mock_chat, mock_dispatch):
        mock_chat.return_value = self._mock_chat_response(has_explorer_index=False)
        self.create_project(organization=self.organization)

        client = SeerAgentClient(self.organization, self.user)
        with self.options({"seer.explorer_index.killswitch.enable": False}):
            client.start_run("Why are my errors spiking?")

        mock_dispatch.assert_not_called()


class TestStartFeatureRun(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    def _outbox_for(self, run: SeerRun) -> CellOutbox | None:
        return CellOutbox.objects.filter(
            category=OutboxCategory.SEER_RUN_CREATE, object_identifier=run.id
        ).first()

    @patch("sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None))
    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_flush_false_enqueues_without_dispatch(self, mock_request, _mock_access) -> None:
        client = SeerAgentClient(self.organization, self.user)
        run = client.start_feature_run(
            feature_id="night_shift",
            payload={"candidates": [1, 2]},
            title="Agentic triage (2 candidates)",
            flush=False,
        )

        mock_request.assert_not_called()
        assert run.type == SeerRunType.FEATURE_RUN
        assert run.mirror_status == SeerRunMirrorStatus.PENDING
        assert run.seer_run_state_id is None
        assert run.user_id == self.user.id

        outbox = self._outbox_for(run)
        assert outbox is not None
        assert outbox.payload is not None
        body = outbox.payload["body"]
        assert body["feature_id"] == "night_shift"
        # ref/external_idempotency_key are stamped by the handler at dispatch, not enqueue.
        assert "ref" not in body
        assert outbox.payload["viewer_context"]["organization_id"] == self.organization.id

    @patch("sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None))
    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_creates_agent_run_mirror(self, mock_request, _mock_access) -> None:
        client = SeerAgentClient(self.organization, self.user)
        run = client.start_feature_run(
            feature_id="night_shift",
            payload={"candidates": [1, 2]},
            flush=False,
            title="Agentic triage (2 candidates)",
            extras={"foo": "bar"},
        )

        agent_run = SeerAgentRun.objects.get(run=run)
        assert agent_run.title == "Agentic triage (2 candidates)"
        assert agent_run.source == "night_shift"
        assert agent_run.extras == {"foo": "bar"}
        assert run.referrer == "night_shift"

    @patch("sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None))
    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_truncates_long_title(self, mock_request, _mock_access) -> None:
        client = SeerAgentClient(self.organization, self.user)
        run = client.start_feature_run(
            feature_id="night_shift", payload={}, flush=False, title="x" * 300
        )

        agent_run = SeerAgentRun.objects.get(run=run)
        assert agent_run.title == "x" * 255 + "…"
        assert len(agent_run.title) == 256

    @patch("sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None))
    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_creates_agent_run_mirror_extras_default_to_empty(
        self, mock_request, _mock_access
    ) -> None:
        client = SeerAgentClient(self.organization, self.user)
        run = client.start_feature_run(
            feature_id="night_shift",
            payload={"candidates": [1, 2]},
            title="Agentic triage (2 candidates)",
            flush=False,
        )

        agent_run = SeerAgentRun.objects.get(run=run)
        assert agent_run.title == "Agentic triage (2 candidates)"
        assert agent_run.source == "night_shift"
        assert agent_run.extras == {}

    @patch("sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None))
    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_on_run_created_still_called_alongside_agent_run_mirror(
        self, mock_request, _mock_access
    ) -> None:
        linked: list[SeerRun] = []

        client = SeerAgentClient(self.organization, self.user)
        run = client.start_feature_run(
            feature_id="night_shift",
            payload={"candidates": [1, 2]},
            title="Agentic triage (2 candidates)",
            flush=False,
            on_run_created=linked.append,
        )

        assert linked == [run]
        assert SeerAgentRun.objects.filter(run=run).exists()

    @patch("sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None))
    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_flush_true_dispatches_inline_and_mirrors(self, mock_request, _mock_access) -> None:
        mock_request.return_value = Mock(status=200, json=Mock(return_value={"run_id": 4242}))

        client = SeerAgentClient(self.organization, self.user)
        run = client.start_feature_run(
            feature_id="night_shift", payload={}, title="Test feature run"
        )

        assert run.mirror_status == SeerRunMirrorStatus.LIVE
        assert run.seer_run_state_id == 4242
        sent_body = mock_request.call_args.args[0]
        assert sent_body["feature_id"] == "night_shift"
        assert sent_body["ref"] == str(run.uuid)
        assert sent_body["external_idempotency_key"] == str(run.uuid)
        assert self._outbox_for(run) is None

    @patch("sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None))
    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_flush_true_dispatch_failure_marks_failed_and_raises(
        self, mock_request, _mock_access
    ) -> None:
        mock_request.return_value = Mock(status=400)

        client = SeerAgentClient(self.organization, self.user)
        with pytest.raises(SeerApiError):
            client.start_feature_run(feature_id="night_shift", payload={}, title="Test feature run")

        run = SeerRun.objects.get(organization=self.organization, type=SeerRunType.FEATURE_RUN)
        assert run.mirror_status == SeerRunMirrorStatus.FAILED
        assert run.seer_run_state_id is None

    def test_access_gate_blocks_dispatch(self) -> None:
        # No gen-ai-features -> client construction raises before any run is created.
        with pytest.raises(SeerPermissionError):
            SeerAgentClient(self.organization, self.user)
        assert not SeerRun.objects.filter(organization=self.organization).exists()

    @patch("sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None))
    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    @with_feature("organizations:seer-added")
    @override_options({"seer.explorer.context-engine-rollout": 1.0})
    def test_inherits_context_engine_from_org(self, mock_request, _mock_access) -> None:
        client = SeerAgentClient(self.organization, self.user)
        run = client.start_feature_run(
            feature_id="night_shift", payload={}, title="Test feature run", flush=False
        )

        outbox = self._outbox_for(run)
        assert outbox is not None and outbox.payload is not None
        body = outbox.payload["body"]
        assert body["agent_run_options"]["is_context_engine_enabled"] is True

    @patch("sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None))
    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    @with_feature("organizations:seer-agent-source-code-search")
    def test_inherits_frontend_code_search_from_org(self, mock_request, _mock_access) -> None:
        client = SeerAgentClient(self.organization, self.user)
        run = client.start_feature_run(
            feature_id="night_shift", payload={}, title="Test feature run", flush=False
        )

        outbox = self._outbox_for(run)
        assert outbox is not None and outbox.payload is not None
        body = outbox.payload["body"]
        assert body["agent_run_options"]["enable_frontend_code_search"] is True

    @patch("sentry.seer.agent.client.has_seer_access_with_detail", return_value=(True, None))
    @patch("sentry.receivers.outbox.cell.make_feature_run_request")
    def test_agent_run_options_empty_without_org_flags(self, mock_request, _mock_access) -> None:
        client = SeerAgentClient(self.organization, self.user)
        run = client.start_feature_run(
            feature_id="night_shift", payload={}, title="Test feature run", flush=False
        )

        outbox = self._outbox_for(run)
        assert outbox is not None and outbox.payload is not None
        body = outbox.payload["body"]
        assert body["agent_run_options"] == {}


@override_settings(SEER_GHE_ENCRYPT_KEY=TEST_FERNET_KEY)
@with_feature("organizations:seer-infra-telemetry")
class TestGetMonitoringProviderConnections(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = self.create_user()
        self.organization = self.create_organization(owner=self.user)

    def test_returns_empty_when_no_identities(self) -> None:
        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    def test_returns_connection(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="org-uuid-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={
                "access_token": "access-token",
                "refresh_token": "refresh-token",
                "client_id": "dd-client-id",
                "client_secret": "dd-client-secret",
                "site": "datadoghq.com",
            },
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert result is not None
        assert len(result) == 1
        connection = result[0]
        assert connection["provider_key"] == "datadog"
        assert connection["url"] == "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp"
        assert connection["identity_id"] == identity.id
        assert connection["auth_method"] == "oauth"
        fernet = Fernet(TEST_FERNET_KEY.encode("utf-8"))
        decrypted_access_token = fernet.decrypt(
            connection["encrypted_access_token"].encode("utf-8")
        ).decode("utf-8")
        assert decrypted_access_token == "access-token"

    def test_returns_multiple_connections(self) -> None:
        for site, ext_id in [("datadoghq.com", "org-1"), ("datadoghq.eu", "org-2")]:
            idp = self.create_identity_provider(type="datadog", external_id=ext_id)
            identity = self.create_identity(
                user=self.user,
                identity_provider=idp,
                external_id=f"user-{ext_id}",
                data={"access_token": "access-token", "site": site},
            )
            self.create_organization_identity(
                organization=self.organization,
                identity=identity,
            )

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert result is not None
        assert len(result) == 2
        urls = {c["url"] for c in result}
        assert "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp" in urls
        assert "https://mcp.datadoghq.eu/api/unstable/mcp-server/mcp" in urls

    def test_cross_org_isolation(self) -> None:
        org2 = self.create_organization(name="other-org", owner=self.user)

        idp = self.create_identity_provider(type="datadog", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"access_token": "access-token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        result_org1 = get_monitoring_provider_connections(self.organization, self.user.id)
        assert len(result_org1) == 1
        assert result_org1[0]["provider_key"] == "datadog"

        result_org2 = get_monitoring_provider_connections(org2, self.user.id)
        assert result_org2 == []

    def test_skips_identity_missing_access_token(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    def test_skips_identity_missing_site(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"access_token": "access-token"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    def test_ignores_non_monitoring_provider_identities(self) -> None:
        idp = self.create_identity_provider(type="slack", external_id="slack-team")
        self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="slack-user-1",
            data={"access_token": "access-token"},
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    @override_settings(SEER_GHE_ENCRYPT_KEY=None)
    def test_skips_identity_when_encryption_fails(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"access_token": "access-token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    @with_feature({"organizations:seer-infra-telemetry": False})
    def test_returns_empty_when_feature_disabled(self) -> None:
        idp = self.create_identity_provider(type="datadog", external_id="org-1")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="dd-user-1",
            data={"access_token": "access-token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    @patch(
        "sentry.seer.agent.client.identity_service.get_org_user_identities_by_provider_type",
        side_effect=RpcException("identity", "get_org_user_identities_by_provider_type", "boom"),
    )
    def test_degrades_when_identity_service_errors(self, mock_get: MagicMock) -> None:
        # A control-silo RPC failure must not propagate (it would stall the outbox shard).
        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    def test_returns_gcp_connections(self) -> None:
        idp = self.create_identity_provider(type="gcp", external_id="")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="gcp-user-1",
            data={
                "access_token": "gcp-access-token",
                "refresh_token": "gcp-refresh-token",
            },
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert len(result) == 3
        urls = {c["url"] for c in result}
        assert urls == {
            "https://logging.googleapis.com/mcp",
            "https://monitoring.googleapis.com/mcp",
            "https://cloudtrace.googleapis.com/mcp",
        }
        for connection in result:
            assert connection["provider_key"] == "gcp"
            assert connection["identity_id"] == identity.id
            assert connection["auth_method"] == "oauth"
            fernet = Fernet(TEST_FERNET_KEY.encode("utf-8"))
            decrypted = fernet.decrypt(connection["encrypted_access_token"].encode("utf-8")).decode(
                "utf-8"
            )
            assert decrypted == "gcp-access-token"

    def test_gcp_and_datadog_connections_together(self) -> None:
        gcp_idp = self.create_identity_provider(type="gcp", external_id="")
        gcp_identity = self.create_identity(
            user=self.user,
            identity_provider=gcp_idp,
            external_id="gcp-user-1",
            data={"access_token": "gcp-token"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=gcp_identity,
        )

        dd_idp = self.create_identity_provider(type="datadog", external_id="dd-org-1")
        dd_identity = self.create_identity(
            user=self.user,
            identity_provider=dd_idp,
            external_id="dd-user-1",
            data={"access_token": "dd-token", "site": "datadoghq.com"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=dd_identity,
        )

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert len(result) == 4
        gcp_connections = [c for c in result if c["provider_key"] == "gcp"]
        dd_connections = [c for c in result if c["provider_key"] == "datadog"]
        assert len(gcp_connections) == 3
        assert len(dd_connections) == 1

    def test_gcp_skips_identity_missing_access_token(self) -> None:
        idp = self.create_identity_provider(type="gcp", external_id="")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="gcp-user-1",
            data={"refresh_token": "refresh-only"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        assert get_monitoring_provider_connections(self.organization, self.user.id) == []

    @patch("sentry.seer.agent.client.encrypt_access_token_for_seer")
    def test_gcp_token_encrypted_once(self, mock_encrypt: MagicMock) -> None:
        mock_encrypt.return_value = "encrypted-token"

        idp = self.create_identity_provider(type="gcp", external_id="")
        identity = self.create_identity(
            user=self.user,
            identity_provider=idp,
            external_id="gcp-user-1",
            data={"access_token": "gcp-token"},
        )
        self.create_organization_identity(
            organization=self.organization,
            identity=identity,
        )

        result = get_monitoring_provider_connections(self.organization, self.user.id)

        assert len(result) == 3
        mock_encrypt.assert_called_once_with("gcp-token")
