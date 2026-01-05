from unittest.mock import MagicMock, patch

from sentry.seer.autofix.autofix_agent import (
    AutofixStep,
    build_step_prompt,
    trigger_autofix_explorer,
)
from sentry.sentry_apps.utils.webhooks import SeerActionType
from sentry.testutils.cases import TestCase


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
