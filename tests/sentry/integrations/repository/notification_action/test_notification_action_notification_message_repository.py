from datetime import timedelta

from django.utils import timezone

from sentry.integrations.repository.notification_action import (
    NewNotificationActionNotificationMessage,
    NotificationActionNotificationMessage,
    NotificationActionNotificationMessageRepository,
)
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time


class BaseNotificationActionNotificationMessageRepositoryTest(TestCase):
    def setUp(self) -> None:
        self.action = self.create_action()
        self.group = self.create_group()
        self.parent_notification_message = NotificationMessage.objects.create(
            action=self.action,
            group=self.group,
            message_identifier="123abc",
        )
        self.repository = NotificationActionNotificationMessageRepository.default()


class TestGetParentNotificationMessage(BaseNotificationActionNotificationMessageRepositoryTest):
    def test_returns_parent_notification_message(self) -> None:
        instance = self.repository.get_parent_notification_message(
            action=self.action,
            group=self.group,
        )

        assert instance is not None
        assert instance == NotificationActionNotificationMessage.from_model(
            self.parent_notification_message
        )

    def test_returns_latest_parent_notification_message(self) -> None:
        latest = NotificationMessage.objects.create(
            action=self.action,
            group=self.group,
            message_identifier="new_later_one",
        )

        instance = self.repository.get_parent_notification_message(
            action=self.action,
            group=self.group,
        )

        assert instance is not None
        assert instance == NotificationActionNotificationMessage.from_model(latest)

    def test_returns_none_when_filter_does_not_exist(self) -> None:
        different_action = self.create_action()
        instance = self.repository.get_parent_notification_message(
            action=different_action,
            group=self.group,
        )

        assert instance is None

    def test_when_parent_has_child(self) -> None:
        child = NotificationMessage.objects.create(
            action=self.action,
            group=self.group,
            message_identifier="456abc",
            parent_notification_message=self.parent_notification_message,
        )

        assert child.id != self.parent_notification_message.id

        instance = self.repository.get_parent_notification_message(
            action=self.action,
            group=self.group,
        )

        assert instance is not None
        assert instance == NotificationActionNotificationMessage.from_model(
            self.parent_notification_message
        )

    def test_returns_parent_notification_message_with_open_period_start(self) -> None:
        open_period_start = timezone.now()
        NotificationMessage.objects.create(
            action=self.action,
            group=self.group,
            message_identifier="789xyz",
            open_period_start=open_period_start,
        )

        latest_notification = NotificationMessage.objects.create(
            action=self.action,
            group=self.group,
            message_identifier="789xyz",
            open_period_start=open_period_start + timedelta(seconds=1),
        )

        instance = self.repository.get_parent_notification_message(
            action=self.action,
            group=self.group,
            open_period_start=open_period_start + timedelta(seconds=1),
        )

        assert instance is not None
        assert instance == NotificationActionNotificationMessage.from_model(latest_notification)
        assert instance.open_period_start == open_period_start + timedelta(seconds=1)


class TestCreateNotificationMessage(BaseNotificationActionNotificationMessageRepositoryTest):
    def test_simple(self) -> None:
        message_identifier = "1a2b3c"
        data = NewNotificationActionNotificationMessage(
            action_id=self.action.id,
            group_id=self.group.id,
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
        data = NewNotificationActionNotificationMessage(
            action_id=self.action.id,
            group_id=self.group.id,
            error_code=405,
            error_details=error_detail,
        )

        result = self.repository.create_notification_message(data=data)
        assert result is not None
        assert result.error_details == error_detail


class TestGetAllParentNotificationMessagesByFilters(
    BaseNotificationActionNotificationMessageRepositoryTest
):
    def test_returns_all_when_no_filters(self) -> None:
        # Create additional notification messages
        additional_notification = NotificationMessage.objects.create(
            action=self.action,
            group=self.group,
            message_identifier="123abc",
        )

        # Call the method without any filters
        parent_notifications = list(
            self.repository.get_all_parent_notification_messages_by_filters()
        )

        result_ids = []
        for parent_notification in parent_notifications:
            result_ids.append(parent_notification.id)
        # Check if all notification messages are returned
        assert len(result_ids) == 2
        assert additional_notification.id in result_ids
        assert self.parent_notification_message.id in result_ids

    def test_returns_filtered_messages_for_action_id(self) -> None:
        # Create some notification message that should not be returned
        different_action = self.create_action()
        notification_message_that_should_not_be_returned = NotificationMessage.objects.create(
            action=different_action,
            group=self.group,
            message_identifier="zxcvb",
        )

        # Call the method with filters specifying the specific action id
        parent_notifications = list(
            self.repository.get_all_parent_notification_messages_by_filters(
                action_ids=[self.action.id]
            )
        )

        result_ids = []
        for parent_notification in parent_notifications:
            result_ids.append(parent_notification.id)
        # Check if only the notifications related to the specified action
        assert len(result_ids) == 1
        assert result_ids[0] == self.parent_notification_message.id
        assert notification_message_that_should_not_be_returned.id not in result_ids

    def test_returns_filtered_messages_for_group_id(self) -> None:
        # Create some notification message that should not be returned
        new_group = self.create_group()
        notification_message_that_should_not_be_returned = NotificationMessage.objects.create(
            action=self.action,
            group=new_group,
            message_identifier="zxcvb",
        )

        # Call the method with filters specifying the specific group id
        parent_notifications = list(
            self.repository.get_all_parent_notification_messages_by_filters(
                group_ids=[self.group.id]
            )
        )

        result_ids = []
        for parent_notification in parent_notifications:
            result_ids.append(parent_notification.id)
        # Check if only the notifications related to the specified group
        assert len(result_ids) == 1
        assert result_ids[0] == self.parent_notification_message.id
        assert notification_message_that_should_not_be_returned.id not in result_ids

    @freeze_time("2025-01-01 00:00:00")
    def test_returns_correct_message_when_open_period_start_is_not_none(self) -> None:
        NotificationMessage.objects.create(
            action=self.action,
            group=self.group,
            message_identifier="period123",
            open_period_start=timezone.now(),
        )

        n2 = NotificationMessage.objects.create(
            action=self.action,
            group=self.group,
            message_identifier="period123",
            open_period_start=timezone.now() + timedelta(seconds=1),
        )

        n3 = NotificationMessage.objects.create(
            action=self.action,
            group=self.group,
            message_identifier="period123",
            open_period_start=timezone.now() + timedelta(seconds=1),
        )

        result = list(
            self.repository.get_all_parent_notification_messages_by_filters(
                action_ids=[self.action.id],
                group_ids=[self.group.id],
                open_period_start=timezone.now() + timedelta(seconds=1),
            )
        )

        result_ids = []
        for parent_notification in result:
            result_ids.append(parent_notification.id)

        assert len(result_ids) == 2
        assert n3.id in result_ids
        assert n2.id in result_ids

    @freeze_time("2025-01-01 00:00:00")
    def test_returns_none_when_open_period_start_does_not_match(self) -> None:
        # Create notifications with different open periods
        NotificationMessage.objects.create(
            action=self.action,
            group=self.group,
            message_identifier="period1",
            open_period_start=timezone.now(),
        )
        NotificationMessage.objects.create(
            action=self.action,
            group=self.group,
            message_identifier="period2",
            open_period_start=timezone.now() + timedelta(days=1),
        )

        # Query with a different open period
        instance = self.repository.get_parent_notification_message(
            action=self.action,
            group=self.group,
            open_period_start=timezone.now() + timedelta(seconds=1),
        )

        assert instance is None
