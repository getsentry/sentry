from unittest.mock import patch

import pytest

from sentry.models.organization import Organization
from sentry.seer.autofix.autofix_agent import AutofixStep
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.utils import AutofixStoppingPoint
from sentry.seer.explorer.client_models import Artifact, MemoryBlock, Message, SeerRunState
from sentry.seer.explorer.on_completion_hook import (
    ExplorerOnCompletionHook,
    OnCompletionHookDefinition,
    call_on_completion_hook,
    extract_hook_definition,
)
from sentry.testutils.cases import TestCase


# Test hook class (defined at module level as required)
class SampleCompletionHook(ExplorerOnCompletionHook):
    @classmethod
    def execute(cls, organization: Organization, run_id: int) -> None:
        # Side effect: write to organization options so we can verify execution
        organization.update_option("test_hook_run_id", run_id)


class OnCompletionHookTest(TestCase):
    def test_extract_hook_definition(self):
        """Test extracting hook definition from a hook class."""
        hook_def = extract_hook_definition(SampleCompletionHook)

        assert isinstance(hook_def, OnCompletionHookDefinition)
        assert hook_def.module_path.endswith("test_on_completion_hook.SampleCompletionHook")

    def test_extract_hook_definition_nested_class_raises(self):
        """Test that nested classes are rejected."""

        class OuterClass:
            class NestedHook(ExplorerOnCompletionHook):
                @classmethod
                def execute(cls, organization: Organization, run_id: int) -> None:
                    pass

        with pytest.raises(ValueError) as cm:
            extract_hook_definition(OuterClass.NestedHook)
        assert "module-level class" in str(cm.value)

    def test_call_on_completion_hook_success(self):
        """Test calling a completion hook successfully."""
        module_path = "tests.sentry.seer.explorer.test_on_completion_hook.SampleCompletionHook"

        call_on_completion_hook(
            module_path=module_path,
            organization_id=self.organization.id,
            run_id=12345,
            allowed_prefixes=("sentry.", "tests.sentry."),
        )

        # Verify side effect: hook wrote run_id to organization options
        assert self.organization.get_option("test_hook_run_id") == 12345

    def test_call_on_completion_hook_security_restriction(self):
        """Test that module path must start with allowed prefix."""
        with pytest.raises(ValueError) as cm:
            call_on_completion_hook(
                module_path="malicious.module.Hook",
                organization_id=self.organization.id,
                run_id=123,
                allowed_prefixes=("sentry.",),
            )
        assert "must start with one of" in str(cm.value)

    def test_call_on_completion_hook_invalid_module(self):
        """Test calling a non-existent hook module."""
        with pytest.raises(ValueError) as cm:
            call_on_completion_hook(
                module_path="sentry.nonexistent.module.Hook",
                organization_id=self.organization.id,
                run_id=123,
            )
        assert "Could not import" in str(cm.value)

    def test_call_on_completion_hook_not_a_hook_class(self):
        """Test calling something that isn't an ExplorerOnCompletionHook."""
        # BaseModel is importable but not an ExplorerOnCompletionHook
        with pytest.raises(ValueError) as cm:
            call_on_completion_hook(
                module_path="pydantic.BaseModel",
                organization_id=self.organization.id,
                run_id=123,
                allowed_prefixes=("pydantic.",),
            )
        assert "must be a class that inherits from ExplorerOnCompletionHook" in str(cm.value)


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
        mock_state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Found solution"),
                    timestamp="2024-01-01T00:00:00Z",
                    artifacts=[
                        Artifact(
                            key="solution",
                            data={"description": "Fix the bug", "steps": ["Step 1"]},
                            reason="Generated solution",
                        )
                    ],
                )
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            metadata={
                "stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
                "group_id": group.id,
            },
        )
        mock_fetch_run_status.return_value = mock_state

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
        mock_state = SeerRunState(
            run_id=123,
            blocks=[
                MemoryBlock(
                    id="block-1",
                    message=Message(role="assistant", content="Found solution"),
                    timestamp="2024-01-01T00:00:00Z",
                    artifacts=[
                        Artifact(
                            key="solution",
                            data={"description": "Fix the bug", "steps": ["Step 1"]},
                            reason="Generated solution",
                        )
                    ],
                )
            ],
            status="completed",
            updated_at="2024-01-01T00:00:00Z",
            metadata={
                "stopping_point": AutofixStoppingPoint.CODE_CHANGES.value,
                "group_id": group.id,
            },
        )
        mock_fetch_run_status.return_value = mock_state

        # Execute the hook
        AutofixOnCompletionHook.execute(self.organization, 123)

        # Verify: trigger_autofix_explorer WAS called with CODE_CHANGES step
        mock_trigger_autofix.assert_called_once()
        call_kwargs = mock_trigger_autofix.call_args.kwargs
        assert call_kwargs["step"] == AutofixStep.CODE_CHANGES
        assert call_kwargs["group"] == group
        assert call_kwargs["run_id"] == 123
