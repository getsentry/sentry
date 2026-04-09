from __future__ import annotations

from unittest.mock import MagicMock, Mock, patch

from sentry.seer.autofix.coding_agent import IntegrationNotFound
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.utils import CodingAgentProviderType
from sentry.seer.models.seer_api_models import (
    SeerAutomationHandoffConfiguration,
    SeerProjectPreference,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


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
        mock_trigger.side_effect = IntegrationNotFound("Integration not found")

        mock_pref = MagicMock()
        mock_pref.automation_handoff = self._make_handoff_config()
        mock_pref.copy.return_value = mock_pref
        mock_get_prefs.return_value = MagicMock(preference=mock_pref)

        handoff_config = self._make_handoff_config()

        AutofixOnCompletionHook._trigger_coding_agent_handoff(
            organization=self.organization,
            run_id=1,
            group=self.group,
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
        mock_trigger.side_effect = IntegrationNotFound("Integration not found")
        mock_get_prefs.return_value = Mock(preference=None)

        AutofixOnCompletionHook._trigger_coding_agent_handoff(
            organization=self.organization,
            run_id=1,
            group=self.group,
            handoff_config=self._make_handoff_config(),
        )

        mock_set_pref.assert_not_called()

    @with_feature("organizations:seer-project-settings-read-from-sentry")
    @patch("sentry.seer.autofix.on_completion_hook.set_project_seer_preference")
    @patch("sentry.seer.autofix.on_completion_hook.read_preference_from_sentry_db")
    @patch("sentry.seer.autofix.on_completion_hook.get_project_seer_preferences")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    def test_not_found_reads_from_sentry_db(
        self, mock_trigger, mock_get_prefs, mock_read_db, mock_set_pref
    ) -> None:
        """When feature flag enabled, reads preferences from Sentry DB to clear handoff."""

        mock_trigger.side_effect = IntegrationNotFound("Integration not found")
        mock_read_db.return_value = SeerProjectPreference(
            organization_id=self.organization.id,
            project_id=self.project.id,
            repositories=[],
            automation_handoff=self._make_handoff_config(),
        )

        AutofixOnCompletionHook._trigger_coding_agent_handoff(
            organization=self.organization,
            run_id=1,
            group=self.group,
            handoff_config=self._make_handoff_config(),
        )

        mock_get_prefs.assert_not_called()
        mock_read_db.assert_called_once_with(self.project)
        mock_set_pref.assert_called_once()
        updated_pref = mock_set_pref.call_args[0][0]
        assert updated_pref.automation_handoff is None
