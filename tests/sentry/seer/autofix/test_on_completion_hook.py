from __future__ import annotations

from unittest.mock import patch

from sentry.seer.autofix.coding_agent import IntegrationNotFound
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.utils import CodingAgentProviderType
from sentry.seer.models.seer_api_models import SeerAutomationHandoffConfiguration
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


@with_feature("organizations:seer-project-settings-dual-write")
class TestTriggerCodingAgentHandoff(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    @patch("sentry.seer.autofix.on_completion_hook.write_preference_to_sentry_db")
    @patch("sentry.seer.autofix.on_completion_hook.set_project_seer_preference")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    def test_not_found_clears_automation_handoff(
        self, mock_trigger, mock_set_pref, mock_write_db
    ) -> None:
        mock_trigger.side_effect = IntegrationNotFound("Integration not found")

        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", CodingAgentProviderType.CURSOR_BACKGROUND_AGENT
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 789)

        AutofixOnCompletionHook._trigger_coding_agent_handoff(
            organization=self.organization,
            run_id=1,
            group=self.group,
            handoff_config=SeerAutomationHandoffConfiguration(
                handoff_point="root_cause",
                target=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
                integration_id=789,
            ),
        )

        mock_set_pref.assert_called_once()
        updated_pref = mock_set_pref.call_args[0][0]
        assert updated_pref.automation_handoff is None

        mock_write_db.assert_called_once()
        assert mock_write_db.call_args[0][0] == self.project
        assert mock_write_db.call_args[0][1].automation_handoff is None

    @patch("sentry.seer.autofix.on_completion_hook.write_preference_to_sentry_db")
    @patch("sentry.seer.autofix.on_completion_hook.set_project_seer_preference")
    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    def test_not_found_no_handoff_does_not_call_set(
        self, mock_trigger, mock_set_pref, mock_write_db
    ) -> None:
        """With no handoff options set on the project, set_project_seer_preference is skipped."""
        mock_trigger.side_effect = IntegrationNotFound("Integration not found")

        # Handoff is passed to the function but not actually set in ProjectOptions.
        handoff_config = SeerAutomationHandoffConfiguration(
            handoff_point="root_cause",
            target=CodingAgentProviderType.CURSOR_BACKGROUND_AGENT,
            integration_id=789,
        )

        AutofixOnCompletionHook._trigger_coding_agent_handoff(
            organization=self.organization,
            run_id=1,
            group=self.group,
            handoff_config=handoff_config,
        )

        mock_set_pref.assert_not_called()
        mock_write_db.assert_not_called()
