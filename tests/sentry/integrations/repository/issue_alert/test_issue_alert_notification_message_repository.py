from uuid import uuid4

from sentry.integrations.repository.issue_alert import IssueAlertNotificationMessage
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.notifications.models.notificationmessage import NotificationMessage
from sentry.testutils.cases import TestCase


class TestIssueAlertNotificationMessageFromModel(TestCase):
    def test_from_model(self) -> None:
        action_uuid = str(uuid4())
        rule = self.create_project_rule(
            project=self.project,
            action_data=[
                {
                    "targetType": "IssueOwners",
                    "fallthroughType": "ActiveMembers",
                    "id": "sentry.mail.actions.NotifyEmailAction",
                    "targetIdentifier": "",
                    "uuid": action_uuid,
                }
            ],
        )
        rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=rule,
            group=self.group,
            event_id=456,
            notification_uuid=str(uuid4()),
        )
        message = NotificationMessage.objects.create(
            rule_fire_history=rule_fire_history,
            rule_action_uuid=action_uuid,
            message_identifier="123abc",
        )

        result = IssueAlertNotificationMessage.from_model(message)
        assert result.id == message.id
        assert result.rule_action_uuid == action_uuid
        assert result.message_identifier == "123abc"
