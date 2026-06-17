from unittest import mock

import pytest

from sentry.notifications.notification_action.activity_registry.unsupported import (
    UnsupportedActivityHandler,
)
from sentry.notifications.notification_action.registry import activity_handler_registry
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import Action
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest

UNSUPPORTED_ACTION_TYPES = [
    Action.Type.PAGERDUTY,
    Action.Type.OPSGENIE,
    Action.Type.GITHUB,
    Action.Type.GITHUB_ENTERPRISE,
    Action.Type.JIRA,
    Action.Type.JIRA_SERVER,
    Action.Type.AZURE_DEVOPS,
    Action.Type.SENTRY_APP,
    Action.Type.PLUGIN,
    Action.Type.WEBHOOK,
]


@pytest.mark.parametrize("action_type", UNSUPPORTED_ACTION_TYPES)
def test_unsupported_registrations(action_type: Action.Type) -> None:
    assert activity_handler_registry.get(action_type) is UnsupportedActivityHandler


class TestUnsupportedActivityHandler(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.workflow, self.detector, _, _ = self.create_detector_and_workflow()
        self.integration = self.create_integration(
            organization=self.organization, provider="pagerduty", external_id="pd_ext_id"
        )
        self.action = self.create_action(
            type=Action.Type.PAGERDUTY,
            integration_id=self.integration.id,
            config={
                "target_identifier": "some_service",
                "target_type": 0,
            },
        )

    @mock.patch("sentry.notifications.notification_action.activity_registry.unsupported.logger")
    def test_invoke_action_logs_and_returns(self, mock_logger: mock.MagicMock) -> None:
        activity = self.create_group_activity(
            group=self.group,
            type=ActivityType.SEER_RCA_STARTED.value,
        )
        invocation = self.create_action_invocation(
            event=activity,
            group=self.group,
            action=self.action,
            detector=self.detector,
            workflow_id=self.workflow.id,
        )
        UnsupportedActivityHandler.invoke_action(invocation=invocation, activity=activity)

        mock_logger.info.assert_called_once_with(
            "notification_action.activity.unsupported",
            extra={
                "action_id": self.action.id,
                "action_type": Action.Type.PAGERDUTY,
                "activity_type": ActivityType.SEER_RCA_STARTED.value,
                "activity_type_name": "SEER_RCA_STARTED",
            },
        )
