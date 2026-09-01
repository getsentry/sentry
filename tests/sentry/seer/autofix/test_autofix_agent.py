from unittest.mock import MagicMock, patch

import pytest
from rest_framework.exceptions import PermissionDenied

from sentry.constants import DataCategory
from sentry.models.activity import Activity
from sentry.seer.agent.client_models import (
    Artifact,
    MemoryBlock,
    Message,
    RepoPRState,
    SeerRunState,
)
from sentry.seer.autofix.autofix_agent import (
    STEP_CONFIGS,
    AutofixStep,
    NoSeerQuotaException,
    PrIterationNoPullRequestException,
    PrIterationNotEnabledException,
    _build_base_shas_metadata,
    build_step_prompt,
    generate_autofix_handoff_prompt,
    get_iteration_for_insert_index,
    get_iterations,
    get_latest_iteration_index,
    trigger_autofix_agent,
    trigger_coding_agent_handoff,
    trigger_push_changes,
)
from sentry.seer.autofix.commit_author import SeerCommitAuthor
from sentry.seer.autofix.constants import AutofixReferrer
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.models import SeerPermissionError
from sentry.sentry_apps.utils.webhooks import SeerActionType
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.utils import json


def _make_scm_mock(*, get_repository=None, get_branch=None):
    """Build an SCM mock that satisfies the runtime_checkable Get*Protocol checks.

    MagicMock attributes are invisible to ``inspect.getattr_static``, which Python 3.12's
    ``runtime_checkable`` ``isinstance()`` uses, so the methods must be real class attributes.
    """
    return type(
        "FakeSCM",
        (),
        {
            "get_repository": MagicMock(return_value=get_repository),
            "get_branch": MagicMock(return_value=get_branch),
        },
    )()


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
        assert "briefly explains the root cause and the solution" in prompt
        assert "not on the proposed solution below" in prompt
        assert "triggered by a Seer handoff from Sentry" in prompt
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

    def test_solution_prompt_without_should_run_repo_checks_skips_testing(self) -> None:
        prompt = build_step_prompt(AutofixStep.SOLUTION, self.group)

        assert "Do NOT include testing as part of your plan." in prompt

    def test_solution_prompt_with_should_run_repo_checks_plans_verification(self) -> None:
        prompt = build_step_prompt(AutofixStep.SOLUTION, self.group, should_run_repo_checks=True)

        assert "Do NOT include testing as part of your plan." not in prompt
        assert "End your plan with a verification step" in prompt

    def test_code_changes_prompt_without_should_run_repo_checks_omits_checks(self) -> None:
        prompt = build_step_prompt(AutofixStep.CODE_CHANGES, self.group)

        assert "linter" not in prompt

    def test_code_changes_prompt_with_should_run_repo_checks_includes_checks(self) -> None:
        prompt = build_step_prompt(
            AutofixStep.CODE_CHANGES, self.group, should_run_repo_checks=True
        )

        assert "Run the linter/formatter over the files you changed." in prompt
        assert "Run the tests covering the code you changed" in prompt

    def test_prompt_with_missing_culprit_uses_default(self) -> None:
        self.group.culprit = None
        self.group.save()

        prompt = build_step_prompt(AutofixStep.ROOT_CAUSE, self.group)

        assert "unknown" in prompt

    def test_all_prompts_are_dedented(self) -> None:
        for step in STEP_CONFIGS:
            prompt = build_step_prompt(step, self.group)
            # Dedented prompts should not start with whitespace
            assert not prompt.startswith(" "), f"{step} prompt starts with whitespace"
            assert not prompt.startswith("\t"), f"{step} prompt starts with tab"


def _iteration_block(iteration_index: int | None = None) -> MemoryBlock:
    metadata: dict[str, str] = {"step": AutofixStep.PR_ITERATION.value}
    if iteration_index is not None:
        metadata["iteration_index"] = str(iteration_index)
    return MemoryBlock(
        id=f"block-{iteration_index}",
        message=Message(role="assistant", content="iteration", metadata=metadata),
        timestamp="2024-01-01T00:00:00Z",
    )


def _plain_block(id: str, role: str = "assistant") -> MemoryBlock:
    return MemoryBlock(
        id=id,
        message=Message(role=role, content="content"),
        timestamp="2024-01-01T00:00:00Z",
    )


def _state_with_blocks(
    blocks: list[MemoryBlock],
    group_id: int | None = None,
    repo_pr_states: dict[str, RepoPRState] | None = None,
) -> SeerRunState:
    return SeerRunState(
        run_id=67890,
        blocks=blocks,
        status="completed",
        updated_at="2024-01-01T00:00:00Z",
        repo_pr_states=repo_pr_states or {},
        metadata={"group_id": group_id} if group_id is not None else None,
    )


class TestIterationHelpers(TestCase):
    def test_get_iterations_returns_empty_without_iterations(self) -> None:
        state = _state_with_blocks([])
        assert get_iterations(state) == []

    def test_get_iterations_returns_index_and_start_index(self) -> None:
        state = _state_with_blocks(
            [
                MemoryBlock(
                    id="block-0",
                    message=Message(role="assistant", content="not iteration"),
                    timestamp="2024-01-01T00:00:00Z",
                ),
                _iteration_block(1),
                _iteration_block(2),
            ]
        )

        iterations = get_iterations(state)

        assert [(it.index, it.start_index) for it in iterations] == [(1, 1), (2, 2)]

    def test_get_iterations_captures_following_blocks(self) -> None:
        state = _state_with_blocks(
            [
                _plain_block("before"),
                _iteration_block(1),
                _plain_block("a1"),
                _plain_block("a2"),
                _iteration_block(2),
                _plain_block("b1"),
            ]
        )

        iterations = get_iterations(state)

        assert [it.index for it in iterations] == [1, 2]
        assert [[b.id for b in it.blocks] for it in iterations] == [
            ["block-1", "a1", "a2"],
            ["block-2", "b1"],
        ]

    def test_get_iterations_missing_iteration_index_raises(self) -> None:
        state = _state_with_blocks([_iteration_block()])
        with pytest.raises(AssertionError):
            get_iterations(state)

    @patch("sentry.seer.autofix.autofix_agent.sentry_sdk.capture_message")
    def test_get_iterations_missing_feedback_reports_without_raising(
        self, mock_capture: MagicMock
    ) -> None:
        # _iteration_block intentionally omits feedback metadata.
        state = _state_with_blocks([_iteration_block(1)])

        iterations = get_iterations(state)

        assert [it.index for it in iterations] == [1]
        mock_capture.assert_called_once()
        assert mock_capture.call_args.args[0] == "PR_ITERATION block missing feedback metadata"
        assert mock_capture.call_args.kwargs["level"] == "warning"
        assert mock_capture.call_args.kwargs["extras"]["run_id"] == 67890
        assert mock_capture.call_args.kwargs["extras"]["iteration_index"] == "1"

    def test_get_latest_iteration_index_returns_zero_without_iterations(self) -> None:
        state = _state_with_blocks([])
        assert get_latest_iteration_index(state) == 0

    def test_get_latest_iteration_index_returns_most_recent(self) -> None:
        state = _state_with_blocks([_iteration_block(1), _iteration_block(2)])
        assert get_latest_iteration_index(state) == 2

    def test_get_iteration_for_insert_index(self) -> None:
        state = _state_with_blocks([_iteration_block(1), _iteration_block(2)])
        assert get_iteration_for_insert_index(state, 1) == 2


class TestPrIterationPrompt(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project, message="Test error message")

    def test_pr_iteration_prompt_includes_pr_links(self) -> None:
        state = _state_with_blocks([])
        state.repo_pr_states = {
            "owner/repo": RepoPRState(repo_name="owner/repo", pr_url="https://example.com/pull/7")
        }
        prompt = build_step_prompt(AutofixStep.PR_ITERATION, self.group, run_state=state)

        assert "Iterate on the pull request" in prompt
        assert "owner/repo" in prompt
        assert "https://example.com/pull/7" in prompt

    def test_pr_iteration_prompt_without_run_state_omits_pr_links(self) -> None:
        prompt = build_step_prompt(AutofixStep.PR_ITERATION, self.group)

        assert "Iterate on the pull request" in prompt
        assert "pull request(s)" not in prompt


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
    @patch("sentry.seer.autofix.autofix_agent.SeerAutofixOperator.has_access", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.process_autofix_updates.apply_async")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_autofix_agent_sends_started_webhook_for_all_steps(
        self,
        mock_client_class,
        mock_process_autofix_updates,
        mock_broadcast,
        mock_has_access,
        mock_check_quota,
        mock_record_run,
    ):
        """Sends correct started webhook for all autofix steps."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = MagicMock(seer_run_state_id=12345)

        step_to_action = {
            AutofixStep.ROOT_CAUSE: (
                SeerActionType.ROOT_CAUSE_STARTED,
                ActivityType.SEER_RCA_STARTED,
            ),
            AutofixStep.SOLUTION: (
                SeerActionType.SOLUTION_STARTED,
                ActivityType.SEER_SOLUTION_STARTED,
            ),
            AutofixStep.CODE_CHANGES: (
                SeerActionType.CODING_STARTED,
                ActivityType.SEER_CODING_STARTED,
            ),
        }

        for step, (expected_action, expected_activity_type) in step_to_action.items():
            mock_broadcast.reset_mock()
            mock_process_autofix_updates.reset_mock()

            def assert_activity_exists(**_kwargs: object) -> None:
                assert Activity.objects.filter(
                    group=self.group,
                    type=expected_activity_type.value,
                ).exists()

            mock_process_autofix_updates.side_effect = assert_activity_exists
            trigger_autofix_agent(
                group=self.group,
                step=step,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=None,
            )
            mock_broadcast.assert_called_once()
            call_kwargs = mock_broadcast.call_args.kwargs
            assert call_kwargs["event_name"] == expected_action.value
            assert (
                mock_process_autofix_updates.call_args.kwargs["kwargs"]["activity_already_recorded"]
                is True
            )

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
        seer_run = self.create_seer_run(
            organization=self.group.organization, seer_run_state_id=67890
        )
        mock_client.continue_run.return_value = seer_run

        result = trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.SOLUTION,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=67890,
        )

        assert result == seer_run
        # Verify started webhook was sent with the existing run_id and uuid
        mock_broadcast.assert_called_once()
        call_kwargs = mock_broadcast.call_args.kwargs
        assert call_kwargs["event_name"] == SeerActionType.SOLUTION_STARTED.value
        assert call_kwargs["payload"]["run_id"] == 67890
        assert call_kwargs["payload"]["sentry_run_id"] == str(seer_run.uuid)

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_autofix_agent_passes_project_and_group_to_client(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        """SeerAgentClient is constructed with project and group from the group."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = MagicMock(seer_run_state_id=123)

        trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.ROOT_CAUSE,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=None,
        )

        mock_client_class.assert_called_once()
        call_kwargs = mock_client_class.call_args.kwargs
        assert call_kwargs["project"] == self.group.project
        assert call_kwargs["group"] == self.group

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix_rca.dispatch.trigger_autofix_rca_feature")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_root_cause_routes_to_rca_feature_when_flagged(
        self, mock_client_class, mock_feature, mock_broadcast, mock_check_quota, mock_record_run
    ):
        """With the flag on, a new root-cause run dispatches the autofix_rca feature
        instead of a legacy explorer run, still emits the started webhook, and
        returns the feature run."""
        feature_run = self.create_seer_run(
            organization=self.group.organization, type="feature_run", seer_run_state_id=777
        )
        mock_feature.return_value = feature_run

        with self.feature("organizations:autofix-rca-in-seer"):
            result = trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.ROOT_CAUSE,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=None,
            )

        assert result == feature_run
        mock_feature.assert_called_once()
        assert mock_feature.call_args.args[0] == self.group
        # legacy explorer run is not started for a flagged root-cause kickoff
        mock_client_class.return_value.start_run.assert_not_called()
        # the started webhook still fires, pointing at the feature run
        mock_broadcast.assert_called_once()
        payload = mock_broadcast.call_args.kwargs["payload"]
        assert (
            mock_broadcast.call_args.kwargs["event_name"] == SeerActionType.ROOT_CAUSE_STARTED.value
        )
        assert payload["run_id"] == 777
        assert payload["sentry_run_id"] == str(feature_run.uuid)

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix_rca.dispatch.trigger_autofix_rca_feature")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_rca_feature_receives_stopping_point(
        self, mock_client_class, mock_feature, mock_broadcast, mock_check_quota, mock_record_run
    ):
        """The stopping point must reach the feature: delivery reads it back off the
        run to decide whether to continue the pipeline past root cause."""
        mock_feature.return_value = self.create_seer_run(
            organization=self.group.organization, type="feature_run", seer_run_state_id=777
        )

        with self.feature("organizations:autofix-rca-in-seer"):
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.ROOT_CAUSE,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=None,
                stopping_point=AutofixStoppingPoint.CODE_CHANGES,
            )

        assert mock_feature.call_args.kwargs["stopping_point"] == AutofixStoppingPoint.CODE_CHANGES

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix_rca.dispatch.trigger_autofix_rca_feature")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_rca_feature_receives_run_options(
        self, mock_client_class, mock_feature, mock_broadcast, mock_check_quota, mock_record_run
    ):
        mock_feature.return_value = self.create_seer_run(
            organization=self.group.organization, type="feature_run", seer_run_state_id=777
        )
        user = self.create_user()

        with self.feature("organizations:autofix-rca-in-seer"):
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.ROOT_CAUSE,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=None,
                user=user,
                enable_bash_tools=True,
            )

        assert mock_feature.call_args.kwargs["user"] == user
        assert mock_feature.call_args.kwargs["enable_bash_tools"] is True

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix_rca.dispatch.trigger_autofix_rca_feature")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_night_shift_repo_checks_force_bash_tools_on_the_feature(
        self, mock_client_class, mock_feature, mock_broadcast, mock_check_quota, mock_record_run
    ):
        with (
            self.feature("organizations:autofix-rca-in-seer"),
            self.feature("organizations:autofix-should-run-repo-checks"),
        ):
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.ROOT_CAUSE,
                referrer=AutofixReferrer.NIGHT_SHIFT,
                run_id=None,
            )

        assert mock_feature.call_args.kwargs["enable_bash_tools"] is True

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix_rca.dispatch.trigger_autofix_rca_feature")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_solution_step_does_not_route_to_rca_feature(
        self, mock_client_class, mock_feature, mock_check_quota, mock_record_run
    ):
        """Only the root-cause step routes; solution kickoffs stay on the legacy flow."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = self.create_seer_run(
            organization=self.group.organization, seer_run_state_id=5
        )

        with self.feature("organizations:autofix-rca-in-seer"):
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.SOLUTION,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=None,
            )

        mock_feature.assert_not_called()
        mock_client.start_run.assert_called_once()

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix_rca.dispatch.trigger_autofix_rca_feature")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_root_cause_uses_legacy_flow_without_flag(
        self, mock_client_class, mock_feature, mock_check_quota, mock_record_run
    ):
        """Without the flag, root-cause kickoffs use the legacy explorer run."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        seer_run = self.create_seer_run(organization=self.group.organization, seer_run_state_id=9)
        mock_client.start_run.return_value = seer_run

        result = trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.ROOT_CAUSE,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=None,
        )

        assert result == seer_run
        mock_feature.assert_not_called()
        mock_client.start_run.assert_called_once()

    @patch("sentry.quotas.backend.check_seer_quota", return_value=False)
    @patch("sentry.seer.autofix_rca.dispatch.trigger_autofix_rca_feature")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_flagged_root_cause_still_enforces_quota(
        self, mock_client_class, mock_feature, mock_check_quota
    ):
        """The upstream quota check runs before routing to the feature."""
        with self.feature("organizations:autofix-rca-in-seer"):
            with pytest.raises(NoSeerQuotaException):
                trigger_autofix_agent(
                    group=self.group,
                    step=AutofixStep.ROOT_CAUSE,
                    referrer=AutofixReferrer.UNKNOWN,
                    run_id=None,
                )

        mock_feature.assert_not_called()

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_autofix_agent_metadata_omits_group_id(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        """group_id is injected by the client from its group, not hand-built here."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = MagicMock(seer_run_state_id=123)

        trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.ROOT_CAUSE,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=None,
        )

        mock_client.start_run.assert_called_once()
        call_kwargs = mock_client.start_run.call_args.kwargs
        assert call_kwargs["metadata"] == {
            "group_id": self.group.id,
            "referrer": "unknown",
        }

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_pr_iteration_continued_run_increments_iteration_index(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        """Continuing a PR iteration run computes the next iteration index and surfaces it."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = _state_with_blocks(
            [_iteration_block(1)],
            group_id=self.group.id,
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_url="https://example.com/pull/7"
                )
            },
        )
        mock_client.continue_run.return_value = self.create_seer_run(
            organization=self.group.organization, seer_run_state_id=67890
        )

        with self.feature("organizations:autofix-pr-iteration"):
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.PR_ITERATION,
                referrer=AutofixReferrer.GITHUB_PR_COMMENT,
                run_id=67890,
            )

        call_kwargs = mock_broadcast.call_args.kwargs
        assert call_kwargs["event_name"] == SeerActionType.ITERATION_STARTED.value
        assert call_kwargs["payload"]["iteration_index"] == 2
        assert "referrer" not in call_kwargs["payload"]

    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_pr_iteration_requires_existing_pr(self, mock_client_class, mock_broadcast):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = _state_with_blocks([], group_id=self.group.id)

        with (
            self.feature("organizations:autofix-pr-iteration"),
            pytest.raises(PrIterationNoPullRequestException),
        ):
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.PR_ITERATION,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=67890,
            )

        mock_client.continue_run.assert_not_called()
        mock_broadcast.assert_not_called()

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_pr_iteration_enabled_by_either_flag(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        """Automated CI iteration and manual iteration each enable the PR_ITERATION step.

        Automated CI iteration runs under ``autofix-pr-iteration`` and manual
        iteration under the ``-manual`` variant, so either flag alone is enough and
        neither flag rejects the step.
        """
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = _state_with_blocks(
            [_iteration_block(1)],
            group_id=self.group.id,
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_url="https://example.com/pull/7"
                )
            },
        )
        mock_client.continue_run.return_value = self.create_seer_run(
            organization=self.group.organization, seer_run_state_id=67890
        )

        def trigger() -> None:
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.PR_ITERATION,
                referrer=AutofixReferrer.GITHUB_PR_COMMENT,
                run_id=67890,
            )

        with pytest.raises(PrIterationNotEnabledException):
            trigger()
        mock_client.continue_run.assert_not_called()

        with self.feature("organizations:autofix-pr-iteration"):
            trigger()
        assert mock_client.continue_run.call_count == 1

        with self.feature("organizations:autofix-pr-iteration-manual"):
            trigger()
        assert mock_client.continue_run.call_count == 2

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
        mock_client.start_run.return_value = MagicMock(seer_run_state_id=12345)

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
        mock_client.continue_run.return_value = self.create_seer_run(
            organization=self.group.organization, seer_run_state_id=67890
        )

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
        seer_run = self.create_seer_run(
            organization=self.group.organization, seer_run_state_id=67890
        )
        mock_client.continue_run.return_value = seer_run

        run = trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.SOLUTION,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=67890,
        )

        assert run == seer_run

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
    def test_code_review_always_disabled(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = MagicMock(seer_run_state_id=123)

        trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.CODE_CHANGES,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=None,
        )

        assert mock_client_class.call_args.kwargs["code_review_enabled"] is False

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_pr_context_tools_disabled_on_non_pr_iteration_step(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = MagicMock(seer_run_state_id=123)

        trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.ROOT_CAUSE,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=None,
        )

        assert mock_client_class.call_args.kwargs["enable_pr_context_tools"] is False

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_pr_context_tools_enabled_on_pr_iteration_step(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = _state_with_blocks(
            [_iteration_block(1)],
            group_id=self.group.id,
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_url="https://example.com/pull/7"
                )
            },
        )
        mock_client.continue_run.return_value = self.create_seer_run(
            organization=self.group.organization, seer_run_state_id=67890
        )

        with self.feature("organizations:autofix-pr-iteration"):
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.PR_ITERATION,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=67890,
            )

        assert mock_client_class.call_args.kwargs["enable_pr_context_tools"] is True

    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_commit_author_serialized_into_iteration_metadata(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run
    ):
        author = SeerCommitAuthor(name="Mona", email="1+octocat@users.noreply.github.com")
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = _state_with_blocks(
            [_iteration_block(1)],
            group_id=self.group.id,
            repo_pr_states={
                "owner/repo": RepoPRState(
                    repo_name="owner/repo", pr_url="https://example.com/pull/7"
                )
            },
        )
        mock_client.continue_run.return_value = self.create_seer_run(
            organization=self.group.organization, seer_run_state_id=67890
        )

        def iterate(**kwargs):
            with self.feature("organizations:autofix-pr-iteration"):
                trigger_autofix_agent(
                    group=self.group,
                    step=AutofixStep.PR_ITERATION,
                    referrer=AutofixReferrer.UNKNOWN,
                    run_id=67890,
                    **kwargs,
                )
            return mock_client.continue_run.call_args.kwargs["prompt_metadata"]

        assert json.loads(iterate(commit_author=author)["commit_author"]) == author
        assert "commit_author" not in iterate()

    def _make_repo_and_projectrepo(
        self,
        *,
        owner: str = "owner",
        name: str = "repo",
        external_id: str = "123",
        branch_name: str | None = None,
    ) -> None:
        repository = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id=external_id,
            name=f"{owner}/{name}",
        )
        self.create_seer_project_repository(
            project=self.project,
            repository=repository,
            branch_name=branch_name,
        )

    @patch("sentry.scm.factory.new")
    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_root_cause_includes_base_shas(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run, mock_scm_new
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = MagicMock(seer_run_state_id=123)
        self._make_repo_and_projectrepo()

        mock_scm = _make_scm_mock(
            get_repository={"data": {"default_branch": "main"}},
            get_branch={"data": {"sha": "abc123"}},
        )
        mock_scm_new.return_value = mock_scm

        with self.feature("organizations:autofix-pr-iteration"):
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.ROOT_CAUSE,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=None,
            )

        prompt_metadata = mock_client.start_run.call_args.kwargs["prompt_metadata"]
        assert json.loads(prompt_metadata["base_shas"]) == {
            "owner/repo": {"base_sha": "abc123", "base_branch": "main"}
        }

    @patch("sentry.scm.factory.new")
    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_code_changes_omits_base_shas_when_pr_iteration_disabled(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run, mock_scm_new
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = MagicMock(seer_run_state_id=123)
        self._make_repo_and_projectrepo()

        trigger_autofix_agent(
            group=self.group,
            step=AutofixStep.CODE_CHANGES,
            referrer=AutofixReferrer.UNKNOWN,
            run_id=None,
        )

        prompt_metadata = mock_client.start_run.call_args.kwargs["prompt_metadata"]
        assert "base_shas" not in prompt_metadata
        mock_scm_new.assert_not_called()

    @patch("sentry.scm.factory.new")
    @patch("sentry.quotas.backend.record_seer_run")
    @patch("sentry.quotas.backend.check_seer_quota", return_value=True)
    @patch("sentry.seer.autofix.autofix_agent.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_non_root_cause_step_omits_base_shas(
        self, mock_client_class, mock_broadcast, mock_check_quota, mock_record_run, mock_scm_new
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.start_run.return_value = MagicMock(seer_run_state_id=123)
        self._make_repo_and_projectrepo()

        with self.feature("organizations:autofix-pr-iteration"):
            trigger_autofix_agent(
                group=self.group,
                step=AutofixStep.SOLUTION,
                referrer=AutofixReferrer.UNKNOWN,
                run_id=None,
            )

        prompt_metadata = mock_client.start_run.call_args.kwargs["prompt_metadata"]
        assert "base_shas" not in prompt_metadata
        mock_scm_new.assert_not_called()


class TestBuildBaseShasMetadata(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group(project=self.project)

    def _make_repo_and_projectrepo(
        self,
        *,
        owner: str = "owner",
        name: str = "repo",
        external_id: str = "123",
        branch_name: str | None = None,
    ) -> None:
        repository = self.create_repo(
            project=self.project,
            provider="integrations:github",
            external_id=external_id,
            name=f"{owner}/{name}",
        )
        self.create_seer_project_repository(
            project=self.project,
            repository=repository,
            branch_name=branch_name,
        )

    def test_returns_none_without_repos(self) -> None:
        assert _build_base_shas_metadata(self.group, AutofixReferrer.UNKNOWN) is None

    @patch("sentry.scm.factory.new")
    def test_builds_base_shas_using_default_branch(self, mock_scm_new):
        self._make_repo_and_projectrepo()
        mock_scm = _make_scm_mock(
            get_repository={"data": {"default_branch": "main"}},
            get_branch={"data": {"sha": "deadbeef"}},
        )
        mock_scm_new.return_value = mock_scm

        result = _build_base_shas_metadata(self.group, AutofixReferrer.UNKNOWN)

        assert result is not None
        assert json.loads(result) == {"owner/repo": {"base_sha": "deadbeef", "base_branch": "main"}}
        mock_scm.get_branch.assert_called_once_with("main")

    @patch("sentry.scm.factory.new")
    def test_uses_branch_name_override(self, mock_scm_new):
        self._make_repo_and_projectrepo(branch_name="release/v2")
        mock_scm = _make_scm_mock(get_branch={"data": {"sha": "abc"}})
        mock_scm_new.return_value = mock_scm

        result = _build_base_shas_metadata(self.group, AutofixReferrer.UNKNOWN)

        assert result is not None
        assert json.loads(result) == {
            "owner/repo": {"base_sha": "abc", "base_branch": "release/v2"}
        }
        mock_scm.get_repository.assert_not_called()
        mock_scm.get_branch.assert_called_once_with("release/v2")

    @patch("sentry.seer.autofix.autofix_agent.logger")
    @patch("sentry.scm.factory.new")
    def test_skips_repo_when_scm_raises(self, mock_scm_new, mock_logger):
        self._make_repo_and_projectrepo()
        mock_scm_new.side_effect = Exception("boom")

        assert _build_base_shas_metadata(self.group, AutofixReferrer.UNKNOWN) is None
        mock_logger.exception.assert_called_once()

    @patch("sentry.scm.factory.new")
    def test_skips_repo_without_resolvable_branch(self, mock_scm_new):
        self._make_repo_and_projectrepo()
        mock_scm = _make_scm_mock(get_repository={"data": {"default_branch": None}})
        mock_scm_new.return_value = mock_scm

        assert _build_base_shas_metadata(self.group, AutofixReferrer.UNKNOWN) is None
        mock_scm.get_branch.assert_not_called()

    @patch("sentry.scm.factory.new")
    def test_includes_only_repos_with_resolved_sha(self, mock_scm_new):
        self._make_repo_and_projectrepo(name="repo-ok", external_id="1")
        self._make_repo_and_projectrepo(name="repo-bad", external_id="2")

        ok_scm = _make_scm_mock(
            get_repository={"data": {"default_branch": "main"}},
            get_branch={"data": {"sha": "sha-ok"}},
        )
        bad_scm = _make_scm_mock(
            get_repository={"data": {"default_branch": "main"}},
            get_branch={"data": {"sha": ""}},
        )
        mock_scm_new.side_effect = [ok_scm, bad_scm]

        result = _build_base_shas_metadata(self.group, AutofixReferrer.UNKNOWN)

        assert result is not None
        assert json.loads(result) == {
            "owner/repo-ok": {"base_sha": "sha-ok", "base_branch": "main"}
        }


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
        self.create_seer_project_repository(
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

    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_success(self, mock_client_class):
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
        assert call_kwargs["issue_short_id"] == self.group.qualified_short_id

    @patch("sentry.seer.autofix.autofix_agent.analytics.record")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_records_referrer(self, mock_client_class, mock_record):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {
            "successes": [{"repo_name": "owner/repo"}],
            "failures": [],
        }
        self._make_repo_and_projectrepo()

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.SLACK,
            integration_id=456,
        )

        event = mock_record.call_args.args[0]
        assert event.referrer == AutofixReferrer.SLACK.value

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

    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_generates_prompt_from_artifacts(self, mock_client_class):
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

    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_uses_group_title_for_branch(self, mock_client_class):
        """Test that branch_name_base is the group title behind a seer/ prefix."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {
            "successes": [],
            "failures": [],
        }
        self._make_repo_and_projectrepo()

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
        assert call_kwargs["branch_name_base"] == f"seer/{self.group.title}"

    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_fetches_auto_create_pr_from_preferences(
        self, mock_client_class
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

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        assert call_kwargs["auto_create_pr"] is True

    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_defaults_auto_create_pr_false(self, mock_client_class):
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

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        assert call_kwargs["auto_create_pr"] is False

    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_uses_auto_create_pr_override(self, mock_client_class):
        """Test that manual handoff can force PR creation independent of automation settings."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {
            "successes": [],
            "failures": [],
        }
        self._make_repo_and_projectrepo()
        self._make_handoff(auto_create_pr=False)

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
            auto_create_pr=True,
        )

        call_kwargs = mock_client.launch_coding_agents.call_args.kwargs
        assert call_kwargs["auto_create_pr"] is True

    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_filters_to_relevant_repo(self, mock_client_class):
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

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        repos = mock_client.launch_coding_agents.call_args.kwargs["repos"]
        assert len(repos) == 1
        assert repos[0].name == "relevant-repo"

    @patch("sentry.seer.autofix.autofix_agent.logger")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_falls_back_to_first_repo_when_no_relevant_repo(
        self, mock_client_class, mock_logger
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

    @patch("sentry.seer.autofix.autofix_agent.logger")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_falls_back_when_relevant_repo_doesnt_match(
        self, mock_client_class, mock_logger
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

    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_keeps_branch_name_from_preferences_when_set(
        self, mock_client_class
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

        repos = mock_client.launch_coding_agents.call_args.kwargs["repos"]
        assert repos[0].branch_name == "release/v2"

    @patch("sentry.seer.autofix.autofix_agent._resolve_default_branch", return_value="main")
    @patch("sentry.seer.autofix.autofix_agent.SeerAgentClient")
    def test_trigger_coding_agent_handoff_resolves_default_branch_when_empty(
        self, mock_client_class, mock_resolve
    ):
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_run.return_value = self._make_run_state()
        mock_client.launch_coding_agents.return_value = {"successes": [], "failures": []}
        self._make_repo_and_projectrepo(external_id="1", branch_name="")

        trigger_coding_agent_handoff(
            group=self.group,
            run_id=123,
            referrer=AutofixReferrer.UNKNOWN,
            integration_id=456,
        )

        mock_resolve.assert_called_once()
        repos = mock_client.launch_coding_agents.call_args.kwargs["repos"]
        assert repos[0].branch_name == "main"


class TestTriggerPushChanges(TestCase):
    """Tests for trigger_push_changes function."""

    def setUp(self):
        super().setUp()
        self.group = self.create_group(project=self.project)

    def _push(self, mock_post, features="organizations:gen-ai-features", **kwargs):
        """Push with a minimal run state and return the payload sent to Seer."""
        mock_post.return_value = MagicMock(status=200)
        state = SeerRunState(
            run_id=123,
            blocks=[],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            repo_pr_states={},
            metadata={"group_id": self.group.id},
        )

        with self.feature(features):
            trigger_push_changes(
                group=self.group,
                run_id=123,
                referrer=AutofixReferrer.UNKNOWN,
                state=state,
                **kwargs,
            )

        return mock_post.call_args[0][0]["payload"]

    def _fixes_line(self) -> str:
        issue_url = self.group.get_absolute_url(params={"seerDrawer": "true"})
        return f"Fixes [{self.group.qualified_short_id}]({issue_url})"

    def test_raises_permission_denied_when_coding_disabled(self):
        self.organization.update_option("sentry:enable_seer_coding", False)

        with pytest.raises(PermissionDenied, match="Code generation is disabled"):
            trigger_push_changes(
                group=self.group,
                run_id=123,
                referrer=AutofixReferrer.UNKNOWN,
            )

    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_passes_pr_description_suffix_ready_state_and_author(self, mock_post):
        author = SeerCommitAuthor(name="Mona", email="1+octocat@users.noreply.github.com")

        payload = self._push(mock_post, author=author)

        assert payload["pr_description_suffix"] == self._fixes_line()
        assert payload["ready_for_review"] is True
        assert payload["author"] == author

    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_opens_as_draft_when_review_request_enabled(self, mock_post):
        payload = self._push(
            mock_post,
            features={
                "organizations:gen-ai-features": True,
                "organizations:autofix-pr-iteration-review-request": True,
            },
        )

        assert payload["ready_for_review"] is False
        assert "author" not in payload

    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_pr_description_suffix_includes_linear_issue(self, mock_post):
        self.create_platform_external_issue(
            group=self.group,
            service_type="linear",
            display_name="PROJ#123",
            web_url="https://linear.app/proj/issue/PROJ-123",
        )

        payload = self._push(mock_post)

        assert payload["pr_description_suffix"] == (
            f"{self._fixes_line()}\nFixes [PROJ-123](https://linear.app/proj/issue/PROJ-123)"
        )

    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_pr_description_suffix_linear_alphanumeric_prefix(self, mock_post):
        self.create_platform_external_issue(
            group=self.group,
            service_type="linear",
            display_name="PROJ2#456",
            web_url="https://linear.app/team/issue/PROJ2-456",
        )

        payload = self._push(mock_post)

        assert payload["pr_description_suffix"] == (
            f"{self._fixes_line()}\nFixes [PROJ2-456](https://linear.app/team/issue/PROJ2-456)"
        )

    @patch("sentry.seer.autofix.autofix_agent.is_free_cohort_org", return_value=True)
    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_pr_description_suffix_automated_free_cohort_run(self, mock_post, _mock_free_cohort):
        self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=123,
            referrer=AutofixReferrer.NIGHT_SHIFT.value,
        )

        payload = self._push(mock_post)

        settings_url = self.organization.absolute_url(
            f"/settings/{self.organization.slug}/projects/{self.group.project.slug}/seer/"
        )
        assert payload["pr_description_suffix"] == (
            f"{self._fixes_line()}\n"
            f"\n<sub>This PR was automatically generated by Sentry at no cost. "
            f"You can [adjust this setting]({settings_url}) at any time.</sub>"
        )

    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_pr_description_suffix_automated_paid_run(self, mock_post):
        self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=123,
            referrer=AutofixReferrer.ISSUE_SUMMARY_POST_PROCESS_FIXABILITY.value,
        )

        payload = self._push(mock_post)

        settings_url = self.organization.absolute_url(
            f"/settings/{self.organization.slug}/projects/{self.group.project.slug}/seer/"
        )
        assert payload["pr_description_suffix"] == (
            f"{self._fixes_line()}\n"
            f"\n<sub>This PR was automatically generated by Sentry. "
            f"You can [adjust this setting]({settings_url}) at any time.</sub>"
        )

    @patch("sentry.seer.agent.client.make_agent_update_request")
    def test_pr_description_suffix_manual_run_has_no_automation_note(self, mock_post):
        self.create_seer_run(
            organization=self.organization,
            seer_run_state_id=123,
            referrer=AutofixReferrer.WEB.value,
        )

        payload = self._push(mock_post)

        assert payload["pr_description_suffix"] == self._fixes_line()
