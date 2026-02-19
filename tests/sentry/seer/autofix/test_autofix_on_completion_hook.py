from typing import TypedDict
from unittest.mock import MagicMock, patch

from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.on_completion_hook import (
    PIPELINE_ORDER,
    STOPPING_POINT_TO_STEP,
    AutofixOnCompletionHook,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.explorer.client_models import (
    Artifact,
    ExplorerFilePatch,
    FilePatch,
    MemoryBlock,
    Message,
    SeerRunState,
)
from sentry.seer.models import (
    AutofixHandoffPoint,
    PreferenceResponse,
    SeerAutomationHandoffConfiguration,
    SeerProjectPreference,
    SeerRepoDefinition,
)
from sentry.sentry_apps.utils.webhooks import SeerActionType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


def run_state(run_id=123, blocks: list[MemoryBlock] | None = None, metadata=None):
    return SeerRunState(
        run_id=run_id,
        blocks=blocks if blocks is not None else [],
        status="completed",
        updated_at="2026-02-10T00:00:00Z",
        metadata=metadata,
    )


def root_cause_memory_block() -> MemoryBlock:
    return MemoryBlock(
        id="block-root-cause",
        message=Message(
            role="assistant",
            content="message root cause",
            metadata={"step": "root_cause"},
        ),
        timestamp="2026-02-10T00:00:00Z",
        artifacts=[
            Artifact(
                key="root_cause",
                data={"one_line_description": "Null pointer in auth module"},
                reason="explorer",
            )
        ],
    )


def solution_memory_block() -> MemoryBlock:
    return MemoryBlock(
        id="block-solution",
        message=Message(
            role="assistant",
            content="message solution",
            metadata={"step": "solution"},
        ),
        timestamp="2026-02-10T00:00:00Z",
        artifacts=[
            Artifact(
                key="solution",
                data={},  # TODO
                reason="explorer",
            )
        ],
    )


def code_changes_memory_block() -> MemoryBlock:
    return MemoryBlock(
        id="block-code-changes",
        message=Message(
            role="assistant",
            content="message code changes",
            metadata={"step": "code_changes"},
        ),
        timestamp="2026-02-10T00:00:00Z",
        merged_file_patches=[
            ExplorerFilePatch(
                repo_name="test-repo",
                patch=FilePatch(path="test.py", type="M", added=5, removed=2),
            )
        ],
    )


def triage_memory_block() -> MemoryBlock:
    return MemoryBlock(
        id="block-triage",
        message=Message(
            role="assistant",
            content="message triage",
            metadata={"step": "triage"},
        ),
        timestamp="2026-02-10T00:00:00Z",
        artifacts=[
            Artifact(
                key="triage",
                data={},  # TODO
                reason="explorer",
            )
        ],
    )


def impact_assessment_memory_block() -> MemoryBlock:
    return MemoryBlock(
        id="block-impact-assessment",
        message=Message(
            role="assistant",
            content="message impact assessment",
            metadata={"step": "impact_assessment"},
        ),
        timestamp="2026-02-10T00:00:00Z",
        artifacts=[
            Artifact(
                key="impact_assessment",
                data={},  # TODO
                reason="explorer",
            )
        ],
    )


class TestAutofixOnCompletionHookHelpers(TestCase):
    """Tests for helper methods in AutofixOnCompletionHook."""

    def test_get_current_step_root_cause(self):
        """Returns ROOT_CAUSE when root_cause artifact exists."""
        state = run_state(blocks=[root_cause_memory_block()])
        result = AutofixOnCompletionHook._get_current_step(state)
        assert result == AutofixStep.ROOT_CAUSE

    def test_get_current_step_solution(self):
        """Returns SOLUTION when solution artifact exists."""
        state = run_state(blocks=[root_cause_memory_block(), solution_memory_block()])
        result = AutofixOnCompletionHook._get_current_step(state)
        assert result == AutofixStep.SOLUTION

    def test_get_current_step_code_changes(self):
        """Returns CODE_CHANGES when code changes exist."""
        state = run_state(
            blocks=[
                root_cause_memory_block(),
                solution_memory_block(),
                code_changes_memory_block(),
            ]
        )
        result = AutofixOnCompletionHook._get_current_step(state)
        assert result == AutofixStep.CODE_CHANGES

    def test_get_current_step_none(self):
        """Returns None when no artifacts or code changes exist."""
        state = run_state()
        result = AutofixOnCompletionHook._get_current_step(state)
        assert result is None

    def test_get_next_step_root_cause_to_solution(self):
        """Returns SOLUTION after ROOT_CAUSE."""
        result = AutofixOnCompletionHook._get_next_step(AutofixStep.ROOT_CAUSE)
        assert result == AutofixStep.SOLUTION

    def test_get_next_step_solution_to_code_changes(self):
        """Returns CODE_CHANGES after SOLUTION."""
        result = AutofixOnCompletionHook._get_next_step(AutofixStep.SOLUTION)
        assert result == AutofixStep.CODE_CHANGES

    def test_get_next_step_code_changes_is_last(self):
        """Returns None after CODE_CHANGES (last step)."""
        result = AutofixOnCompletionHook._get_next_step(AutofixStep.CODE_CHANGES)
        assert result is None

    def test_get_next_step_unknown_step(self):
        """Returns None for steps not in pipeline."""
        result = AutofixOnCompletionHook._get_next_step(AutofixStep.TRIAGE)
        assert result is None


class TestAutofixOnCompletionHookPipeline(TestCase):
    """Tests for pipeline continuation logic."""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_explorer")
    def test_maybe_continue_pipeline_no_metadata(self, mock_trigger):
        """Does not continue when metadata is missing."""
        state = run_state(blocks=[root_cause_memory_block()])
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state)
        mock_trigger.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_explorer")
    def test_maybe_continue_pipeline_no_stopping_point_in_metadata(self, mock_trigger):
        """Does not continue when stopping_point is missing from metadata."""
        state = run_state(blocks=[root_cause_memory_block()], metadata={"group_id": self.group.id})
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state)
        mock_trigger.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_explorer")
    def test_maybe_continue_pipeline_at_stopping_point(self, mock_trigger):
        """Does not continue when current step matches stopping point."""
        state = run_state(
            blocks=[root_cause_memory_block()],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.ROOT_CAUSE.value,
            },
        )
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state)
        mock_trigger.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.get_project_seer_preferences")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_explorer")
    def test_maybe_continue_pipeline_continues_to_next_step(self, mock_trigger, mock_get_prefs):
        """Continues to next step when not at stopping point."""
        # No handoff configured - should continue with normal pipeline
        mock_get_prefs.return_value = None

        state = run_state(
            blocks=[root_cause_memory_block()],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
            },
        )
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state)
        mock_trigger.assert_called_once()
        call_kwargs = mock_trigger.call_args.kwargs
        assert call_kwargs["group"].id == self.group.id
        assert call_kwargs["step"] == AutofixStep.SOLUTION
        assert call_kwargs["run_id"] == 123

    @patch("sentry.seer.autofix.on_completion_hook.SeerExplorerClient")
    def test_maybe_continue_pipeline_pushes_changes_for_open_pr(self, mock_client_class):
        """Pushes changes when stopping_point is open_pr and code_changes completed."""
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client

        state = run_state(
            blocks=[
                root_cause_memory_block(),
                solution_memory_block(),
                code_changes_memory_block(),
            ],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
            },
        )
        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state)
        mock_client.push_changes.assert_called_once_with(123)


class TestPipelineConstants(TestCase):
    """Tests for pipeline constants."""

    def test_pipeline_order(self):
        """Pipeline order is root_cause -> solution -> code_changes."""
        assert PIPELINE_ORDER == [
            AutofixStep.ROOT_CAUSE,
            AutofixStep.SOLUTION,
            AutofixStep.CODE_CHANGES,
        ]

    def test_stopping_point_to_step_mapping(self):
        """Stopping points map to correct steps."""
        assert STOPPING_POINT_TO_STEP[AutofixStoppingPoint.ROOT_CAUSE] == AutofixStep.ROOT_CAUSE
        assert STOPPING_POINT_TO_STEP[AutofixStoppingPoint.SOLUTION] == AutofixStep.SOLUTION
        assert STOPPING_POINT_TO_STEP[AutofixStoppingPoint.CODE_CHANGES] == AutofixStep.CODE_CHANGES
        assert AutofixStoppingPoint.OPEN_PR not in STOPPING_POINT_TO_STEP


class TestAutofixOnCompletionHookWebhooks(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()

    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_send_step_webhook_artifact_types(self, mock_broadcast):
        """Tests webhook sending for all artifact-based step types."""
        state = MagicMock()
        run_id = 123

        class TestCaseDict(TypedDict):
            block: MemoryBlock
            expected_event: SeerActionType
            expected_payload_key: str

        test_cases: list[TestCaseDict] = [
            {
                "block": root_cause_memory_block(),
                "expected_event": SeerActionType.ROOT_CAUSE_COMPLETED,
                "expected_payload_key": "root_cause",
            },
            {
                "block": solution_memory_block(),
                "expected_event": SeerActionType.SOLUTION_COMPLETED,
                "expected_payload_key": "solution",
            },
            {
                "block": triage_memory_block(),
                "expected_event": SeerActionType.TRIAGE_COMPLETED,
                "expected_payload_key": "triage",
            },
            {
                "block": impact_assessment_memory_block(),
                "expected_event": SeerActionType.IMPACT_ASSESSMENT_COMPLETED,
                "expected_payload_key": "impact_assessment",
            },
        ]

        with self.feature({"organizations:seer-webhooks": True}):
            for i, test_case in enumerate(test_cases):
                mock_broadcast.reset_mock()
                state = run_state(blocks=[test_case["block"]])
                AutofixOnCompletionHook._send_step_webhook(self.organization, run_id, state)

                mock_broadcast.assert_called_once()
                call_kwargs = mock_broadcast.call_args.kwargs
                if i == 0:  # First test - verify common fields
                    assert call_kwargs["resource_name"] == "seer"
                    assert call_kwargs["organization_id"] == self.organization.id
                    assert call_kwargs["payload"]["run_id"] == run_id
                assert call_kwargs["event_name"] == test_case["expected_event"].value
                assert (
                    call_kwargs["payload"][test_case["expected_payload_key"]]
                    == test_case["block"].artifacts[0].data
                )

    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_send_step_webhook_coding(self, mock_broadcast):
        """Sends coding_completed webhook when file patches exist."""
        with self.feature({"organizations:seer-webhooks": True}):
            state = run_state(
                blocks=[
                    root_cause_memory_block(),
                    solution_memory_block(),
                    code_changes_memory_block(),
                ]
            )
            AutofixOnCompletionHook._send_step_webhook(self.organization, 123, state)

            mock_broadcast.assert_called_once()
            call_kwargs = mock_broadcast.call_args.kwargs
            assert call_kwargs["event_name"] == SeerActionType.CODING_COMPLETED.value
            assert call_kwargs["payload"]["code_changes"]["test-repo"][0]["path"] == "test.py"
            assert call_kwargs["payload"]["code_changes"]["test-repo"][0]["added"] == 5
            assert call_kwargs["payload"]["code_changes"]["test-repo"][0]["removed"] == 2

    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    def test_send_step_webhook_no_artifacts_no_webhook(self, mock_broadcast):
        """Does not send webhook when no artifacts or file patches exist."""
        block = MemoryBlock(
            id="block_empty",
            message=Message(role="tool_use", content="test"),
            timestamp="2024-01-01T00:00:00Z",
            artifacts=[],
        )
        state = run_state(blocks=[block])
        AutofixOnCompletionHook._send_step_webhook(self.organization, 123, state)

        mock_broadcast.assert_not_called()


class TestAutofixOnCompletionHookSupergroups(TestCase):
    """Tests for supergroups embedding trigger in AutofixOnCompletionHook."""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    @with_feature("projects:supergroup-embeddings-explorer")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_supergroups_embedding")
    def test_triggers_embedding_on_root_cause(self, mock_trigger_sg):
        """Triggers supergroups embedding when root cause completes with feature flag enabled."""
        block = root_cause_memory_block()
        state = run_state(blocks=[block], metadata={"group_id": self.group.id})
        AutofixOnCompletionHook._maybe_trigger_supergroups_embedding(self.organization, 123, state)

        mock_trigger_sg.assert_called_once_with(
            organization_id=self.organization.id,
            group_id=self.group.id,
            artifact_data=block.artifacts[0].data,
        )

    @patch("sentry.seer.autofix.on_completion_hook.trigger_supergroups_embedding")
    def test_skips_embedding_when_flag_disabled(self, mock_trigger_sg):
        """Does not trigger supergroups embedding when feature flag is disabled."""
        state = run_state(
            blocks=[root_cause_memory_block()],
            metadata={"group_id": self.group.id},
        )
        AutofixOnCompletionHook._maybe_trigger_supergroups_embedding(self.organization, 123, state)

        mock_trigger_sg.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_supergroups_embedding")
    def test_skips_embedding_when_no_group_id(self, mock_trigger_sg):
        """Does not trigger supergroups embedding when group_id is missing from metadata."""
        state = run_state(blocks=[root_cause_memory_block()])
        AutofixOnCompletionHook._maybe_trigger_supergroups_embedding(self.organization, 123, state)

        mock_trigger_sg.assert_not_called()

    @with_feature("projects:supergroup-embeddings-explorer")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_supergroups_embedding")
    @patch("sentry.seer.autofix.on_completion_hook.broadcast_webhooks_for_organization.delay")
    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    def test_skips_embedding_when_current_step_is_not_root_cause(
        self, mock_fetch, mock_broadcast, mock_trigger_sg
    ):
        """Does not trigger embedding when current step is solution, not root cause."""
        state = MagicMock()
        state.metadata = {"group_id": self.group.id}
        state.has_code_changes.return_value = (False, True)
        state.get_artifacts.return_value = {
            "root_cause": Artifact(
                key="root_cause", data={"one_line_description": "test"}, reason="test"
            ),
            "solution": Artifact(key="solution", data={"steps": []}, reason="test"),
        }
        state.blocks = [
            MemoryBlock(
                id="block_sol",
                message=Message(message="test", role="tool_use"),
                timestamp="2024-01-01T00:01:00Z",
                artifacts=[Artifact(key="solution", data={"steps": []}, reason="test")],
            ),
        ]
        mock_fetch.return_value = state

        AutofixOnCompletionHook.execute(self.organization, 123)

        mock_trigger_sg.assert_not_called()


class TestAutofixOnCompletionHookHandoff(TestCase):
    """Tests for coding agent handoff logic in AutofixOnCompletionHook."""

    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    def _make_handoff_config(
        self, handoff_point: AutofixHandoffPoint = AutofixHandoffPoint.ROOT_CAUSE
    ) -> SeerAutomationHandoffConfiguration:
        """Helper to create a handoff configuration."""
        return SeerAutomationHandoffConfiguration(
            handoff_point=handoff_point,
            target="cursor_background_agent",
            integration_id=123,
            auto_create_pr=False,
        )

    def _make_preference_response(
        self, handoff_config: SeerAutomationHandoffConfiguration | None = None
    ) -> PreferenceResponse:
        """Helper to create a preference response."""
        preference = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[
                SeerRepoDefinition(
                    provider="github",
                    owner="owner",
                    name="repo",
                    external_id="123",
                )
            ],
            automation_handoff=handoff_config,
        )
        return PreferenceResponse(preference=preference, code_mapping_repos=[])

    @patch("sentry.seer.autofix.on_completion_hook.get_project_seer_preferences")
    def test_get_handoff_config_returns_none_when_not_root_cause_step(self, mock_get_prefs):
        """Returns None when current step is not ROOT_CAUSE."""
        result = AutofixOnCompletionHook._get_handoff_config_if_applicable(
            stopping_point=AutofixStoppingPoint.CODE_CHANGES,
            current_step=AutofixStep.SOLUTION,  # Not ROOT_CAUSE
            group_id=self.group.id,
        )

        assert result is None
        mock_get_prefs.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.get_project_seer_preferences")
    def test_get_handoff_config_returns_none_when_stopping_at_root_cause(self, mock_get_prefs):
        """Returns None when stopping point is ROOT_CAUSE (no handoff needed)."""
        result = AutofixOnCompletionHook._get_handoff_config_if_applicable(
            stopping_point=AutofixStoppingPoint.ROOT_CAUSE,
            current_step=AutofixStep.ROOT_CAUSE,
            group_id=self.group.id,
        )

        assert result is None
        mock_get_prefs.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.get_project_seer_preferences")
    def test_get_handoff_config_returns_none_when_no_handoff_configured(self, mock_get_prefs):
        """Returns None when project has no automation_handoff configured."""
        mock_get_prefs.return_value = self._make_preference_response(handoff_config=None)

        result = AutofixOnCompletionHook._get_handoff_config_if_applicable(
            stopping_point=AutofixStoppingPoint.CODE_CHANGES,
            current_step=AutofixStep.ROOT_CAUSE,
            group_id=self.group.id,
        )

        assert result is None

    @patch("sentry.seer.autofix.on_completion_hook.get_project_seer_preferences")
    def test_get_handoff_config_returns_config_when_applicable(self, mock_get_prefs):
        """Returns handoff config when all conditions are met."""
        handoff_config = self._make_handoff_config()
        mock_get_prefs.return_value = self._make_preference_response(handoff_config=handoff_config)

        result = AutofixOnCompletionHook._get_handoff_config_if_applicable(
            stopping_point=AutofixStoppingPoint.CODE_CHANGES,
            current_step=AutofixStep.ROOT_CAUSE,
            group_id=self.group.id,
        )

        assert result == handoff_config

    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    @patch("sentry.seer.autofix.on_completion_hook.get_project_seer_preferences")
    def test_maybe_continue_pipeline_triggers_handoff_when_configured(
        self, mock_get_prefs, mock_trigger_handoff
    ):
        """Triggers handoff instead of continuing pipeline when handoff is configured."""
        handoff_config = self._make_handoff_config()
        mock_get_prefs.return_value = self._make_preference_response(handoff_config=handoff_config)
        mock_trigger_handoff.return_value = {"successes": [], "failures": []}

        state = run_state(
            blocks=[root_cause_memory_block()],
            metadata={
                "group_id": self.group.id,
                "stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
            },
        )

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state)

        mock_trigger_handoff.assert_called_once()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    def test_trigger_coding_agent_handoff_calls_function(self, mock_trigger):
        """Test _trigger_coding_agent_handoff calls the trigger function correctly."""
        mock_trigger.return_value = {
            "successes": [{"repo": "owner/repo"}],
            "failures": [],
        }
        handoff_config = self._make_handoff_config()

        AutofixOnCompletionHook._trigger_coding_agent_handoff(
            organization=self.organization,
            run_id=123,
            group_id=self.group.id,
            handoff_config=handoff_config,
        )

        mock_trigger.assert_called_once()
        call_kwargs = mock_trigger.call_args.kwargs
        assert call_kwargs["run_id"] == 123
        assert call_kwargs["integration_id"] == 123


class AutofixOnCompletionHookTest(TestCase):
    """Test the AutofixOnCompletionHook behavior."""

    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_explorer")
    def test_next_step_not_triggered_when_coding_disabled(
        self, mock_trigger_autofix, mock_fetch_run_status
    ):
        """Test that next step is not triggered if next step is CODE_CHANGES and sentry:enable_seer_coding is disabled."""
        self.organization.update_option("sentry:enable_seer_coding", False)
        group = self.create_group(project=self.project)

        # Mock run state: SOLUTION step just completed
        state = run_state(
            blocks=[solution_memory_block()],
            metadata={
                "stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
                "group_id": group.id,
            },
        )
        mock_fetch_run_status.return_value = state

        # Execute the hook
        AutofixOnCompletionHook.execute(self.organization, 123)

        # Verify: trigger_autofix_explorer was NOT called (next step blocked)
        mock_trigger_autofix.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.fetch_run_status")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_explorer")
    def test_next_step_triggered_when_coding_enabled(
        self, mock_trigger_autofix, mock_fetch_run_status
    ):
        """Test that next step IS triggered when next step is CODE_CHANGES and sentry:enable_seer_coding is enabled."""
        self.organization.update_option("sentry:enable_seer_coding", True)
        group = self.create_group(project=self.project)

        # Mock run state: SOLUTION step just completed
        state = run_state(
            blocks=[solution_memory_block()],
            metadata={
                "stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
                "group_id": group.id,
            },
        )
        mock_fetch_run_status.return_value = state

        # Execute the hook
        AutofixOnCompletionHook.execute(self.organization, 123)

        # Verify: trigger_autofix_explorer WAS called with CODE_CHANGES step
        mock_trigger_autofix.assert_called_once()
        call_kwargs = mock_trigger_autofix.call_args.kwargs
        assert call_kwargs["step"] == AutofixStep.CODE_CHANGES
        assert call_kwargs["group"] == group
        assert call_kwargs["run_id"] == 123
