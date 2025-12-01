from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

from sentry.seer.autofix.coding_agent import _launch_agents_for_repos
from sentry.seer.autofix.utils import AutofixRequest, AutofixState, AutofixTriggerSource
from sentry.seer.models import SeerApiError, SeerRepoDefinition
from sentry.testutils.cases import TestCase


class TestLaunchAgentsForRepos(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.run_id = 12345

        # Create a basic autofix state with a solution that references a repo
        self.autofix_state = AutofixState(
            run_id=self.run_id,
            request=AutofixRequest(
                organization_id=self.organization.id,
                project_id=self.project.id,
                issue={"id": 1, "title": "Test Issue"},
                repos=[
                    SeerRepoDefinition(
                        provider="github",
                        owner="getsentry",
                        name="sentry",
                        external_id="123456",
                    )
                ],
            ),
            updated_at=datetime.now(UTC),
            status="COMPLETED",
            steps=[
                {
                    "key": "solution",
                    "solution": [
                        {
                            "relevant_code_file": {
                                "repo_name": "getsentry/sentry",
                                "file_path": "test.py",
                            }
                        }
                    ],
                }
            ],
        )

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_auto_create_pr_defaults_to_false_on_seer_api_error(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that auto_create_pr defaults to False when get_project_seer_preferences raises SeerApiError."""
        # Setup: Mock get_project_seer_preferences to raise SeerApiError
        mock_get_preferences.side_effect = SeerApiError("API Error", 500)

        # Mock the prompt response
        mock_get_prompt.return_value = "Test prompt"

        # Mock the installation and its launch method
        mock_installation = MagicMock()
        mock_installation.launch.return_value = {
            "url": "https://example.com/agent",
            "id": "agent-123",
        }

        # Call the function
        _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        # Assert: Verify that launch was called with auto_create_pr=False
        assert mock_installation.launch.called
        launch_request = mock_installation.launch.call_args[0][0]
        assert launch_request.auto_create_pr is False

        # Verify that get_project_seer_preferences was called
        mock_get_preferences.assert_called_once_with(self.project.id)

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_auto_create_pr_uses_preference_when_available(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that auto_create_pr uses the preference value when available."""
        from sentry.seer.models import (
            AutofixHandoffPoint,
            PreferenceResponse,
            SeerAutomationHandoffConfiguration,
            SeerProjectPreference,
        )

        # Setup: Mock get_project_seer_preferences to return a preference with auto_create_pr=True
        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[
                SeerRepoDefinition(
                    provider="github",
                    owner="getsentry",
                    name="sentry",
                    external_id="123456",
                )
            ],
            automation_handoff=SeerAutomationHandoffConfiguration(
                handoff_point=AutofixHandoffPoint.ROOT_CAUSE,
                target="cursor_background_agent",
                integration_id=123,
                auto_create_pr=True,
            ),
        )
        mock_get_preferences.return_value = PreferenceResponse(
            preference=preference, code_mapping_repos=[]
        )

        # Mock the prompt response
        mock_get_prompt.return_value = "Test prompt"

        # Mock the installation and its launch method
        mock_installation = MagicMock()
        mock_installation.launch.return_value = {
            "url": "https://example.com/agent",
            "id": "agent-123",
        }

        # Call the function
        _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        # Assert: Verify that launch was called with auto_create_pr=True
        assert mock_installation.launch.called
        launch_request = mock_installation.launch.call_args[0][0]
        assert launch_request.auto_create_pr is True

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_auto_create_pr_defaults_to_false_when_no_preference(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that auto_create_pr defaults to False when preference is None."""
        from sentry.seer.models import PreferenceResponse

        # Setup: Mock get_project_seer_preferences to return None preference
        mock_get_preferences.return_value = PreferenceResponse(
            preference=None, code_mapping_repos=[]
        )

        # Mock the prompt response
        mock_get_prompt.return_value = "Test prompt"

        # Mock the installation and its launch method
        mock_installation = MagicMock()
        mock_installation.launch.return_value = {
            "url": "https://example.com/agent",
            "id": "agent-123",
        }

        # Call the function
        _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        # Assert: Verify that launch was called with auto_create_pr=False
        assert mock_installation.launch.called
        launch_request = mock_installation.launch.call_args[0][0]
        assert launch_request.auto_create_pr is False

    @patch("sentry.seer.autofix.coding_agent.store_coding_agent_states_to_seer")
    @patch("sentry.seer.autofix.coding_agent.get_coding_agent_prompt")
    @patch("sentry.seer.autofix.coding_agent.get_project_seer_preferences")
    def test_auto_create_pr_defaults_to_false_when_no_automation_handoff(
        self, mock_get_preferences, mock_get_prompt, mock_store_states
    ):
        """Test that auto_create_pr defaults to False when automation_handoff is None."""
        from sentry.seer.models import PreferenceResponse, SeerProjectPreference

        # Setup: Mock get_project_seer_preferences to return preference without automation_handoff
        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[
                SeerRepoDefinition(
                    provider="github",
                    owner="getsentry",
                    name="sentry",
                    external_id="123456",
                )
            ],
            automation_handoff=None,
        )
        mock_get_preferences.return_value = PreferenceResponse(
            preference=preference, code_mapping_repos=[]
        )

        # Mock the prompt response
        mock_get_prompt.return_value = "Test prompt"

        # Mock the installation and its launch method
        mock_installation = MagicMock()
        mock_installation.launch.return_value = {
            "url": "https://example.com/agent",
            "id": "agent-123",
        }

        # Call the function
        _launch_agents_for_repos(
            installation=mock_installation,
            autofix_state=self.autofix_state,
            run_id=self.run_id,
            organization=self.organization,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

        # Assert: Verify that launch was called with auto_create_pr=False
        assert mock_installation.launch.called
        launch_request = mock_installation.launch.call_args[0][0]
        assert launch_request.auto_create_pr is False
