from datetime import timedelta
from uuid import uuid4

from django.utils import timezone

from sentry.integrations.repository.issue_alert import (
    IssueAlertNotificationMessage,
    IssueAlertNotificationMessageRepository,
    NewIssueAlertNotificationMessage,
)
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class BaseIssueAlertNotificationMessageRepositoryTest(TestCase):
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
        self.parent_notification_message = NotificationMessage.objects.create(
            rule_action_uuid=self.action_uuid,
            message_identifier="123abc",
        )
        self.repository = IssueAlertNotificationMessageRepository.default()


class TestGetParentNotificationMessage(BaseIssueAlertNotificationMessageRepositoryTest):
    def test_returns_parent_notification_message(self) -> None:
        instance = self.repository.get_parent_notification_message(
            rule_action_uuid=self.action_uuid,
        )

        assert instance is not None
        assert instance == IssueAlertNotificationMessage.from_model(
            self.parent_notification_message
        )

    def test_returns_latest_parent_notification_message(self) -> None:
        # this can happen if somebody toggles threads on for the first time
        latest = NotificationMessage.objects.create(
            rule_action_uuid=self.action_uuid,
            message_identifier="abc123",
        )

        instance = self.repository.get_parent_notification_message(
            rule_action_uuid=self.action_uuid,
        )

        assert instance is not None
        assert instance == IssueAlertNotificationMessage.from_model(latest)

    def test_returns_none_when_filter_does_not_exist(self) -> None:
        instance = self.repository.get_parent_notification_message(
            rule_action_uuid=str(uuid4()),
        )

        assert instance is None

    def test_when_parent_has_child(self) -> None:
        child = NotificationMessage.objects.create(
            rule_action_uuid=self.action_uuid,
            message_identifier="456abc",
            parent_notification_message=self.parent_notification_message,
        )

        assert child.id != self.parent_notification_message.id

        instance = self.repository.get_parent_notification_message(
            rule_action_uuid=self.action_uuid,
        )

        assert instance is not None
        assert instance == IssueAlertNotificationMessage.from_model(
            self.parent_notification_message
        )

    def test_returns_parent_notification_message_with_open_period_start(self) -> None:
        open_period_start = timezone.now()
        NotificationMessage.objects.create(
            rule_action_uuid=self.action_uuid,
            message_identifier="789xyz",
            open_period_start=open_period_start,
        )

        notification_with_period = NotificationMessage.objects.create(
            rule_action_uuid=self.action_uuid,
            message_identifier="789xyz",
            open_period_start=open_period_start + timedelta(seconds=1),
        )

        instance = self.repository.get_parent_notification_message(
            rule_action_uuid=self.action_uuid,
            open_period_start=open_period_start + timedelta(seconds=1),
        )

        assert instance is not None
        assert instance == IssueAlertNotificationMessage.from_model(notification_with_period)
        assert instance.open_period_start == open_period_start + timedelta(seconds=1)


class TestCreateNotificationMessage(BaseIssueAlertNotificationMessageRepositoryTest):
    def test_simple(self) -> None:
        message_identifier = "1a2b3c"
        data = NewIssueAlertNotificationMessage(
            rule_action_uuid=str(uuid4()),
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
        data = NewIssueAlertNotificationMessage(
            rule_action_uuid=str(uuid4()),
            error_code=405,
            error_details=error_detail,
        )

        result = self.repository.create_notification_message(data=data)
        assert result is not None
        assert result.error_details == error_detail


class TestGetAllParentNotificationMessagesByFilters(
    BaseIssueAlertNotificationMessageRepositoryTest
):
    def test_returns_all_when_no_filters(self) -> None:
        # Create additional notification messages
        additional_notification = NotificationMessage.objects.create(
            rule_action_uuid=str(uuid4()),
            message_identifier="123abc",
        )

        # Call the method without any filters
        parent_notifications = list(
            self.repository.get_all_parent_notification_messages_by_filters()
        )

        result_ids = [parent_notification.id for parent_notification in parent_notifications]
        # Check if all notification messages are returned
        assert len(result_ids) == 2
        assert additional_notification.id in result_ids
        assert self.parent_notification_message.id in result_ids

    @freeze_time("2025-01-01 00:00:00")
    def test_returns_correct_message_when_open_period_start_is_not_none(self) -> None:
        NotificationMessage.objects.create(
            rule_action_uuid=str(uuid4()),
            message_identifier="period123",
            open_period_start=timezone.now(),
        )

        n2 = NotificationMessage.objects.create(
            rule_action_uuid=str(uuid4()),
            message_identifier="period123",
            open_period_start=timezone.now() + timedelta(seconds=1),
        )

        n3 = NotificationMessage.objects.create(
            rule_action_uuid=str(uuid4()),
            message_identifier="period123",
            open_period_start=timezone.now() + timedelta(seconds=1),
        )

        result = list(
            self.repository.get_all_parent_notification_messages_by_filters(
                open_period_start=timezone.now() + timedelta(seconds=1),
            )
        )

        result_ids = [parent_notification.id for parent_notification in result]

        assert len(result_ids) == 2
        assert n3.id in result_ids
        assert n2.id in result_ids

    @freeze_time("2025-01-01 00:00:00")
    def test_returns_none_when_open_period_start_does_not_match(self) -> None:
        # Create notifications with different open periods
        NotificationMessage.objects.create(
            rule_action_uuid=self.action_uuid,
            message_identifier="period1",
            open_period_start=timezone.now(),
        )
        NotificationMessage.objects.create(
            rule_action_uuid=self.action_uuid,
            message_identifier="period2",
            open_period_start=timezone.now() + timedelta(days=1),
        )

        # Query with a different open period
        instance = self.repository.get_parent_notification_message(
            rule_action_uuid=self.action_uuid,
            open_period_start=timezone.now() + timedelta(seconds=1),
        )

        assert instance is None
