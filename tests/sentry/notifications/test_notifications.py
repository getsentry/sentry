from django.core import mail
import responses

from sentry.models import UserOption, NotificationSetting, Integration, ExternalActor
from sentry.notifications.types import (
    NotificationSettingOptionValues,
    NotificationSettingTypes,
)
from sentry.testutils import APITestCase
from sentry.types.integrations import ExternalProviders


def get_attachment():
    assert len(responses.calls) >= 1
    data = parse_qs(responses.calls[0].request.body)
    assert "attachments" in data
    attachments = json.loads(data["attachments"][0])

    assert len(attachments) == 1
    return attachments[0]

class ActivityNotificationTest(APITestCase):
    def setUp(self):
        super().setUp()
        # NotificationSetting.objects.update_settings(
        #     ExternalProviders.SLACK,
        #     NotificationSettingTypes.WORKFLOW,
        #     NotificationSettingOptionValues.ALWAYS,
        #     user=self.user,
        # )
        self.login_as(self.user)
        UserOption.objects.create(user=self.user, key="self_notifications", value="1")
        # self.integration = Integration.objects.create(
        #     provider="slack",
        #     name="Team A",
        #     external_id="TXXXXXXX1",
        #     metadata={
        #         "access_token": "xoxp-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
        #         "installation_type": "born_as_bot",
        #     },
        # )
        # self.integration.add_organization(self.organization, self.user)
        # ExternalActor.objects.create(
        #     actor=self.user.actor,
        #     organization=self.organization,
        #     integration=self.integration,
        #     provider=ExternalProviders.SLACK.value,
        #     external_name="hellboy",
        #     external_id="UXXXXXXX1",
        # )
        # responses.add(
        #     method=responses.POST,
        #     url="https://slack.com/api/chat.postMessage",
        #     body='{"ok": true}',
        #     status=200,
        #     content_type="application/json",
        # )
        # self.name = self.user.get_display_name()
        # self.short_id = self.group.qualified_short_id

    @responses.activate
    def test_sends_note(self):
        # TODO extend this to also send a Slack notification
        # create a note
        url = f"/api/0/issues/{self.group.id}/comments/"
        with self.tasks():
            response = self.client.post(url, format="json", data={"text": "blah blah"})
        assert response.status_code == 201, response.content

        msg = mail.outbox[0]
        # check the txt version
        assert "blah blah" in msg.body
        # check the html version
        assert "blah blah</p></div>" in msg.alternatives[0][0]

        # attachment = get_attachment()

        # assert attachment["title"] == f"New comment by {self.name}"
        # assert attachment["text"] == notification.activity.data["text"]
        # assert (
        #     attachment["footer"]
        #     == f"<http://testserver/organizations/{self.organization.slug}/issues/{self.group.id}/?referrer=NoteActivitySlack|{self.short_id}> via <http://testserver/settings/account/notifications/?referrer=NoteActivitySlack|Notification Settings>"
        # )
