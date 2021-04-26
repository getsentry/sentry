from urllib.parse import parse_qs

import responses
from django.utils import timezone
from exam import fixture

from sentry.integrations.slack.notifications import (
    send_activity_notification_as_slack,
    send_issue_notification_as_slack,
)
from sentry.mail import mail_adapter
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
    NewProcessingIssuesActivityNotification,
    NoteActivityNotification,
    RegressionActivityNotification,
    ReleaseActivityNotification,
    ResolvedActivityNotification,
    ResolvedInReleaseActivityNotification,
    UnassignedActivityNotification,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils import TestCase
from sentry.types.activity import ActivityType
from sentry.types.integrations import ExternalProviders
from sentry.utils import json
from sentry.utils.compat import mock
from tests.sentry.mail.activity import ActivityTestCase


def send_notification(*args):
    args_list = list(args)[1:]
    send_activity_notification_as_slack(*args_list)


def send_issue_notification(*args):
    args_list = list(args)[1:]
    send_issue_notification_as_slack(*args_list)


def get_attachment():
    assert len(responses.calls) >= 1
    data = parse_qs(responses.calls[0].request.body)
    assert "attachments" in data
    attachments = json.loads(data["attachments"][0])

    assert len(attachments) == 1
    return attachments[0]


class SlackActivityNotificationTest(ActivityTestCase, TestCase):
    @fixture
    def adapter(self):
        return mail_adapter

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
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.ISSUE_ALERTS,
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

        attachment = get_attachment()

        assert attachment["title"] == "Assigned"
        assert attachment["text"] == f"{self.name} assigned {self.short_id} to {self.name}"
        assert (
            attachment["footer"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=AssignedActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=AssignedActivitySlack|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
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

        attachment = get_attachment()

        assert attachment["title"] == "Unassigned"
        assert attachment["text"] == f"{self.name} unassigned {self.short_id}"
        assert (
            attachment["footer"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=UnassignedActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=UnassignedActivitySlack|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
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

        attachment = get_attachment()

        assert attachment["title"] == "Resolved Issue"
        assert attachment["text"] == f"{self.name} marked {self.short_id} as resolved"
        assert (
            attachment["footer"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=ResolvedActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=ResolvedActivitySlack|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_regression(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue regresses
        """
        notification = RegressionActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.SET_REGRESSION,
                data={},
            )
        )
        with self.tasks():
            notification.send()

        attachment = get_attachment()

        assert attachment["title"] == "Regression"
        assert attachment["text"] == f"{self.name} marked {self.short_id} as a regression"
        assert (
            attachment["footer"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=RegressionActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=RegressionActivitySlack|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_new_processing_issue(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is held back in reprocessing
        """
        data = [
            {
                "data": {
                    "image_arch": "arm64",
                    "image_path": "/var/containers/Bundle/Application/FB14D416-DE4E-4224-9789-6B88E9C42601/CrashProbeiOS.app/CrashProbeiOS",
                    "image_uuid": "a2df1794-e0c7-371c-baa4-93eac340a78a",
                },
                "object": "dsym:a2df1794-e0c7-371c-baa4-93eac340a78a",
                "scope": "native",
                "type": "native_missing_dsym",
            },
            {
                "data": {
                    "image_arch": "arm64",
                    "image_path": "/var/containers/Bundle/Application/FB14D416-DE4E-4224-9789-6B88E9C42601/CrashProbeiOS.app/libCrashProbeiOS",
                    "image_uuid": "12dc1b4c-a01b-463f-ae88-5cf0c31ae680",
                },
                "object": "dsym:12dc1b4c-a01b-463f-ae88-5cf0c31ae680",
                "scope": "native",
                "type": "native_bad_dsym",
            },
        ]
        notification = NewProcessingIssuesActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.NEW_PROCESSING_ISSUES,
                data={
                    "issues": data,
                    "reprocessing_active": True,
                },
            )
        )
        with self.tasks():
            notification.send()

        attachment = get_attachment()

        assert attachment["title"] == f"Processing Issues on {self.project.slug}"
        assert (
            attachment["text"]
            == f"Some events failed to process in your project {self.project.slug}"
        )
        assert (
            attachment["footer"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=NewProcessingIssuesActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=NewProcessingIssuesActivitySlack|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
    def test_resolved_in_release(self, mock_func):
        """
        Test that a Slack message is sent with the expected payload when an issue is resolved in a release
        """
        notification = ResolvedInReleaseActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user=self.user,
                type=ActivityType.SET_RESOLVED_IN_RELEASE,
                data={"version": "meow"},
            )
        )
        with self.tasks():
            notification.send()

        attachment = get_attachment()
        release_name = notification.activity.data["version"]
        assert attachment["title"] == "Resolved Issue"
        assert (
            attachment["text"]
            == f"{self.name} marked {self.short_id} as resolved in {release_name}"
        )
        assert (
            attachment["footer"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=ResolvedInReleaseActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=ResolvedInReleaseActivitySlack|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
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

        attachment = get_attachment()

        assert attachment["title"] == f"New comment by {self.name}"
        assert attachment["text"] == notification.activity.data["text"]
        assert (
            attachment["footer"]
            == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=NoteActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=NoteActivitySlack|Notification Settings>"
        )

    @responses.activate
    @mock.patch("sentry.notifications.notify.notify", side_effect=send_notification)
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

        attachment = get_attachment()
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

    # @responses.activate
    # @mock.patch("sentry.mail.notify.notify_participants", side_effect=send_issue_notification)
    # def test_issue_alert_user(self, mock_func):
    #     """
    #     Test that issue alerts are sent to a Slack user. This is commented out for now because
    #     users can't set it up yet - once we update the front end we'll allow for this in get_send_to and need the test
    #     """
    #     from sentry.mail.adapter import ActionTargetType
    #     from sentry.models import Rule
    #     from sentry.plugins.base import Notification

    #     event = self.store_event(
    #         data={"message": "Hello world", "level": "error"}, project_id=self.project.id
    #     )
    #     action_data = {
    #         "id": "sentry.mail.actions.NotifyEmailAction",
    #         "targetType": "Member",
    #         "targetIdentifier": str(self.user.id),
    #     }
    #     rule = Rule.objects.create(
    #         project=self.project,
    #         label="ja rule",
    #         data={
    #             "match": "all",
    #             "actions": [action_data],
    #         },
    #     )

    #     notification = Notification(event=event, rule=rule)

    #     with self.options({"system.url-prefix": "http://example.com"}), self.tasks():
    #         self.adapter.notify(notification, ActionTargetType.MEMBER, self.user.id)

    #     attachment = get_attachment()

    #     assert attachment["title"] == "Hello world"
    #     assert attachment["text"] == ""
    #     assert attachment["footer"] == event.group.qualified_short_id
