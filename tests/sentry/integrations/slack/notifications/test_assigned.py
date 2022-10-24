from unittest import mock
from urllib.parse import parse_qs

import responses

from sentry.models import Activity, Identity, IdentityProvider, IdentityStatus, Integration
from sentry.notifications.notifications.activity import AssignedActivityNotification
from sentry.testutils.cases import PerformanceIssueTestCase, SlackActivityNotificationTest
from sentry.testutils.helpers.slack import get_attachment, send_notification
from sentry.types.activity import ActivityType
from sentry.types.integrations import ExternalProviders


class SlackAssignedNotificationTest(SlackActivityNotificationTest, PerformanceIssueTestCase):
    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_multiple_identities(self, mock_func):
        """
        Test that we notify a user with multiple Identities in each place
        """
        integration2 = Integration.objects.create(
            provider="slack",
            name="Team B",
            external_id="TXXXXXXX2",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration2.add_organization(self.organization, self.user)
        idp2 = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX2", config={})
        identity2 = Identity.objects.create(
            external_id="UXXXXXXX2",
            idp=idp2,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        # create a second response
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        notification = AssignedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.ASSIGNED,
                data={"assignee": self.user.id},
            )
        )
        with self.tasks():
            notification.send()

        assert len(responses.calls) >= 2
        data = parse_qs(responses.calls[0].request.body)
        assert "channel" in data
        channel = data["channel"][0]
        assert channel == self.identity.external_id

        data = parse_qs(responses.calls[1].request.body)
        assert "channel" in data
        channel = data["channel"][0]
        assert channel == identity2.external_id

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_multiple_orgs(self, mock_func):
        """
        Test that if a user is in 2 orgs with Slack and has an Identity linked in each,
        we're only going to notify them for the relevant org
        """
        org2 = self.create_organization(owner=self.user)
        integration2 = Integration.objects.create(
            provider="slack",
            name="Team B",
            external_id="TXXXXXXX2",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        integration2.add_organization(org2, self.user)
        idp2 = IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX2", config={})
        Identity.objects.create(
            external_id="UXXXXXXX2",
            idp=idp2,
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )
        # create a second response that won't actually be used, but here to make sure it's not a false positive
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

        notification = AssignedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.ASSIGNED,
                data={"assignee": self.user.id},
            )
        )
        with self.tasks():
            notification.send()

        assert len(responses.calls) == 1
        data = parse_qs(responses.calls[0].request.body)
        assert "channel" in data
        channel = data["channel"][0]
        assert channel == self.identity.external_id

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_assignment(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is assigned
        """
        notification = AssignedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.ASSIGNED,
                data={"assignee": self.user.id},
            )
        )
        with self.tasks():
            notification.send()
        attachment, text = get_attachment()
        assert text == f"Issue assigned to {self.name} by themselves"
        assert attachment["title"] == self.group.title
        assert (
            attachment["footer"]
            == f"{self.project.slug} | <http://testserver/settings/account/notifications/workflow/?referrer=assigned_activity-slack-user|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_assignment_performance_issue(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a performance issue is assigned
        """
        event = self.create_performance_issue()
        notification = AssignedActivityNotification(
            Activity(
                project=self.project,
                group=event.group,
                user=self.user,
                type=ActivityType.ASSIGNED,
                data={"assignee": self.user.id},
            )
        )
        with self.feature("organizations:performance-issues"), self.tasks():
            notification.send()

        attachment, text = get_attachment()
        assert text == f"Issue assigned to {self.name} by themselves"
        assert attachment["title"] == "N+1 Query"
        assert (
            attachment["text"]
            == "db - SELECT `books_author`.`id`, `books_author`.`name` FROM `books_author` WHERE `books_author`.`id` = %s LIMIT 21"
        )
        assert (
            attachment["footer"]
            == f"{self.project.slug} | production | <http://testserver/settings/account/notifications/workflow/?referrer=assigned_activity-slack-user|Notification Settings>"
        )

    def test_automatic_assignment(self):
        notification = AssignedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                type=ActivityType.ASSIGNED,
                data={"assignee": self.user.id},
            )
        )
        assert (
            notification.get_notification_title(ExternalProviders.SLACK)
            == f"Issue automatically assigned to {self.user.get_display_name()}"
        )
