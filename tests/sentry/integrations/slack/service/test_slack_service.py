from datetime import datetime
from unittest import mock
from uuid import uuid4

import pytest

from sentry.integrations.repository.issue_alert import IssueAlertNotificationMessage
from sentry.integrations.slack.service import RuleDataError, SlackService
from sentry.models.activity import Activity
from sentry.models.notificationmessage import NotificationMessage
from sentry.models.rulefirehistory import RuleFireHistory
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class TestGetNotificationMessageToSend(TestCase):
    def setUp(self) -> None:
        self.service = SlackService.default()

    def test_ignores_unsupported_activity(self) -> None:
        activity = Activity.objects.create(
            group=self.group,
            project=self.project,
            type=ActivityType.FIRST_SEEN.value,
            user_id=self.user.id,
            data={},
        )
        result = self.service._get_notification_message_to_send(activity=activity)
        assert result is None

    def test_simple(self) -> None:
        activity = Activity.objects.create(
            group=self.group,
            project=self.project,
            type=ActivityType.SET_IGNORED.value,
            user_id=self.user.id,
            data={"ignoreUntilEscalating": True},
        )
        result = self.service._get_notification_message_to_send(activity=activity)
        assert result == "admin@localhost archived BAR-1"


class TestHandleParentNotification(TestCase):
    def setUp(self) -> None:
        """
        Setup default and reusable testing data or objects
        """
        self.service = SlackService.default()

        self.rule_action_uuid = str(uuid4())
        self.notify_issue_owners_action = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
                "uuid": self.rule_action_uuid,
            }
        ]
        self.rule = self.create_project_rule(
            project=self.project, action_match=self.notify_issue_owners_action
        )
        self.rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=self.rule,
            group=self.group,
            event_id=456,
            notification_uuid=str(uuid4()),
        )

    def test_raises_exception_when_parent_notification_does_not_have_rule_fire_history_data(
        self,
    ) -> None:
        """
        Purposefully create a domain object that does not have rule_fire_history
        """
        parent_notification = IssueAlertNotificationMessage(
            id=123,
            date_added=datetime.now(),
            message_identifier="1a2s3d",
            rule_action_uuid=str(uuid4()),
        )
        with pytest.raises(RuleDataError) as err:
            self.service._handle_parent_notification(
                parent_notification=parent_notification,
                notification_to_send="",
                client=mock.MagicMock(),
            )
            assert (
                err.value
                == f"parent notification {parent_notification.id} does not have a rule_fire_history"
            )

    def test_raises_exception_when_parent_notification_does_not_have_rule_action_uuid(self) -> None:
        """
        Purposefully create a domain object that does not have the rule_action_uuid
        """
        parent_notification = IssueAlertNotificationMessage(
            id=123,
            date_added=datetime.now(),
            message_identifier="1a2s3d",
            rule_fire_history=self.rule_fire_history,
        )
        with pytest.raises(RuleDataError) as err:
            self.service._handle_parent_notification(
                parent_notification=parent_notification,
                notification_to_send="",
                client=mock.MagicMock(),
            )
            assert (
                err.value
                == f"parent notification {parent_notification.id} does not have a rule_action_uuid"
            )

    def test_raises_exception_when_rule_action_does_not_exist(self) -> None:
        """
        Purposefully create a mismatch between the rule action uuid so that it does not exist
        """
        notify_issue_owners_action = [
            {
                "targetType": "IssueOwners",
                "fallthroughType": "ActiveMembers",
                "id": "sentry.mail.actions.NotifyEmailAction",
                "targetIdentifier": "",
                "uuid": (uuid4()),
            }
        ]
        rule = self.create_project_rule(
            project=self.project, action_match=notify_issue_owners_action
        )
        rule_fire_history = RuleFireHistory.objects.create(
            project=self.project,
            rule=rule,
            group=self.group,
            event_id=456,
            notification_uuid=str(uuid4()),
        )
        parent_notification_message = NotificationMessage.objects.create(
            rule_fire_history=rule_fire_history,
            rule_action_uuid=str(uuid4()),
            message_identifier="123abc",
        )
        parent_notification = IssueAlertNotificationMessage.from_model(parent_notification_message)
        with pytest.raises(RuleDataError) as err:
            self.service._handle_parent_notification(
                parent_notification=parent_notification,
                notification_to_send="",
                client=mock.MagicMock(),
            )
            assert (
                err.value
                == f"failed to find rule action {parent_notification.rule_action_uuid} for rule {rule.id}"
            )

    def test_raises_exception_when_rule_action_does_not_have_channel_id(self) -> None:
        parent_notification_message = NotificationMessage.objects.create(
            rule_fire_history=self.rule_fire_history,
            rule_action_uuid=self.rule_action_uuid,
            message_identifier="123abc",
        )
        parent_notification = IssueAlertNotificationMessage.from_model(parent_notification_message)
        with pytest.raises(RuleDataError) as err:
            self.service._handle_parent_notification(
                parent_notification=parent_notification,
                notification_to_send="",
                client=mock.MagicMock(),
            )
            assert (
                err.value
                == f"failed to get channel_id for rule {self.rule.id} and rule action {parent_notification.rule_action_uuid}"
            )
