from urllib.parse import parse_qs

import responses
from django.utils import timezone

from sentry.integrations.slack.notifications import send_notification_as_slack
from sentry.models import (
    Activity,
    Deploy,
    ExternalActor,
    Integration,
    NotificationSetting,
    Release,
    UserOption,
)
from sentry.notifications.activity import (
    AssignedActivityNotification,
    NoteActivityNotification,
    ReleaseActivityNotification,
    ResolvedActivityNotification,
    UnassignedActivityNotification,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.types.activity import ActivityType
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.compat import mock
from tests.sentry.mail.activity import ActivityTestCase


def send_notification(*args):
    args_list = list(args)[1:]
    send_notification_as_slack(*args_list)


class SlackActivityNotificationTest(ActivityTestCase):
    def setUp(self):
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.DEPLOY,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )
        UserOption.objects.create(user=self.user, key="self_notifications", value="1")
        self.integration = Integration.objects.create(
            provider="slack",
            name="Team A",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        self.integration.add_organization(self.organization, self.user)
        ExternalActor.objects.create(
            actor=self.user.actor,
            organization=self.organization,
            integration=self.integration,
            provider=ExternalProviders.SLACK.value,
            external_name="hellboy",
            external_id="UXXXXXXX1",
        )
        responses.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )
        self.name = self.user.get_display_name()
        self.short_id = self.group.qualified_short_id

    def get_attachment(self):
        data = parse_qs(responses.calls[0].request.body)
        assert "attachments" in data
        attachments = json.loads(data["attachments"][0])

        assert len(attachments) == 1
        return attachments[0]

    @responses.activate
    @mock.patch("sentry.notifications.activity.base.fire", side_effect=send_notification)
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

        attachment = self.get_attachment()

        assert attachment["title"] == "Assigned"
        assert attachment["text"] == f"{self.name} assigned {self.short_id} to {self.name}"
        assert (
            attachment["footer"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=AssignedActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=AssignedActivitySlack|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.activity.base.fire", side_effect=send_notification)
    def test_unassignment(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is unassigned
        """
        notification = UnassignedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.ASSIGNED,
                data={"assignee": ""},
            )
        )
        with self.tasks():
            notification.send()

        attachment = self.get_attachment()

        assert attachment["title"] == "Unassigned"
        assert attachment["text"] == f"{self.name} unassigned {self.short_id}"
        assert (
            attachment["footer"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=UnassignedActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=UnassignedActivitySlack|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.activity.base.fire", side_effect=send_notification)
    def test_resolved(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is resolved
        """
        notification = ResolvedActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.SET_RESOLVED,
                data={"assignee": ""},
            )
        )
        with self.tasks():
            notification.send()

        attachment = self.get_attachment()

        assert attachment["title"] == "Resolved Issue"
        assert attachment["text"] == f"{self.name} marked {self.short_id} as resolved"
        assert (
            attachment["footer"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=ResolvedActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=ResolvedActivitySlack|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.activity.base.fire", side_effect=send_notification)
    def test_note(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a comment is made on an issue
        """
        notification = NoteActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.NOTE,
                data={"text": "text", "mentions": []},
            )
        )
        with self.tasks():
            notification.send()

        attachment = self.get_attachment()

        assert attachment["title"] == f"New comment by {self.name}"
        assert attachment["text"] == notification.activity.data["text"]
        assert (
            attachment["footer"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=NoteActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=NoteActivitySlack|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.activity.base.fire", side_effect=send_notification)
    def test_deploy(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when a deploy happens
        """
        release = Release.objects.create(
            version="meow" * 10,
            organization_id=self.project.organization_id,
            date_released=timezone.now(),
        )
        release.add_project(self.project)
        deploy = Deploy.objects.create(
            release=release,
            organization_id=self.organization.id,
            environment_id=self.environment.id,
        )
        notification = ReleaseActivityNotification(
            Activity(
                project=self.project,
                user=self.user,
                type=Activity.RELEASE,
                data={"version": release.version, "deploy_id": deploy.id},
            )
        )
        with self.tasks():
            notification.send()

        attachment = self.get_attachment()
        assert (
            attachment["title"] == f"Deployed version {release.version} to {self.environment.name}"
        )
        assert (
            attachment["text"]
            == f"Version {release.version} was deployed to {self.environment.name}"
        )
        assert (
            attachment["footer"]
            == "<http://testserver/settings/account/notifications/?referrer=ReleaseActivitySlack|Notification Settings>"
        )
