from unittest.mock import MagicMock, patch

from sentry.incidents.models.alert_rule import AlertRuleDetectionType, AlertRuleThresholdType
from sentry.incidents.models.incident import IncidentStatus
from sentry.incidents.typings.metric_detector import (
    AlertContext,
    MetricIssueContext,
    NotificationContext,
)
from sentry.rules.actions.notify_event_service import send_incident_alert_notification
from sentry.snuba.models import SnubaQuery
from sentry.testutils.cases import TestCase


class SendIncidentAlertNotificationTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.organization = self.create_organization()
        self.project = self.create_project(organization=self.organization)
        self.sentry_app = self.create_sentry_app(
            name="test_app", organization=self.organization, is_alertable=True
        )

    @patch("sentry.rules.actions.notify_event_service.integration_service")
    def test_sends_correct_parameters_to_rpc_method(self, mock_integration_service: MagicMock) -> None:
        """Test that send_incident_alert_notification passes correct values instead of -1 placeholders"""
        mock_integration_service.send_incident_alert_notification.return_value = True

        # Create test data
        notification_context = NotificationContext(
            id=12345,
            sentry_app_id=str(self.sentry_app.id),
        )

        alert_context = AlertContext(
            name="Test Alert",
            action_identifier_id=67890,
            threshold_type=AlertRuleThresholdType.ABOVE,
            detection_type=AlertRuleDetectionType.STATIC,
            comparison_delta=None,
            sensitivity=None,
            resolve_threshold=100.0,
            alert_threshold=200.0,
        )

        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            aggregate="count()",
            time_window=60,
            resolution=60,
        )

        metric_issue_context = MetricIssueContext(
            id=54321,
            open_period_identifier=99999,
            title="Test Metric Issue",
            snuba_query=snuba_query,
            new_status=IncidentStatus.CRITICAL,
            subscription=None,
            metric_value=123.45,
            group=None,
        )

        incident_serialized_response = {
            "id": "54321",
            "identifier": "99999",
            "title": "Test Metric Issue",
        }

        notification_uuid = "test-uuid-123"

        # Call the function
        result = send_incident_alert_notification(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            incident_serialized_response=incident_serialized_response,
            organization=self.organization,
            notification_uuid=notification_uuid,
        )

        # Verify the RPC method was called with correct parameters
        assert result is True
        mock_integration_service.send_incident_alert_notification.assert_called_once()

        call_kwargs = mock_integration_service.send_incident_alert_notification.call_args[1]

        # Verify that actual values are passed instead of -1 placeholders
        assert call_kwargs["sentry_app_id"] == self.sentry_app.id  # Converted to int
        assert call_kwargs["action_id"] == 12345  # notification_context.id
        assert call_kwargs["incident_id"] == 54321  # metric_issue_context.id
        assert call_kwargs["metric_value"] == 123.45  # metric_issue_context.metric_value
        assert call_kwargs["new_status"] == IncidentStatus.CRITICAL.value
        assert call_kwargs["organization_id"] == self.organization.id
        assert call_kwargs["notification_uuid"] == notification_uuid

    @patch("sentry.rules.actions.notify_event_service.integration_service")
    def test_handles_none_metric_value(self, mock_integration_service: MagicMock) -> None:
        """Test that None metric_value is handled correctly"""
        mock_integration_service.send_incident_alert_notification.return_value = True

        notification_context = NotificationContext(
            id=12345,
            sentry_app_id=str(self.sentry_app.id),
        )

        alert_context = AlertContext(
            name="Test Alert",
            action_identifier_id=67890,
            threshold_type=AlertRuleThresholdType.ABOVE,
            detection_type=AlertRuleDetectionType.STATIC,
            comparison_delta=None,
            sensitivity=None,
            resolve_threshold=100.0,
            alert_threshold=200.0,
        )

        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            aggregate="count()",
            time_window=60,
            resolution=60,
        )

        metric_issue_context = MetricIssueContext(
            id=54321,
            open_period_identifier=99999,
            title="Test Metric Issue",
            snuba_query=snuba_query,
            new_status=IncidentStatus.CRITICAL,
            subscription=None,
            metric_value=None,  # None value
            group=None,
        )

        incident_serialized_response = {"id": "54321"}

        send_incident_alert_notification(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            incident_serialized_response=incident_serialized_response,
            organization=self.organization,
        )

        call_kwargs = mock_integration_service.send_incident_alert_notification.call_args[1]
        assert call_kwargs["metric_value"] == 0.0  # None is converted to 0.0

    @patch("sentry.rules.actions.notify_event_service.integration_service")
    def test_handles_dict_metric_value(self, mock_integration_service: MagicMock) -> None:
        """Test that dict metric_value is handled correctly"""
        mock_integration_service.send_incident_alert_notification.return_value = True

        notification_context = NotificationContext(
            id=12345,
            sentry_app_id=str(self.sentry_app.id),
        )

        alert_context = AlertContext(
            name="Test Alert",
            action_identifier_id=67890,
            threshold_type=AlertRuleThresholdType.ABOVE,
            detection_type=AlertRuleDetectionType.STATIC,
            comparison_delta=None,
            sensitivity=None,
            resolve_threshold=100.0,
            alert_threshold=200.0,
        )

        snuba_query = SnubaQuery.objects.create(
            type=SnubaQuery.Type.ERROR.value,
            dataset="events",
            aggregate="count()",
            time_window=60,
            resolution=60,
        )

        metric_issue_context = MetricIssueContext(
            id=54321,
            open_period_identifier=99999,
            title="Test Metric Issue",
            snuba_query=snuba_query,
            new_status=IncidentStatus.CRITICAL,
            subscription=None,
            metric_value={"value": 456.78},  # Dict with 'value' key
            group=None,
        )

        incident_serialized_response = {"id": "54321"}

        send_incident_alert_notification(
            notification_context=notification_context,
            alert_context=alert_context,
            metric_issue_context=metric_issue_context,
            incident_serialized_response=incident_serialized_response,
            organization=self.organization,
        )

        call_kwargs = mock_integration_service.send_incident_alert_notification.call_args[1]
        assert call_kwargs["metric_value"] == 456.78  # Extracted from dict
