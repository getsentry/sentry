from unittest import mock

from sentry.incidents.action_handlers import email_users
from sentry.incidents.models.incident import TriggerStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    OpenPeriodContext,
)
from sentry.testutils.cases import TestCase


class EmailUsersTest(TestCase):
    def _make_contexts(self):
        metric_issue_context = mock.MagicMock(spec=MetricIssueContext)
        open_period_context = mock.MagicMock(spec=OpenPeriodContext)
        alert_context = mock.MagicMock(spec=AlertContext)
        alert_context.alert_threshold = 100
        return metric_issue_context, open_period_context, alert_context

    @mock.patch("sentry.incidents.action_handlers.build_message")
    @mock.patch("sentry.incidents.action_handlers.generate_incident_trigger_email_context")
    def test_skips_missing_users(self, mock_generate_context, mock_build_message) -> None:
        """When a target user doesn't exist, it should be skipped without crashing."""
        metric_issue_context, open_period_context, alert_context = self._make_contexts()
        mock_build_message.return_value.send_async = mock.MagicMock()

        targets = [
            (self.user.id, self.user.email),
            (999999999, "deleted@example.com"),
        ]

        result = email_users(
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            alert_context=alert_context,
            trigger_status=TriggerStatus.ACTIVE,
            targets=targets,
            project=self.project,
        )

        # Only the valid user should have been emailed
        assert result == [self.user.id]
        assert mock_build_message.call_count == 1

    @mock.patch("sentry.incidents.action_handlers.build_message")
    @mock.patch("sentry.incidents.action_handlers.generate_incident_trigger_email_context")
    def test_all_users_deleted_returns_empty(
        self, mock_generate_context, mock_build_message
    ) -> None:
        """When all target users are deleted, returns empty list without crashing."""
        metric_issue_context, open_period_context, alert_context = self._make_contexts()

        targets = [
            (999999999, "deleted1@example.com"),
            (999999998, "deleted2@example.com"),
        ]

        result = email_users(
            metric_issue_context=metric_issue_context,
            open_period_context=open_period_context,
            alert_context=alert_context,
            trigger_status=TriggerStatus.ACTIVE,
            targets=targets,
            project=self.project,
        )

        assert result == []
        assert mock_build_message.call_count == 0
