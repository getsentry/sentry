from unittest.mock import MagicMock, Mock, patch

from sentry.models import ProjectOwnership, Rule
from sentry.notifications.notifications.rules import AlertRuleNotification
from sentry.notifications.types import ActionTargetType
from sentry.plugins.base import Notification
from sentry.testutils.cases import MSTeamsActivityNotificationTest
from sentry.testutils.silo import region_silo_test


@patch(
    "sentry.integrations.msteams.MsTeamsAbstractClient.get_user_conversation_id",
    Mock(return_value="some_conversation_id"),
)
@patch("sentry.integrations.msteams.MsTeamsAbstractClient.send_card")
@region_silo_test
class MSTeamsIssueAlertNotificationTest(MSTeamsActivityNotificationTest):
    def test_issue_alert_user(self, mock_send_card: MagicMock):
        """Test that issue alerts are sent to a MS Teams user."""

        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "Member",
            "targetIdentifier": str(self.user.id),
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )

        notification = AlertRuleNotification(
            Notification(event=event, rule=rule), ActionTargetType.MEMBER, self.user.id
        )

        with self.tasks():
            notification.send()

        mock_send_card.assert_called_once()

        args, kwargs = mock_send_card.call_args

        assert args[0] == "some_conversation_id"

        body = args[1]["body"]
        assert 4 == len(body)

        assert (
            f"Alert triggered [{rule.label}](http://testserver/organizations/baz/alerts/rules/bar/{rule.id}/details/)"
            == body[0]["text"]
        )
        assert (
            f"[{event.title}](http://testserver/organizations/{self.organization.slug}/issues/{event.group_id}/?referrer=issue\\_alert-msteams)"
            == body[1]["text"]
        )
        assert (
            f"{self.project.slug} | [Notification Settings](http://testserver/settings/account/notifications/alerts/?referrer=issue\\_alert-msteams-user)"
            == body[3]["columns"][1]["items"][0]["text"]
        )

    def test_issue_alert_owners(self, mock_send_card: MagicMock):
        event = self.store_event(
            data={"message": "Hello world", "level": "error"}, project_id=self.project.id
        )
        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": "IssueOwners",
            "targetIdentifier": "",
        }
        rule = Rule.objects.create(
            project=self.project,
            label="ja rule",
            data={
                "match": "all",
                "actions": [action_data],
            },
        )
        ProjectOwnership.objects.create(project_id=self.project.id, fallthrough=True)

        notification = AlertRuleNotification(
            Notification(event=event, rule=rule), ActionTargetType.ISSUE_OWNERS, self.user.id
        )

        with self.tasks():
            notification.send()

        mock_send_card.assert_called_once()

        args, kwargs = mock_send_card.call_args

        assert args[0] == "some_conversation_id"

        body = args[1]["body"]
        assert 4 == len(body)

        assert (
            f"Alert triggered [{rule.label}](http://testserver/organizations/baz/alerts/rules/bar/{rule.id}/details/)"
            == body[0]["text"]
        )
        assert (
            f"[{event.title}](http://testserver/organizations/{self.organization.slug}/issues/{event.group_id}/?referrer=issue\\_alert-msteams)"
            == body[1]["text"]
        )
        assert (
            f"{self.project.slug} | [Notification Settings](http://testserver/settings/account/notifications/alerts/?referrer=issue\\_alert-msteams-user)"
            == body[3]["columns"][1]["items"][0]["text"]
        )
