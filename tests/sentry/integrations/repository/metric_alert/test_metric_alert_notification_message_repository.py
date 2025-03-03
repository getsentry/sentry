from sentry.integrations.repository.metric_alert import (
    MetricAlertNotificationMessage,
    MetricAlertNotificationMessageRepository,
    NewMetricAlertNotificationMessage,
)
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.testutils.cases import TestCase


class TestGetParentNotificationMessage(TestCase):
    def setUp(self) -> None:
        self.incident = self.create_incident()
        self.trigger_action = self.create_alert_rule_trigger_action()
        self.parent_notification_message = NotificationMessage.objects.create(
            incident=self.incident,
            trigger_action=self.trigger_action,
            message_identifier="123abc",
        )
        self.repository = MetricAlertNotificationMessageRepository.default()

    def test_returns_parent_notification_message(self) -> None:
        instance = self.repository.get_parent_notification_message(
            alert_rule_id=self.incident.alert_rule.id,
            incident_id=self.incident.id,
            trigger_action_id=self.trigger_action.id,
        )

        assert instance is not None
        assert instance == MetricAlertNotificationMessage.from_model(
            self.parent_notification_message
        )

    def test_returns_none_when_filter_does_not_exist(self) -> None:
        instance = self.repository.get_parent_notification_message(
            alert_rule_id=9999,
            incident_id=self.incident.id,
            trigger_action_id=self.trigger_action.id,
        )

        assert instance is None

    def test_when_parent_has_child(self) -> None:
        child = NotificationMessage.objects.create(
            incident=self.incident,
            trigger_action=self.trigger_action,
            message_identifier="456abc",
            parent_notification_message=self.parent_notification_message,
        )

        assert child.id != self.parent_notification_message.id

        instance = self.repository.get_parent_notification_message(
            alert_rule_id=self.incident.alert_rule.id,
            incident_id=self.incident.id,
            trigger_action_id=self.trigger_action.id,
        )

        assert instance is not None
        assert instance == MetricAlertNotificationMessage.from_model(
            self.parent_notification_message
        )


class TestCreateNotificationMessage(TestCase):
    def setUp(self):
        self.incident = self.create_incident()
        self.trigger_action = self.create_alert_rule_trigger_action()
        self.repository = MetricAlertNotificationMessageRepository.default()

    def test_simple(self) -> None:
        message_identifier = "1a2b3c"
        data = NewMetricAlertNotificationMessage(
            incident_id=self.incident.id,
            trigger_action_id=self.trigger_action.id,
            message_identifier=message_identifier,
        )

        result = self.repository.create_notification_message(data=data)
        assert result is not None
        assert result.message_identifier == message_identifier

    def test_with_error_details(self) -> None:
        error_detail = {
            "message": "message",
            "some_nested_obj": {
                "some_nested_key": "some_nested_value",
                "some_array": ["some_array"],
                "int": 203,
            },
        }
        data = NewMetricAlertNotificationMessage(
            incident_id=self.incident.id,
            trigger_action_id=self.trigger_action.id,
            error_code=405,
            error_details=error_detail,
        )

        result = self.repository.create_notification_message(data=data)
        assert result is not None
        assert result.error_details == error_detail
