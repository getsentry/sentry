from uuid import uuid4

from sentry.integrations.repository.issue_alert import (
    IssueAlertNotificationMessage,
    IssueAlertNotificationMessageRepository,
)
from sentry.models.notificationmessage import NotificationMessage
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.testutils.cases import TestCase


class TestGetParentNotificationMessage(TestCase):
    def setUp(self) -> None:
        self.action_uuid = str(uuid4())
        self.rule = self.create_project_rule(
            project=self.project,
            action_match=[
                {
                    "id": "sentry.rules.actions.notify_event_service.NotifyEventServiceAction",
                    "service": "mail",
                    "name": "Send a notification via mail",
                    "uuid": self.action_uuid,
                },
            ],
        )
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.group,
        )
        self.parent_notification_message = NotificationMessage.objects.create(
            rule_fire_history=self.rule_fire_history,
            rule_action_uuid=self.action_uuid,
            message_identifier="123abc",
        )
        self.repository = IssueAlertNotificationMessageRepository.default()

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
