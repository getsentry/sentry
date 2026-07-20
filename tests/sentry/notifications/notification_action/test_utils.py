import uuid
from unittest import mock

import pytest

from sentry.exceptions import InvalidIdentity
from sentry.notifications.notification_action.utils import (
    execute_via_issue_alert_handler,
    execute_via_metric_alert_handler,
)
from sentry.shared_integrations.exceptions import (
    ApiUnauthorized,
    IntegrationConfigurationError,
    IntegrationFormError,
)
from sentry.workflow_engine.models import Action
from sentry.workflow_engine.types import ActionInvocation, WorkflowEventData
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class ExecuteViaHandlerLoggingBase(BaseWorkflowTest):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.detector = self.create_detector(project=self.project)
        self.workflow = self.create_workflow()
        self.action = Action(type=Action.Type.DISCORD)
        self.group, self.event, self.group_event = self.create_group_event()
        self.event_data = WorkflowEventData(event=self.group_event, group=self.group)

    def _make_invocation(self) -> ActionInvocation:
        return ActionInvocation(
            event_data=self.event_data,
            action=self.action,
            detector=self.detector,
            notification_uuid=str(uuid.uuid4()),
            workflow_id=self.workflow.id,
        )


class TestExecuteViaIssueAlertHandlerLogging(ExecuteViaHandlerLoggingBase):
    @pytest.mark.parametrize(
        "exc",
        [
            IntegrationFormError({"repo": "Given repository does not belong to this installation"}),
            IntegrationConfigurationError("Invalid integration configuration"),
            InvalidIdentity(),
            ApiUnauthorized("Unauthorized"),
        ],
    )
    @mock.patch("sentry.notifications.notification_action.utils.logger")
    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get"
    )
    def test_integration_config_errors_logged_as_warning_not_exception(
        self,
        mock_registry_get: mock.MagicMock,
        mock_logger: mock.MagicMock,
        exc: Exception,
    ) -> None:
        """Integration config errors should be logged at WARNING, not ERROR, and re-raised."""
        mock_handler = mock.Mock()
        mock_handler.invoke_legacy_registry.side_effect = exc
        mock_registry_get.return_value = mock_handler

        with pytest.raises(type(exc)):
            execute_via_issue_alert_handler(self._make_invocation())

        mock_logger.warning.assert_called_once()
        mock_logger.exception.assert_not_called()

    @mock.patch("sentry.notifications.notification_action.utils.logger")
    @mock.patch(
        "sentry.notifications.notification_action.registry.issue_alert_handler_registry.get"
    )
    def test_unexpected_errors_still_logged_as_exception(
        self,
        mock_registry_get: mock.MagicMock,
        mock_logger: mock.MagicMock,
    ) -> None:
        """Unexpected errors should still be logged at ERROR level."""
        mock_handler = mock.Mock()
        mock_handler.invoke_legacy_registry.side_effect = RuntimeError("unexpected")
        mock_registry_get.return_value = mock_handler

        with pytest.raises(RuntimeError):
            execute_via_issue_alert_handler(self._make_invocation())

        mock_logger.exception.assert_called_once()
        mock_logger.warning.assert_not_called()


class TestExecuteViaMetricAlertHandlerLogging(ExecuteViaHandlerLoggingBase):
    @pytest.mark.parametrize(
        "exc",
        [
            IntegrationFormError({"repo": "Given repository does not belong to this installation"}),
            IntegrationConfigurationError("Invalid integration configuration"),
            InvalidIdentity(),
            ApiUnauthorized("Unauthorized"),
        ],
    )
    @mock.patch("sentry.notifications.notification_action.utils.logger")
    @mock.patch(
        "sentry.notifications.notification_action.registry.metric_alert_handler_registry.get"
    )
    def test_integration_config_errors_logged_as_warning_not_exception(
        self,
        mock_registry_get: mock.MagicMock,
        mock_logger: mock.MagicMock,
        exc: Exception,
    ) -> None:
        """Integration config errors should be logged at WARNING, not ERROR, and re-raised."""
        mock_handler = mock.Mock()
        mock_handler.invoke_legacy_registry.side_effect = exc
        mock_registry_get.return_value = mock_handler

        with pytest.raises(type(exc)):
            execute_via_metric_alert_handler(self._make_invocation())

        mock_logger.warning.assert_called_once()
        mock_logger.exception.assert_not_called()

    @mock.patch("sentry.notifications.notification_action.utils.logger")
    @mock.patch(
        "sentry.notifications.notification_action.registry.metric_alert_handler_registry.get"
    )
    def test_unexpected_errors_still_logged_as_exception(
        self,
        mock_registry_get: mock.MagicMock,
        mock_logger: mock.MagicMock,
    ) -> None:
        """Unexpected errors should still be logged at ERROR level."""
        mock_handler = mock.Mock()
        mock_handler.invoke_legacy_registry.side_effect = RuntimeError("unexpected")
        mock_registry_get.return_value = mock_handler

        with pytest.raises(RuntimeError):
            execute_via_metric_alert_handler(self._make_invocation())

        mock_logger.exception.assert_called_once()
        mock_logger.warning.assert_not_called()
