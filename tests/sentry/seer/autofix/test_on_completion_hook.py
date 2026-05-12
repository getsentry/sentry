from __future__ import annotations

from unittest.mock import patch

from sentry.seer.autofix.coding_agent import IntegrationNotFound
from sentry.seer.autofix.on_completion_hook import AutofixOnCompletionHook
from sentry.seer.autofix.utils import CodingAgentProviderType
from sentry.seer.models.seer_api_models import SeerAutomationHandoffConfiguration
from sentry.testutils.cases import TestCase


class TestTriggerCodingAgentHandoff(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.group = self.create_group(project=self.project)

    @patch("sentry.seer.autofix.on_completion_hook.trigger_coding_agent_handoff")
    def test_not_found_clears_automation_handoff(self, mock_trigger) -> None:
        mock_trigger.side_effect = IntegrationNotFound("Integration not found")

        self.project.update_option("sentry:seer_automation_handoff_point", "root_cause")
        self.project.update_option(
            "sentry:seer_automation_handoff_target", CodingAgentProviderType.CURSOR_BACKGROUND_AGENT
        )
        self.project.update_option("sentry:seer_automation_handoff_integration_id", 789)
        self.project.update_option("sentry:seer_automation_handoff_auto_create_pr", True)

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

        assert self.project.get_option("sentry:seer_automation_handoff_point") is None
        assert self.project.get_option("sentry:seer_automation_handoff_target") is None
        assert self.project.get_option("sentry:seer_automation_handoff_integration_id") is None
        assert self.project.get_option("sentry:seer_automation_handoff_auto_create_pr") is False
