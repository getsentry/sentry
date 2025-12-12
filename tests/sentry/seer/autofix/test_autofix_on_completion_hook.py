from unittest.mock import MagicMock, patch

from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.on_completion_hook import (
    PIPELINE_ORDER,
    STOPPING_POINT_TO_STEP,
    AutofixOnCompletionHook,
)
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.explorer.client_models import Artifact
from sentry.testutils.cases import TestCase


class TestAutofixOnCompletionHookHelpers(TestCase):
    """Tests for helper methods in AutofixOnCompletionHook."""

    def test_get_current_step_root_cause(self):
        """Returns ROOT_CAUSE when root_cause artifact exists."""
        artifacts = {
            "root_cause": Artifact(key="root_cause", data={"cause": "test"}, reason="test")
        }
        state = MagicMock()
        state.has_code_changes.return_value = (False, True)

        result = AutofixOnCompletionHook._get_current_step(artifacts, state)
        assert result == AutofixStep.ROOT_CAUSE

    def test_get_current_step_solution(self):
        """Returns SOLUTION when solution artifact exists."""
        artifacts = {
            "root_cause": Artifact(key="root_cause", data={"cause": "test"}, reason="test"),
            "solution": Artifact(key="solution", data={"steps": []}, reason="test"),
        }
        state = MagicMock()
        state.has_code_changes.return_value = (False, True)

        result = AutofixOnCompletionHook._get_current_step(artifacts, state)
        assert result == AutofixStep.SOLUTION

    def test_get_current_step_code_changes(self):
        """Returns CODE_CHANGES when code changes exist."""
        artifacts = {
            "root_cause": Artifact(key="root_cause", data={"cause": "test"}, reason="test"),
            "solution": Artifact(key="solution", data={"steps": []}, reason="test"),
        }
        state = MagicMock()
        state.has_code_changes.return_value = (True, False)

        result = AutofixOnCompletionHook._get_current_step(artifacts, state)
        assert result == AutofixStep.CODE_CHANGES

    def test_get_current_step_none(self):
        """Returns None when no artifacts or code changes exist."""
        artifacts: dict[str, Artifact] = {}
        state = MagicMock()
        state.has_code_changes.return_value = (False, True)

        result = AutofixOnCompletionHook._get_current_step(artifacts, state)
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
        state = MagicMock()
        state.metadata = None
        artifacts = {
            "root_cause": Artifact(key="root_cause", data={"cause": "test"}, reason="test")
        }

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, artifacts)

        mock_trigger.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_explorer")
    def test_maybe_continue_pipeline_no_stopping_point_in_metadata(self, mock_trigger):
        """Does not continue when stopping_point is missing from metadata."""
        state = MagicMock()
        state.metadata = {"group_id": self.group.id}
        artifacts = {
            "root_cause": Artifact(key="root_cause", data={"cause": "test"}, reason="test")
        }

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, artifacts)

        mock_trigger.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_explorer")
    def test_maybe_continue_pipeline_at_stopping_point(self, mock_trigger):
        """Does not continue when current step matches stopping point."""
        state = MagicMock()
        state.metadata = {
            "stopping_point": AutofixStoppingPoint.ROOT_CAUSE.value,
            "group_id": self.group.id,
        }
        state.has_code_changes.return_value = (False, True)
        artifacts = {
            "root_cause": Artifact(key="root_cause", data={"cause": "test"}, reason="test")
        }

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, artifacts)

        mock_trigger.assert_not_called()

    @patch("sentry.seer.autofix.on_completion_hook.trigger_autofix_explorer")
    def test_maybe_continue_pipeline_continues_to_next_step(self, mock_trigger):
        """Continues to next step when not at stopping point."""
        state = MagicMock()
        state.metadata = {
            "stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
            "group_id": self.group.id,
        }
        state.has_code_changes.return_value = (False, True)
        artifacts = {
            "root_cause": Artifact(key="root_cause", data={"cause": "test"}, reason="test")
        }

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, artifacts)

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

        state = MagicMock()
        state.metadata = {
            "stopping_point": AutofixStoppingPoint.OPEN_PR.value,
            "group_id": self.group.id,
        }
        state.has_code_changes.return_value = (True, False)  # has changes, not synced
        artifacts = {
            "root_cause": Artifact(key="root_cause", data={"cause": "test"}, reason="test"),
            "solution": Artifact(key="solution", data={"steps": []}, reason="test"),
        }

        AutofixOnCompletionHook._maybe_continue_pipeline(self.organization, 123, state, artifacts)

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
