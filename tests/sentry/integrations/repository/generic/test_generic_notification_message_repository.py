from uuid import uuid4

from sentry.integrations.repository.generic import (
    GenericNotificationMessage,
    GenericNotificationMessageRepository,
    NewGenericNotificationMessage,
)
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.testutils.cases import TestCase

# TODO: Test that we raise validation errors when the composite key is not set or if the other FK fields are set


class TestGetParentNotificationMessageMetricAlert(TestCase):
    def setUp(self) -> None:
        self.incident = self.create_incident()
        self.trigger_action = self.create_alert_rule_trigger_action()
        self.composite_key = (
            f"{self.incident.alert_rule.id}:{self.incident.id}:{self.trigger_action.id}"
        )
        self.parent_notification_message = NotificationMessage.objects.create(
            message_identifier="123abc",
            composite_key=self.composite_key,
        )
        self.repository: GenericNotificationMessageRepository = (
            GenericNotificationMessageRepository.default()
        )

    def test_returns_parent_notification_message(self) -> None:
        instance = self.repository.get_parent_notification_message(
            composite_key=self.composite_key,
        )

        assert instance is not None
        assert instance == GenericNotificationMessage.from_model(self.parent_notification_message)

    def test_returns_none_when_filter_does_not_exist(self) -> None:
        instance = self.repository.get_parent_notification_message(composite_key="")

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
            composite_key=self.composite_key,
        )

        assert instance is not None
        assert instance == GenericNotificationMessage.from_model(self.parent_notification_message)


class TestGetParentNotificationMessageIssueAlert(TestCase):
    def setUp(self) -> None:
        self.action_uuid = str(uuid4())
        self.notify_issue_owners_action = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
                "uuid": self.action_uuid,
            }
        ]
        self.rule = self.create_project_rule(
            project=self.project, action_data=self.notify_issue_owners_action
        )
        self.event_id = 456
        self.notification_uuid = str(uuid4())
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.group,
            event_id=self.event_id,
            notification_uuid=self.notification_uuid,
        )
        # TODO: Test with the composite key builders when they are implemented
        self.composite_key = f"{self.rule.id}:{self.group.id}:{self.action_uuid}"
        self.parent_notification_message = NotificationMessage.objects.create(
            message_identifier="123abc",
            composite_key=self.composite_key,
        )
        self.repository = GenericNotificationMessageRepository.default()

    def test_returns_parent_notification_message(self) -> None:
        instance = self.repository.get_parent_notification_message(
            composite_key=self.composite_key,
        )

        assert instance is not None
        assert instance == GenericNotificationMessage.from_model(self.parent_notification_message)

    def test_returns_latest_parent_notification_message(self) -> None:
        latest = NotificationMessage.objects.create(
            message_identifier="abc123new",
            composite_key=self.composite_key,
            group_id=self.group.id,
        )

        instance = self.repository.get_parent_notification_message(
            composite_key=self.composite_key,
        )

        assert instance is not None
        assert instance == GenericNotificationMessage.from_model(latest)

    def test_returns_none_when_filter_does_not_exist(self) -> None:
        instance = self.repository.get_parent_notification_message(
            composite_key="",
        )

        assert instance is None

    def test_when_parent_has_child(self) -> None:
        child = NotificationMessage.objects.create(
            message_identifier="456abc",
            parent_notification_message=self.parent_notification_message,
            composite_key=self.composite_key,
        )

        assert child.id != self.parent_notification_message.id

        instance = self.repository.get_parent_notification_message(
            composite_key=self.composite_key,
        )

        assert instance is not None
        assert instance == GenericNotificationMessage.from_model(self.parent_notification_message)


class TestCreateNotificationMessageMetricAlert(TestCase):
    def setUp(self) -> None:
        self.incident = self.create_incident()
        self.trigger_action = self.create_alert_rule_trigger_action()
        self.composite_key = (
            f"{self.incident.alert_rule.id}:{self.incident.id}:{self.trigger_action.id}"
        )
        self.parent_notification_message = NotificationMessage.objects.create(
            message_identifier="123abc",
            composite_key=self.composite_key,
        )
        self.repository: GenericNotificationMessageRepository = (
            GenericNotificationMessageRepository.default()
        )

    def test_simple(self) -> None:
        message_identifier = "1a2b3c"
        data = NewGenericNotificationMessage(
            composite_key=self.composite_key,
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
        data = NewGenericNotificationMessage(
            composite_key=self.composite_key,
            error_code=405,
            error_details=error_detail,
        )

        result = self.repository.create_notification_message(data=data)
        assert result is not None
        assert result.error_details == error_detail


class TestCreateNotificationMessageIssueAlert(TestCase):
    def setUp(self) -> None:
        self.action_uuid = str(uuid4())
        self.notify_issue_owners_action = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
                "uuid": self.action_uuid,
            }
        ]
        self.rule = self.create_project_rule(
            project=self.project, action_data=self.notify_issue_owners_action
        )
        self.event_id = 456
        self.notification_uuid = str(uuid4())
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.group,
            event_id=self.event_id,
            notification_uuid=self.notification_uuid,
        )
        # TODO: Test with the composite key builders when they are implemented
        self.composite_key = f"{self.rule.id}:{self.group.id}:{self.action_uuid}"
        self.parent_notification_message = NotificationMessage.objects.create(
            message_identifier="123abc",
            composite_key=self.composite_key,
        )
        self.repository = GenericNotificationMessageRepository.default()

    def test_simple(self) -> None:
        message_identifier = "1a2b3c"
        data = NewGenericNotificationMessage(
            composite_key=self.composite_key,
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

        data = NewGenericNotificationMessage(
            composite_key=self.composite_key,
            error_code=405,
            error_details=error_detail,
        )

        result = self.repository.create_notification_message(data=data)
        assert result is not None
        assert result.error_details == error_detail
