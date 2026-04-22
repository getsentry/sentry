from sentry.workflow_engine.types import ActionInvocation
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class TestIssueNotificationDispatcher(BaseWorkflowTest):
    def _create_invocation(self) -> ActionInvocation:
        # Create all of the necessary resources for an ActionInvocation, using
        # default integration, project, and organization available on the base
        # TestCase.
        raise NotImplementedError("Not implemented")

    def test_dispatch(self) -> None:
        # dispatcher = IssueNotificationDispatcher(self._create_invocation())
        pass

    def rejects_notification_for_non_enabled_providers(self) -> None:
        pass

    def rejects_notification_for_non_metric_activity_notifications(self) -> None:
        pass

    def correctly_classifies_metric_alert_notification(self) -> None:
        pass

    def correctly_dispatches_metric_alert_notification(self) -> None:
        # Check that the data payload is correct
        # Check that the target is valid given the integration and target IDs
        # Check that the threading options are correct
        pass

    def correctly_classifies_issue_alert_notification(self) -> None:
        pass

    def correctly_dispatches_issue_alert_notification(self) -> None:
        # Check that the data payload is correct
        # Check that the target is valid given the integration and target IDs
        # Check that the threading options are correct
        pass
