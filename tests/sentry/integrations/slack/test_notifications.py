from urllib.parse import parse_qs

import responses

from sentry.integrations.slack.notifications import send_notification_as_slack
from sentry.models import Activity, ExternalActor, Integration, NotificationSetting, UserOption
from sentry.notifications.activity import NoteActivityNotification
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
        self.org = self.create_organization(name="foo", owner=self.user)
        self.integration.add_organization(self.org, self.user)
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

    def get_attachment(self):
        data = parse_qs(responses.calls[0].request.body)
        assert "attachments" in data
        attachments = json.loads(data["attachments"][0])

        assert len(attachments) == 1
        return attachments[0]

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

        attachments = self.get_attachment()
        assert attachments["title"] == "New comment by admin@localhost"
