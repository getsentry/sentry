from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from rest_framework.exceptions import PermissionDenied

from sentry.constants import DataCategory
from sentry.seer.agent.client_models import (
    Artifact,
    MemoryBlock,
    Message,
    SeerRunState,
)
from sentry.seer.autofix.autofix_agent import (
    STEP_CONFIGS,
    AutofixStep,
    NoSeerQuotaException,
    build_step_prompt,
    generate_autofix_handoff_prompt,
    trigger_autofix_agent,
    trigger_coding_agent_handoff,
    trigger_push_changes,
)
from sentry.seer.autofix.constants import AutofixReferrer, AutofixStatus
from sentry.seer.autofix.utils import AutofixRequest, AutofixState
from sentry.seer.models import SeerPermissionError, SeerRepoDefinition
from sentry.seer.models.project_repository import SeerProjectRepository
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

    def test_basic_prompt_without_artifacts(self) -> None:
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

    def test_prompt_with_instruction(self) -> None:
        """Test that custom instruction is included in prompt."""
        state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

        prompt = generate_autofix_handoff_prompt(state, instruction="Focus on the database layer")

        assert "Focus on the database layer" in prompt

    def test_prompt_with_root_cause_artifact(self) -> None:
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

    def test_prompt_with_solution_artifact(self) -> None:
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

    def test_prompt_with_both_artifacts(self) -> None:
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

    def test_prompt_with_short_id(self) -> None:
        """Test that short_id is included in prompt when provided."""
        state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

        prompt = generate_autofix_handoff_prompt(state, short_id="AIML-2301")

        assert "Include 'Fixes AIML-2301' in the commit message" in prompt

    def test_prompt_without_short_id(self) -> None:
        """Test that 'Fixes' is not in prompt when short_id is None."""
        state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

        prompt = generate_autofix_handoff_prompt(state, short_id=None)

        assert "Fixes" not in prompt

    def test_prompt_with_short_id_and_instruction(self) -> None:
        """Test that both short_id and instruction are included."""
        state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
        )

        prompt = generate_autofix_handoff_prompt(
            state, instruction="Focus on performance", short_id="PROJ-123"
        )

        assert "Include 'Fixes PROJ-123' in the commit message" in prompt
        assert "Focus on performance" in prompt


class TestBuildStepPrompt(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(
            project=self.project,
            message="Test error message",
        )
        self.group.culprit = "app.views.handler"
        self.group.save()

    def test_root_cause_prompt_contains_issue_details(self) -> None:
        prompt = build_step_prompt(AutofixStep.ROOT_CAUSE, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "ROOT CAUSE" in prompt
        assert "root_cause artifact" in prompt

    def test_solution_prompt_contains_issue_details(self) -> None:
        prompt = build_step_prompt(AutofixStep.SOLUTION, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "solution" in prompt.lower()
        assert "Do NOT implement" in prompt

    def test_code_changes_prompt_contains_issue_details(self) -> None:
        prompt = build_step_prompt(AutofixStep.CODE_CHANGES, self.group)

        assert self.group.qualified_short_id in prompt
        assert self.group.title in prompt
        assert "app.views.handler" in prompt
        assert "Implement the fix" in prompt

    def test_prompt_with_missing_culprit_uses_default(self) -> None:
        self.group.culprit = None
        self.group.save()

        prompt = build_step_prompt(AutofixStep.ROOT_CAUSE, self.group)

        assert "unknown" in prompt

    def test_all_prompts_are_dedented(self) -> None:
        for step in AutofixStep:
            prompt = build_step_prompt(step, self.group)
            # Dedented prompts should not start with whitespace
            assert not prompt.startswith(" "), f"{step} prompt starts with whitespace"
            assert not prompt.startswith("\t"), f"{step} prompt starts with tab"


class TestTriggerAutofixAgent(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def _make_run_state(self, group_id: int | None = None) -> SeerRunState:
        return SeerRunState(
            run_id=67890,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            metadata={"group_id": group_id if group_id is not None else self.group.id},
        )

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_autofix_agent_sends_started_webhook_for_all_steps(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
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
        }

        for step, expected_action in step_to_action.items():
            mock_broadcast.reset_mock()
            trigger_autofix_agent(
                group=self.group,
                step=step,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=None,
            )
            mock_broadcast.assert_called_once()
            call_kwargs = mock_broadcast.call_args.kwargs
            assert call_kwargs["event_name"] == expected_action.value

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_autofix_agent_sends_started_webhook_for_continued_run(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        """Sends started webhook when continuing an existing run."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.continue_run.return_value = 67890

        result = trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.SOLUTION,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=67890,
        )

        assert result == 67890
        # Verify started webhook was sent with the existing run_id
        mock_broadcast.assert_called_once()
        call_kwargs = mock_broadcast.call_args.kwargs
        assert call_kwargs["event_name"] == SeerActionType.SOLUTION_STARTED.value
        assert call_kwargs["payload"]["run_id"] == 67890

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_autofix_agent_passes_project_to_client(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        """SeerAgentClient is constructed with project from the group."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = 123

        trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.ROOT_CAUSE,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=None,
        )

        mock_client_class.assert_called_once()
        call_kwargs = mock_client_class.call_args.kwargs
        assert call_kwargs["project"] == self.group.project

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_autofix_agent_passes_group_id_in_metadata(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        """start_run is called with metadata containing group_id even without stopping_point."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = 123

        trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.ROOT_CAUSE,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=None,
        )

        mock_client.start_run.assert_called_once()
        call_kwargs = mock_client.start_run.call_args.kwargs
        assert call_kwargs["metadata"] == {"group_id": self.group.id, "referrer": "unknown"}

    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=False)
    def test_when_no_quota(self, mock_check_quota, mock_client_class):
        with pytest.raises(NoSeerQuotaException):
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.ROOT_CAUSE,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=None,
            )
        mock_check_quota.assert_called_once_with(
            org_id=self.group.organization.id,
            data_category=DataCategory.SEER_AUTOFIX,
        )
        mock_client_class.assert_not_called()

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_records_seer_run_for_new_run(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = 12345

        trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.ROOT_CAUSE,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=None,
        )

        mock_record_run.assert_called_once_with(
            self.group.organization.id, self.group.project.id, DataCategory.SEER_AUTOFIX
        )

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_does_not_record_seer_run_for_continued_run(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.continue_run.return_value = 67890

        trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.SOLUTION,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=67890,
        )

        mock_record_run.assert_not_called()

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=False)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_continued_run_permitted_with_no_remaining_budget(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.continue_run.return_value = 67890

        run_id = trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.SOLUTION,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=67890,
        )

        assert run_id == 67890
        mock_client.continue_run.assert_called_once()
        mock_check_quota.assert_not_called()
        mock_record_run.assert_not_called()

    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_continued_run_requires_matching_group(self, mock_client_class, mock_broadcast):
        other_group = self.create_group(project=self.project)
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state(group_id=other_group.id)

        with pytest.raises(SeerPermissionError, match="Unknown run id for group"):
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.SOLUTION,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=67890,
            )

        mock_client.continue_run.assert_not_called()
        mock_broadcast.assert_not_called()

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_reasoning_effort_falls_back_to_step_config_default(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = 123

        trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.ROOT_CAUSE,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=None,
        )

        assert (
            mock_client_class.call_args.kwargs["reasoning_effort"]
            == STEP_CONFIGS[AutofixStep.ROOT_CAUSE].reasoning_effort
        )

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_explicit_none_reasoning_effort_bypasses_step_default(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        # Guard against the step default drifting to None and making this test
        # pass coincidentally.
        assert STEP_CONFIGS[AutofixStep.ROOT_CAUSE].reasoning_effort is not None

        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = 123

        trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.ROOT_CAUSE,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=None,
            reasoning_effort=None,
        )

        assert mock_client_class.call_args.kwargs["reasoning_effort"] is None


class TestTriggerCodingAgentHandoff(TestCase):
    """Tests for trigger_coding_agent_handoff function."""

    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def _make_run_state(
        self, artifacts: list[Artifact] | None = None, group_id: int | None = None
    ) -> SeerRunState:
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
            metadata={"group_id": group_id if group_id is not None else self.group.id},
        )

    def _make_repo_and_projectrepo(
        self,
        *,
        owner: str = "owner",
        name: str = "repo",
        external_id: str = "123",
        branch_name: str | None = None,
    ) -> None:
        """Create a Repository and link it to self.project via SeerProjectRepository."""
        repository = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id=external_id,
            name=f"{owner}/{name}",
        )
        SeerProjectRepository.objects.create(
            project=self.project,
            repository=repository,
            branch_name=branch_name,
        )

    def _make_handoff(self, *, auto_create_pr: bool) -> None:
        """Set project options so read_preference_from_sentry_db populates automation_handoff."""
        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", "cursor_background_agent"
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 456)
        self.project.update_option("sentry:seer_automation_handoff_auto_create_pr", auto_create_pr)

    @patch("sentry.seer.autofix.autofix_agent.get_autofix_state")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_success(self, mock_client_class, mock_get_autofix_state):
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
        self._make_repo_and_projectrepo()
        mock_get_autofix_state.return_value = None

        result = trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        assert len(result["successes"]) == 1
        mock_client.get_run.assert_called_once_with(123)
        mock_client.launch_coding_agents.assert_called_once()
        # Verify repos came from preferences (as SeerRepoDefinition objects)
        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        repos = call_kwargs["repos"]
        assert len(repos) == 1
        assert repos[0].owner == "owner"
        assert repos[0].name == "repo"

    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_no_repos(self, mock_client_class):
        """Test handoff with no repositories in preferences returns failure."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        result = trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        assert len(result["failures"]) == 1
        assert "No repositories configured" in result["failures"][0]["error_message"]
        mock_client.launch_coding_agents.assert_not_called()

    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_rejects_run_from_different_group(self, mock_client_class):
        other_group = self.create_group(project=self.project)
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state(group_id=other_group.id)
        self._make_repo_and_projectrepo()

        with pytest.raises(SeerPermissionError, match="Unknown run id for group"):
            trigger_coding_agent_handoff(
                group=self.group,
                run_id=123,
                referrer=AutofixReferrer.UNKNOWN,
                integration_id=456,
            )

        mock_client.launch_coding_agents.assert_not_called()

    @patch("sentry.seer.autofix.autofix_agent.get_autofix_state")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_generates_prompt_from_artifacts(
        self, mock_client_class, mock_get_autofix_state
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
        mock_client.launch_coding_agents.return_value = {
            "successes": [],
            "failures": [],
        }
        self._make_repo_and_projectrepo()
        mock_get_autofix_state.return_value = None

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        # Verify prompt was generated and passed to launch_coding_agents
        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        prompt = call_kwargs["prompt"]
        assert "Memory leak in cache" in prompt
        assert "Add TTL to cache" in prompt

    @patch("sentry.seer.autofix.autofix_agent.get_autofix_state")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_uses_group_title_for_branch(
        self, mock_client_class, mock_get_autofix_state
    ):
        """Test that branch_name_base is set to the group title."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {
            "successes": [],
            "failures": [],
        }
        self._make_repo_and_projectrepo()
        mock_get_autofix_state.return_value = None

        # Set a specific title on the group
        self.group.message = "NullPointerException in UserService"
        self.group.save()

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        assert call_kwargs["branch_name_base"] == self.group.title

    @patch("sentry.seer.autofix.autofix_agent.get_autofix_state")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_fetches_auto_create_pr_from_preferences(
        self, mock_client_class, mock_get_autofix_state
    ):
        """Test that auto_create_pr is fetched from project preferences."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {
            "successes": [],
            "failures": [],
        }
        self._make_repo_and_projectrepo()
        self._make_handoff(auto_create_pr=True)
        mock_get_autofix_state.return_value = None

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        assert call_kwargs["auto_create_pr"] is True

    @patch("sentry.seer.autofix.autofix_agent.get_autofix_state")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_defaults_auto_create_pr_false(
        self, mock_client_class, mock_get_autofix_state
    ):
        """Test that auto_create_pr defaults to False when automation_handoff not configured."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {
            "successes": [],
            "failures": [],
        }
        # Repos are set but auto_create_pr=False (no handoff config)
        self._make_repo_and_projectrepo()
        mock_get_autofix_state.return_value = None

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        assert call_kwargs["auto_create_pr"] is False

    @patch("sentry.seer.autofix.autofix_agent.get_autofix_state")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_filters_to_relevant_repo(
        self, mock_client_class, mock_get_autofix_state
    ):
        """Test that only the repo named in relevant_repo is passed to launch_coding_agents."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state(
            [
                Artifact(
                    key="root_cause",
                    data={"one_line_description": "Bug", "relevant_repo": "owner/relevant-repo"},
                    reason="test",
                )
            ]
        )
        mock_client.launch_coding_agents.return_value = {"successes": [], "failures": []}
        self._make_repo_and_projectrepo(name="relevant-repo", external_id="1")
        self._make_repo_and_projectrepo(name="other-repo", external_id="2")
        mock_get_autofix_state.return_value = None

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        repos = mock_client.launch_coding_agents.call_args.kwargs["repos"]
        assert len(repos) == 1
        assert repos[0].name == "relevant-repo"

    @patch("sentry.seer.autofix.autofix_agent.get_autofix_state")
    @patch("sentry.seer.autofix.autofix_agent.logger")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_falls_back_to_first_repo_when_no_relevant_repo(
        self, mock_client_class, mock_logger, mock_get_autofix_state
    ):
        """Test that when relevant_repo is absent, first configured repo is used and a warning is logged."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state(
            [Artifact(key="root_cause", data={"one_line_description": "Bug"}, reason="test")]
        )
        mock_client.launch_coding_agents.return_value = {"successes": [], "failures": []}
        self._make_repo_and_projectrepo(name="first-repo", external_id="1")
        self._make_repo_and_projectrepo(name="second-repo", external_id="2")
        mock_get_autofix_state.return_value = None

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        repos = mock_client.launch_coding_agents.call_args.kwargs["repos"]
        assert len(repos) == 1
        assert repos[0].name == "first-repo"
        mock_logger.warning.assert_called_once_with(
            "autofix.coding_agent_handoff.no_relevant_repo",
            extra={
                "organization_id": self.group.organization.id,
                "run_id": 123,
                "project_id": self.group.project_id,
            },
        )

    @patch("sentry.seer.autofix.autofix_agent.get_autofix_state")
    @patch("sentry.seer.autofix.autofix_agent.logger")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_falls_back_when_relevant_repo_doesnt_match(
        self, mock_client_class, mock_logger, mock_get_autofix_state
    ):
        """Test that when relevant_repo doesn't match any configured repo, first repo is used."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state(
            [
                Artifact(
                    key="root_cause",
                    data={"one_line_description": "Bug", "relevant_repo": "owner/nonexistent-repo"},
                    reason="test",
                )
            ]
        )
        mock_client.launch_coding_agents.return_value = {"successes": [], "failures": []}
        self._make_repo_and_projectrepo(name="first-repo", external_id="1")
        self._make_repo_and_projectrepo(name="second-repo", external_id="2")
        mock_get_autofix_state.return_value = None

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        repos = mock_client.launch_coding_agents.call_args.kwargs["repos"]
        assert len(repos) == 1
        assert repos[0].name == "first-repo"
        mock_logger.warning.assert_called_once_with(
            "autofix.coding_agent_handoff.relevant_repo_not_found",
            extra={
                "organization_id": self.group.organization.id,
                "run_id": 123,
                "project_id": self.group.project_id,
                "relevant_repo": "owner/nonexistent-repo",
            },
        )

    def test_raises_permission_denied_when_coding_disabled(self):
        self.organization.update_option("sentry:enable_seer_coding", False)

        with pytest.raises(PermissionDenied, match="Code generation is disabled"):
            trigger_coding_agent_handoff(
                group=self.group,
                run_id=123,
                referrer=AutofixReferrer.UNKNOWN,
                integration_id=456,
            )

    @patch("sentry.seer.autofix.autofix_agent.get_autofix_state")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_enriches_branch_name_from_autofix_state(
        self, mock_client_class, mock_get_autofix_state
    ):
        """Test that branch_name is resolved from autofix state when unset in preferences."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {"successes": [], "failures": []}
        self._make_repo_and_projectrepo(external_id="1")
        mock_get_autofix_state.return_value = AutofixState(
            run_id=123,
            request=AutofixRequest(
                organization_id=self.organization.id,
                project_id=self.project.id,
                issue={
                    "id": 1,
                    "title": "Bug",
                    "short_id": "PROJ-1",
                    "first_seen": "2024-01-01T00:00:00Z",
                },
                repos=[
                    SeerRepoDefinition(
                        provider="integrations:github",
                        owner="owner",
                        name="repo",
                        external_id="1",
                        branch_name="main",
                    )
                ],
            ),
            updated_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            status=AutofixStatus.COMPLETED,
        )

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        repos = mock_client.launch_coding_agents.call_args.kwargs["repos"]
        assert repos[0].branch_name == "main"

    @patch("sentry.seer.autofix.autofix_agent.get_autofix_state")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_keeps_branch_name_from_preferences_when_set(
        self, mock_client_class, mock_get_autofix_state
    ):
        """Test that branch_name from preferences is used as-is when already set."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {"successes": [], "failures": []}
        self._make_repo_and_projectrepo(external_id="1", branch_name="release/v2")

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        mock_get_autofix_state.assert_not_called()
        repos = mock_client.launch_coding_agents.call_args.kwargs["repos"]
        assert repos[0].branch_name == "release/v2"


class TestTriggerPushChanges(TestCase):
    """Tests for trigger_push_changes function."""

    def setUp(self):
        super().setUp()
        self.group = self.create_group(project=self.project)

    def test_raises_permission_denied_when_coding_disabled(self):
        self.organization.update_option("sentry:enable_seer_coding", False)

        with pytest.raises(PermissionDenied, match="Code generation is disabled"):
            trigger_push_changes(
                group=self.group,
                run_id=123,
                referrer=AutofixReferrer.UNKNOWN,
            )

    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_passes_correct_pr_description_suffix(self, mock_post):
        """push_changes is called with pr_description_suffix matching the group's qualified short id."""
        mock_post.return_value = MagicMock(status=200)
        state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={},
            metadata={"group_id": self.group.id},
        )

        with self.feature("organizations:gen-ai-features"):
            trigger_push_changes(
                group=self.group,
                run_id=123,
                referrer=AutofixReferrer.UNKNOWN,
                state=state,
            )

        body = mock_post.call_args[0][0]
        assert body["payload"]["pr_description_suffix"] == f"Fixes {self.group.qualified_short_id}"
