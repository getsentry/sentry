from unittest.mock import MagicMock, patch

import pytest
from rest_framework.exceptions import PermissionDenied

from sentry.seer.explorer.coding_agent_handoff import launch_coding_agents
from sentry.testutils.cases import TestCase


class TestLaunchCodingAgents(TestCase):
    """Tests for launch_coding_agents function."""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.run_id = 12345

    @patch("sentry.seer.explorer.coding_agent_handoff.features.has")
    def test_raises_permission_denied_without_feature(self, mock_features):
        """Test that PermissionDenied is raised when feature flag is disabled."""
        mock_features.return_value = False

        with pytest.raises(PermissionDenied, match="Feature not available"):
            launch_coding_agents(
                organization=self.organization,
                integration_id=1,
                run_id=self.run_id,
                prompt="Fix the bug",
                repos=["owner/repo"],
            )

    @patch("sentry.seer.explorer.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.explorer.coding_agent_handoff._validate_and_get_integration")
    @patch("sentry.seer.explorer.coding_agent_handoff.features.has")
    def test_successful_launch(self, mock_features, mock_validate, mock_store):
        """Test successful coding agent launch."""
        mock_features.return_value = True

        mock_integration = MagicMock()
        mock_integration.provider = "cursor"
        mock_installation = MagicMock()
        mock_installation.launch.return_value = MagicMock(
            dict=lambda: {"id": "agent-123", "url": "https://cursor.sh/agent"}
        )
        mock_validate.return_value = (mock_integration, mock_installation)

        result = launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=["owner/repo"],
        )

        assert len(result["successes"]) == 1
        assert len(result["failures"]) == 0
        assert result["successes"][0]["repo_name"] == "owner/repo"
        mock_installation.launch.assert_called_once()
        mock_store.assert_called_once()

    @patch("sentry.seer.explorer.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.explorer.coding_agent_handoff._validate_and_get_integration")
    @patch("sentry.seer.explorer.coding_agent_handoff.features.has")
    def test_invalid_repo_format(self, mock_features, mock_validate, mock_store):
        """Test that invalid repo format is handled as failure."""
        mock_features.return_value = True
        mock_integration = MagicMock()
        mock_installation = MagicMock()
        mock_validate.return_value = (mock_integration, mock_installation)

        result = launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=["invalid-repo-no-slash"],
        )

        assert len(result["successes"]) == 0
        assert len(result["failures"]) == 1
        assert "Invalid repository name format" in result["failures"][0]["error_message"]
        mock_installation.launch.assert_not_called()

    @patch("sentry.seer.explorer.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.explorer.coding_agent_handoff._validate_and_get_integration")
    @patch("sentry.seer.explorer.coding_agent_handoff.features.has")
    def test_multiple_repos_partial_failure(self, mock_features, mock_validate, mock_store):
        """Test handling of partial failures across multiple repos."""
        from requests import HTTPError

        mock_features.return_value = True
        mock_integration = MagicMock()
        mock_integration.provider = "cursor"
        mock_installation = MagicMock()
        # First call succeeds, second fails
        mock_installation.launch.side_effect = [
            MagicMock(dict=lambda: {"id": "agent-1"}),
            HTTPError("API Error"),
        ]
        mock_validate.return_value = (mock_integration, mock_installation)

        result = launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=["owner/repo1", "owner/repo2"],
        )

        assert len(result["successes"]) == 1
        assert len(result["failures"]) == 1
        assert result["successes"][0]["repo_name"] == "owner/repo1"
        assert result["failures"][0]["repo_name"] == "owner/repo2"

    @patch("sentry.seer.explorer.coding_agent_handoff.store_coding_agent_states_to_seer")
    @patch("sentry.seer.explorer.coding_agent_handoff._validate_and_get_integration")
    @patch("sentry.seer.explorer.coding_agent_handoff.features.has")
    def test_branch_name_is_sanitized(self, mock_features, mock_validate, mock_store):
        """Test that branch name is sanitized before launch."""
        mock_features.return_value = True
        mock_integration = MagicMock()
        mock_installation = MagicMock()
        mock_installation.launch.return_value = MagicMock(dict=lambda: {"id": "agent-1"})
        mock_validate.return_value = (mock_integration, mock_installation)

        launch_coding_agents(
            organization=self.organization,
            integration_id=1,
            run_id=self.run_id,
            prompt="Fix the bug",
            repos=["owner/repo"],
            branch_name_base="my-fix",
        )

        # Verify launch was called with a sanitized branch name
        launch_request = mock_installation.launch.call_args[0][0]
        assert launch_request.branch_name.startswith("my-fix-")
