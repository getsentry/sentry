from unittest.mock import patch

from rest_framework.exceptions import NotFound

from sentry.seer.autofix.utils import AutofixTriggerSource
from sentry.testutils.cases import TestCase


class TestTriggerCodingAgentLaunch(TestCase):
    def setUp(self):
        super().setUp()
        self.organization = self.create_organization()
        self.integration = self.create_integration(
            organization=self.organization,
            provider="cursor",
            external_id="cursor-123",
        )
        self.run_id = 12345

    @patch("sentry.seer.endpoints.seer_rpc.launch_coding_agents_for_run")
    def test_trigger_coding_agent_launch_success(self, mock_launch):
        from sentry.seer.endpoints.seer_rpc import trigger_coding_agent_launch

        result = trigger_coding_agent_launch(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            run_id=self.run_id,
            trigger_source="solution",
        )

        assert result == {"success": True, "error": None}
        mock_launch.assert_called_once_with(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            run_id=self.run_id,
            trigger_source=AutofixTriggerSource.SOLUTION,
        )

    @patch("sentry.seer.endpoints.seer_rpc.launch_coding_agents_for_run")
    def test_trigger_coding_agent_launch_integration_not_found(self, mock_launch):
        from sentry.seer.endpoints.seer_rpc import trigger_coding_agent_launch

        error_msg = f"Integration 999 is not connected to organization {self.organization.id}"
        mock_launch.side_effect = NotFound(error_msg)

        result = trigger_coding_agent_launch(
            organization_id=self.organization.id,
            integration_id=999,
            run_id=self.run_id,
            trigger_source="solution",
        )

        assert result["success"] is False
        assert result["error"] == error_msg

    @patch("sentry.seer.endpoints.seer_rpc.launch_coding_agents_for_run")
    def test_trigger_coding_agent_launch_other_exception(self, mock_launch):
        from rest_framework.exceptions import ValidationError

        from sentry.seer.endpoints.seer_rpc import trigger_coding_agent_launch

        error_msg = "Not a coding agent integration"
        mock_launch.side_effect = ValidationError(error_msg)

        result = trigger_coding_agent_launch(
            organization_id=self.organization.id,
            integration_id=self.integration.id,
            run_id=self.run_id,
            trigger_source="solution",
        )

        assert result["success"] is False
        assert result["error"] == error_msg
