from unittest.mock import MagicMock, patch

from sentry.seer.autofix.autofix_agent import (
    AutofixStep,
    build_step_prompt,
    generate_autofix_handoff_prompt,
    trigger_autofix_explorer,
    trigger_coding_agent_handoff,
)
from sentry.seer.explorer.client_models import Artifact, MemoryBlock, Message, SeerRunState
from sentry.sentry_apps.utils.webhooks import SeerActionType
from sentry.testutils.cases import TestCase


class TestGenerateAutofixHandoffPrompt(TestCase):
    """Tests for generate_autofix_handoff_prompt function."""

    def _make_state_with_artifacts(self, artifacts: list[Artifact]) -> SeerRunState:
        """Helper to create a SeerRunState with given artifacts."""
        return SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Analysis"),
                    timestamp="2024-01-01T00:00:00Z",
                    artifacts=artifacts,
                )
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

    def test_basic_prompt_without_artifacts(self):
        """Test prompt generation with no artifacts."""
        state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

        prompt = generate_autofix_handoff_prompt(state)

        assert "Please fix the following issue" in prompt
        assert "Root Cause" not in prompt
        assert "Solution" not in prompt

    def test_prompt_with_instruction(self):
        """Test that custom instruction is included in prompt."""
        state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

        prompt = generate_autofix_handoff_prompt(state, instruction="Focus on the database layer")

        assert "Focus on the database layer" in prompt

    def test_prompt_with_root_cause_artifact(self):
        """Test prompt includes root cause details."""
        state = self._make_state_with_artifacts(
            [
                Artifact(
                    key="root_cause",
                    data={
                        "one_line_description": "Memory leak in cache handler",
                        "five_whys": ["Cache not cleared", "No TTL set"],
                        "reproduction_steps": ["Step 1", "Step 2"],
                    },
                    reason="Analysis complete",
                )
            ]
        )

        prompt = generate_autofix_handoff_prompt(state)

        assert "## Root Cause Analysis" in prompt
        assert "Memory leak in cache handler" in prompt
        assert "1. Cache not cleared" in prompt
        assert "2. No TTL set" in prompt
        assert "- Step 1" in prompt
        assert "- Step 2" in prompt

    def test_prompt_with_solution_artifact(self):
        """Test prompt includes solution details."""
        state = self._make_state_with_artifacts(
            [
                Artifact(
                    key="solution",
                    data={
                        "one_line_summary": "Add TTL to cache entries",
                        "steps": [
                            {"title": "Step 1", "description": "Add TTL parameter"},
                            {"title": "Step 2", "description": "Update cache config"},
                        ],
                    },
                    reason="Solution generated",
                )
            ]
        )

        prompt = generate_autofix_handoff_prompt(state)

        assert "## Proposed Solution" in prompt
        assert "Add TTL to cache entries" in prompt
        assert "**Step 1**: Add TTL parameter" in prompt
        assert "**Step 2**: Update cache config" in prompt

    def test_prompt_with_both_artifacts(self):
        """Test prompt includes both root cause and solution."""
        state = self._make_state_with_artifacts(
            [
                Artifact(
                    key="root_cause",
                    data={"one_line_description": "Bug in handler"},
                    reason="Found",
                ),
                Artifact(
                    key="solution",
                    data={"one_line_summary": "Fix the handler"},
                    reason="Proposed",
                ),
            ]
        )

        prompt = generate_autofix_handoff_prompt(state)

        assert "## Root Cause Analysis" in prompt
        assert "Bug in handler" in prompt
        assert "## Proposed Solution" in prompt
        assert "Fix the handler" in prompt


class TestBuildStepPrompt(TestCase):
    def setUp(self):
        super().setUp()
        self.group = self.create_group(
            project=self.project,
            message="Test error message",
        )
        self.group.culprit = "app.views.handler"
        self.group.save()

    def test_root_cause_prompt_contains_issue_details(self):
        prompt = build_step_prompt(AutofixStep.ROOT_CAUSE, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "ROOT CAUSE" in prompt
        assert "root_cause artifact" in prompt

    def test_solution_prompt_contains_issue_details(self):
        prompt = build_step_prompt(AutofixStep.SOLUTION, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "solution" in prompt.lower()
        assert "Do NOT implement" in prompt

    def test_code_changes_prompt_contains_issue_details(self):
        prompt = build_step_prompt(AutofixStep.CODE_CHANGES, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "Implement the fix" in prompt

    def test_impact_assessment_prompt_contains_issue_details(self):
        prompt = build_step_prompt(AutofixStep.IMPACT_ASSESSMENT, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "impact" in prompt.lower()
        assert "impact_assessment artifact" in prompt

    def test_triage_prompt_contains_issue_details(self):
        prompt = build_step_prompt(AutofixStep.TRIAGE, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "triage" in prompt.lower()
        assert "suspect_commit" in prompt

    def test_prompt_with_missing_culprit_uses_default(self):
        self.group.culprit = None
        self.group.save()

        prompt = build_step_prompt(AutofixStep.ROOT_CAUSE, self.group)

        assert "unknown" in prompt

    def test_all_prompts_are_dedented(self):
        for step in AutofixStep:
            prompt = build_step_prompt(step, self.group)
            # Dedented prompts should not start with whitespace
            assert not prompt.startswith(" "), f"{step} prompt starts with whitespace"
            assert not prompt.startswith("\t"), f"{step} prompt starts with tab"


class TestTriggerAutofixExplorer(TestCase):
    def setUp(self):
        super().setUp()
        self.group = self.create_group(project=self.project)

    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerExplorerClient")
    def test_trigger_autofix_explorer_sends_started_webhook_for_all_steps(
        self, mock_client_class, mock_broadcast
    ):
        """Sends correct started webhook for all autofix steps."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = 12345
        mock_client.continue_run.return_value = 12345

        step_to_action = {
            AutofixStep.ROOT_CAUSE: SeerActionType.ROOT_CAUSE_STARTED,
            AutofixStep.SOLUTION: SeerActionType.SOLUTION_STARTED,
            AutofixStep.CODE_CHANGES: SeerActionType.CODING_STARTED,
            AutofixStep.IMPACT_ASSESSMENT: SeerActionType.IMPACT_ASSESSMENT_STARTED,
            AutofixStep.TRIAGE: SeerActionType.TRIAGE_STARTED,
        }

        for step, expected_action in step_to_action.items():
            mock_broadcast.reset_mock()
            trigger_autofix_explorer(
                group=self.group,
                step=step,
                run_id=None,
            )
            mock_broadcast.assert_called_once()
            call_kwargs = mock_broadcast.call_args.kwargs
            assert call_kwargs["event_name"] == expected_action.value

    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerExplorerClient")
    def test_trigger_autofix_explorer_sends_started_webhook_for_continued_run(
        self, mock_client_class, mock_broadcast
    ):
        """Sends started webhook when continuing an existing run."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.continue_run.return_value = 67890

        result = trigger_autofix_explorer(
            group=self.group,
            step=AutofixStep.SOLUTION,
            run_id=67890,
        )

        assert result == 67890
        # Verify started webhook was sent with the existing run_id
        mock_broadcast.assert_called_once()
        call_kwargs = mock_broadcast.call_args.kwargs
        assert call_kwargs["event_name"] == SeerActionType.SOLUTION_STARTED.value
        assert call_kwargs["payload"]["run_id"] == 67890


class TestTriggerCodingAgentHandoff(TestCase):
    """Tests for trigger_coding_agent_handoff function."""

    def setUp(self):
        super().setUp()
        self.group = self.create_group(project=self.project)

    def _make_run_state(self, artifacts: list[Artifact] | None = None) -> SeerRunState:
        """Helper to create a SeerRunState with given artifacts."""
        return SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Analysis"),
                    timestamp="2024-01-01T00:00:00Z",
                    artifacts=artifacts or [],
                    merged_file_patches=[],
                )
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={},
        )

    def _make_preference_response(self, repos=None, auto_create_pr=False):
        """Helper to create a PreferenceResponse with repos."""
        from sentry.seer.models import (
            AutofixHandoffPoint,
            PreferenceResponse,
            SeerAutomationHandoffConfiguration,
            SeerProjectPreference,
            SeerRepoDefinition,
        )

        if repos is None:
            repos = [
                SeerRepoDefinition(provider="github", owner="owner", name="repo", external_id="123")
            ]

        handoff_config = (
            SeerAutomationHandoffConfiguration(
                handoff_point=AutofixHandoffPoint.ROOT_CAUSE,
                target="cursor_background_agent",
                integration_id=456,
                auto_create_pr=auto_create_pr,
            )
            if auto_create_pr
            else None
        )

        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=repos,
            automation_handoff=handoff_config,
        )
        return PreferenceResponse(preference=preference, code_mapping_repos=[])

    @patch("sentry.seer.autofix.autofix_agent.get_project_seer_preferences")
    @patch("sentry.seer.autofix.autofix_agent.SeerExplorerClient")
    def test_trigger_coding_agent_handoff_success(self, mock_client_class, mock_get_prefs):
        """Test successful coding agent handoff."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state(
            [
                Artifact(
                    key="root_cause",
                    data={"one_line_description": "Bug found"},
                    reason="test",
                )
            ]
        )
        mock_client.launch_coding_agents.return_value = {
            "successes": [{"repo_name": "owner/repo"}],
            "failures": [],
        }
        mock_get_prefs.return_value = self._make_preference_response()

        result = trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            integration_id=456,
        )

        assert len(result["successes"]) == 1
        mock_client.get_run.assert_called_once_with(123)
        mock_client.launch_coding_agents.assert_called_once()
        # Verify repos came from preferences
        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        assert call_kwargs["repos"] == ["owner/repo"]

    @patch("sentry.seer.autofix.autofix_agent.get_project_seer_preferences")
    @patch("sentry.seer.autofix.autofix_agent.SeerExplorerClient")
    def test_trigger_coding_agent_handoff_no_repos(self, mock_client_class, mock_get_prefs):
        """Test handoff with no repositories in preferences returns failure."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        # Preferences with no repos
        mock_get_prefs.return_value = self._make_preference_response(repos=[])

        result = trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            integration_id=456,
        )

        assert len(result["failures"]) == 1
        assert "No repositories configured" in result["failures"][0]["error_message"]
        mock_client.launch_coding_agents.assert_not_called()

    @patch("sentry.seer.autofix.autofix_agent.get_project_seer_preferences")
    @patch("sentry.seer.autofix.autofix_agent.SeerExplorerClient")
    def test_trigger_coding_agent_handoff_generates_prompt_from_artifacts(
        self, mock_client_class, mock_get_prefs
    ):
        """Test that prompt is generated from run state artifacts."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state(
            [
                Artifact(
                    key="root_cause",
                    data={"one_line_description": "Memory leak in cache"},
                    reason="test",
                ),
                Artifact(
                    key="solution",
                    data={"one_line_summary": "Add TTL to cache"},
                    reason="test",
                ),
            ]
        )
        mock_client.launch_coding_agents.return_value = {"successes": [], "failures": []}
        mock_get_prefs.return_value = self._make_preference_response()

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            integration_id=456,
        )

        # Verify prompt was generated and passed to launch_coding_agents
        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        prompt = call_kwargs["prompt"]
        assert "Memory leak in cache" in prompt
        assert "Add TTL to cache" in prompt

    @patch("sentry.seer.autofix.autofix_agent.get_project_seer_preferences")
    @patch("sentry.seer.autofix.autofix_agent.SeerExplorerClient")
    def test_trigger_coding_agent_handoff_uses_group_title_for_branch(
        self, mock_client_class, mock_get_prefs
    ):
        """Test that branch_name_base is set to the group title."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {"successes": [], "failures": []}
        mock_get_prefs.return_value = self._make_preference_response()

        # Set a specific title on the group
        self.group.message = "NullPointerException in UserService"
        self.group.save()

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            integration_id=456,
        )

        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        assert call_kwargs["branch_name_base"] == self.group.title

    @patch("sentry.seer.autofix.autofix_agent.get_project_seer_preferences")
    @patch("sentry.seer.autofix.autofix_agent.SeerExplorerClient")
    def test_trigger_coding_agent_handoff_fetches_auto_create_pr_from_preferences(
        self, mock_client_class, mock_get_prefs
    ):
        """Test that auto_create_pr is fetched from project preferences."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {"successes": [], "failures": []}

        # Set up preferences with auto_create_pr=True
        mock_get_prefs.return_value = self._make_preference_response(auto_create_pr=True)

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            integration_id=456,
        )

        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        assert call_kwargs["auto_create_pr"] is True

    @patch("sentry.seer.autofix.autofix_agent.get_project_seer_preferences")
    @patch("sentry.seer.autofix.autofix_agent.SeerExplorerClient")
    def test_trigger_coding_agent_handoff_defaults_auto_create_pr_false(
        self, mock_client_class, mock_get_prefs
    ):
        """Test that auto_create_pr defaults to False when automation_handoff not configured."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {"successes": [], "failures": []}
        # Use helper with default args: repos are set but auto_create_pr=False (no handoff config)
        mock_get_prefs.return_value = self._make_preference_response()

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            integration_id=456,
        )

        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        assert call_kwargs["auto_create_pr"] is False

    @patch("sentry.seer.autofix.autofix_agent.get_project_seer_preferences")
    @patch("sentry.seer.autofix.autofix_agent.SeerExplorerClient")
    def test_trigger_coding_agent_handoff_no_preferences_returns_failure(
        self, mock_client_class, mock_get_prefs
    ):
        """Test handoff with None preference response returns failure."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_get_prefs.return_value = None

        result = trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            integration_id=456,
        )

        assert len(result["failures"]) == 1
        assert "No repositories configured" in result["failures"][0]["error_message"]
        mock_client.launch_coding_agents.assert_not_called()
