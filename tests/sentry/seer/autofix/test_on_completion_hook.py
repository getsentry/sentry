from __future__ import annotations

from unittest.mock import MagicMock, patch

from rest_framework.exceptions import NotFound

from sentry.seer.autofix.utils import CodingAgentProviderType
from sentry.seer.models.seer_api_models import SeerAutomationHandoffConfiguration
from sentry.testutils.cases import TestCase


class TestTriggerCodingAgentHandoff(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    def _make_handoff_config(self, integration_id: int = 789) -> SeerAutomationHandoffConfiguration:
        return SeerAutomationHandoffConfiguration(
            handoff_point="root_cause",
            target=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
            integration_id=integration_id,
        )

    @patch("sentry.seer.autofix.on_completion_hook.set_project_seer_preference")
    @patch("sentry.seer.autofix.on_completion_hook.get_project_seer_preferences")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    def test_not_found_clears_automation_handoff(
        self, mock_trigger, mock_get_prefs, mock_set_pref
    ) -> None:
        from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook

        mock_trigger.side_effect = NotFound("Integration not found")

        mock_pref = MagicMock()
        mock_pref.automation_handoff = self._make_handoff_config()
        mock_pref.copy.return_value = mock_pref
        mock_get_prefs.return_value = MagicMock(preference=mock_pref)

        handoff_config = self._make_handoff_config()

        AutofixOnCompletionHook._trigger_coding_agent_handoff(
            organization=self.organization,
            run_id=1,
            group_id=self.group.id,
            handoff_config=handoff_config,
        )

        mock_get_prefs.assert_called_once_with(self.group.project_id)
        mock_pref.copy.assert_called_once_with(update={"automation_handoff": None})
        mock_set_pref.assert_called_once_with(mock_pref)

    @patch("sentry.seer.autofix.on_completion_hook.set_project_seer_preference")
    @patch("sentry.seer.autofix.on_completion_hook.get_project_seer_preferences")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    def test_not_found_no_preference_response_does_not_call_set(
        self, mock_trigger, mock_get_prefs, mock_set_pref
    ) -> None:
        from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook

        mock_trigger.side_effect = NotFound("Integration not found")
        mock_get_prefs.return_value = None

        AutofixOnCompletionHook._trigger_coding_agent_handoff(
            organization=self.organization,
            run_id=1,
            group_id=self.group.id,
            handoff_config=self._make_handoff_config(),
        )

        mock_set_pref.assert_not_called()
