import responses
from django.core import mail

from sentry.models import (
    Identity,
    IdentityProvider,
    IdentityStatus,
    NotificationSetting,
    UserOption,
)
from sentry.notifications.types import NotificationSettingOptionValues, NotificationSettingTypes
from sentry.testutils import APITestCase
from sentry.testutils.helpers import get_attachment, install_slack, link_team
from sentry.types.integrations import ExternalProviders


class AssignedNotificationAPITest(APITestCase):
    def setUp(self):
        super().setUp()

        self.integration = install_slack(self.organization)

        self.login_as(self.user)

    @responses.activate
    def test_sends_assignment_notification(self):
        """
        Test that an email AND Slack notification are sent with
        the expected values when an issue is assigned.
        """

        UserOption.objects.create(user=self.user, key="self_notifications", value="1")
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            user=self.user,
        )

        Identity.objects.create(
            external_id="UXXXXXXX1",
            idp=IdentityProvider.objects.create(type="slack", external_id="TXXXXXXX1", config={}),
            user=self.user,
            status=IdentityStatus.VALID,
            scopes=[],
        )

        url = f"/api/0/issues/{self.group.id}/"
        with self.tasks():
            response = self.client.put(url, format="json", data={"assignedTo": self.user.username})
        assert response.status_code == 200, response.content

        msg = mail.outbox[0]
        # check the txt version
        assert f"assigned {self.group.qualified_short_id} to themselves" in msg.body
        # check the html version
        assert f"{self.group.qualified_short_id}</a> to themselves</p>" in msg.alternatives[0][0]

        attachment, text = get_attachment()

        assert text == f"Issue assigned to {self.user.get_display_name()} by themselves"
        assert attachment["title"] == self.group.title
        assert self.project.slug in attachment["footer"]

    @responses.activate
    def test_sends_assignment_notification_team(self):
        link_team(
            team=self.team,
            integration=self.integration,
            channel_id="CXXXXXXX1",
            channel_name="#javascript",
        )
        NotificationSetting.objects.update_settings(
            ExternalProviders.SLACK,
            NotificationSettingTypes.WORKFLOW,
            NotificationSettingOptionValues.ALWAYS,
            team=self.team,
        )

        url = f"/api/0/issues/{self.group.id}/"
        with self.tasks():
            response = self.client.put(
                url, format="json", data={"assignedTo": f"team:{self.team.id}"}
            )
        assert response.status_code == 200, response.content

        # No email version for teams.
        assert not len(mail.outbox)

        attachment, text = get_attachment()

        assert (
            text == f"Issue assigned to the {self.team.name} team by {self.user.get_display_name()}"
        )
        assert attachment["title"] == self.group.title
        assert self.project.slug in attachment["footer"]
