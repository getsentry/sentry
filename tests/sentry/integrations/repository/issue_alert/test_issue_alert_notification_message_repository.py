from uuid import uuid4

from sentry.integrations.repository.issue_alert import (
    IssueAlertNotificationMessage,
    IssueAlertNotificationMessageRepository,
    NewIssueAlertNotificationMessage,
)
from sentry.models.notificationmessage import NotificationMessage
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.testutils.cases import TestCase


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
        self.event_id = 456
        self.notification_uuid = str(uuid4())
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.group,
            event_id=self.event_id,
            notification_uuid=self.notification_uuid,
        )
        self.parent_notification_message = NotificationMessage.objects.create(
            rule_fire_history=self.rule_fire_history,
            rule_action_uuid=self.action_uuid,
            message_identifier="123abc",
        )
        self.repository = IssueAlertNotificationMessageRepository.default()


class TestGetParentNotificationMessage(BaseIssueAlertNotificationMessageRepositoryTest):
    def test_returns_parent_notification_message(self) -> None:
        instance = self.repository.get_parent_notification_message(
            rule_id=self.rule.id,
            group_id=self.group.id,
            rule_action_uuid=self.action_uuid,
        )

        assert instance is not None
        assert instance == IssueAlertNotificationMessage.from_model(
            self.parent_notification_message
        )

    def test_returns_latest_parent_notification_message(self) -> None:
        # this can happen if somebody toggles threads on for the first time
        rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.group,
            event_id=self.event_id,
            notification_uuid=self.notification_uuid,
        )

        latest = NotificationMessage.objects.create(
            rule_fire_history=rule_fire_history,
            rule_action_uuid=self.action_uuid,
            message_identifier="abc123",
        )

        instance = self.repository.get_parent_notification_message(
            rule_id=self.rule.id,
            group_id=self.group.id,
            rule_action_uuid=self.action_uuid,
        )

        assert instance is not None
        assert instance == IssueAlertNotificationMessage.from_model(latest)

    def test_returns_none_when_filter_does_not_exist(self) -> None:
        instance = self.repository.get_parent_notification_message(
            rule_id=9999,
            group_id=self.group.id,
            rule_action_uuid=self.action_uuid,
        )

        assert instance is None

    def test_when_parent_has_child(self) -> None:
        child = NotificationMessage.objects.create(
            rule_fire_history=self.rule_fire_history,
            rule_action_uuid=self.action_uuid,
            message_identifier="456abc",
            parent_notification_message=self.parent_notification_message,
        )

        assert child.id != self.parent_notification_message.id

        instance = self.repository.get_parent_notification_message(
            rule_id=self.rule.id,
            group_id=self.group.id,
            rule_action_uuid=self.action_uuid,
        )

        assert instance is not None
        assert instance == IssueAlertNotificationMessage.from_model(
            self.parent_notification_message
        )


class TestCreateNotificationMessage(BaseIssueAlertNotificationMessageRepositoryTest):
    def test_simple(self) -> None:
        message_identifier = "1a2b3c"
        data = NewIssueAlertNotificationMessage(
            rule_fire_history_id=self.rule_fire_history.id,
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
            rule_fire_history_id=self.rule_fire_history.id,
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
            rule_fire_history=self.rule_fire_history,
            rule_action_uuid=str(uuid4()),
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

    def test_returns_filtered_messages_for_project_id(self) -> None:
        # Create some notification message that should not be returned
        new_project = self.create_project()
        additional_rule_fire_history = RuleFireHistory.objects.create(
            project=new_project,
            rule=self.rule,
            group=self.group,
            event_id=self.event_id,
            notification_uuid=str(uuid4()),
        )
        notification_message_that_should_not_be_returned = NotificationMessage.objects.create(
            rule_fire_history=additional_rule_fire_history,
            rule_action_uuid=str(uuid4()),
            message_identifier="zxcvb",
        )

        # Call the method with filters specifying the specific project id
        parent_notifications = list(
            self.repository.get_all_parent_notification_messages_by_filters(
                project_ids=[self.project.id]
            )
        )

        result_ids = []
        for parent_notification in parent_notifications:
            result_ids.append(parent_notification.id)
        # Check if only the notifications related to the specified project
        assert len(result_ids) == 1
        assert result_ids[0] == self.parent_notification_message.id
        assert notification_message_that_should_not_be_returned.id not in result_ids

    def test_returns_filtered_messages_for_group_id(self) -> None:
        # Create some notification message that should not be returned
        new_group = self.create_group(project=self.project)
        additional_rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=new_group,
            event_id=self.event_id,
            notification_uuid=str(uuid4()),
        )
        notification_message_that_should_not_be_returned = NotificationMessage.objects.create(
            rule_fire_history=additional_rule_fire_history,
            rule_action_uuid=str(uuid4()),
            message_identifier="zxcvb",
        )

        # Call the method with filters specifying the specific project id
        parent_notifications = list(
            self.repository.get_all_parent_notification_messages_by_filters(
                group_ids=[self.group.id]
            )
        )

        result_ids = []
        for parent_notification in parent_notifications:
            result_ids.append(parent_notification.id)
        # Check if only the notifications related to the specified project
        assert len(result_ids) == 1
        assert result_ids[0] == self.parent_notification_message.id
        assert notification_message_that_should_not_be_returned.id not in result_ids
