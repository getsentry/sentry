from unittest.mock import MagicMock, Mock, call, patch

import responses

from sentry.integrations.msteams.notifications import send_notification_as_msteams
from sentry.models import Activity
from sentry.notifications.notifications.activity import NoteActivityNotification
from sentry.testutils.cases import MSTeamsActivityNotificationTest, TestCase
from sentry.testutils.helpers.notifications import (
    DummyNotification,
    DummyNotificationWithMoreFields,
)
from sentry.testutils.silo import control_silo_test
from sentry.types.activity import ActivityType
from sentry.utils import json

TEST_CARD = {"type": "test_card"}


@patch(
    "sentry.integrations.msteams.MSTeamsNotificationsMessageBuilder.build_notification_card",
    Mock(return_value=TEST_CARD),
)
@patch(
    "sentry.integrations.msteams.notifications.SUPPORTED_NOTIFICATION_TYPES",
    [DummyNotification],
)
@patch(
    "sentry.integrations.msteams.MsTeamsAbstractClient.get_user_conversation_id",
    Mock(return_value="some_conversation_id"),
)
@patch(
    "sentry.integrations.msteams.MsTeamsAbstractClient.get_member_list",
    Mock(return_value={"members": [{"user": "some_user", "tenantId": "some_tenant_id"}]}),
)
@patch("sentry.integrations.msteams.MsTeamsAbstractClient.send_card")
@control_silo_test
class MSTeamsNotificationTest(TestCase):
    def _install_msteams_personal(self):
        self.tenant_id = "50cccd00-7c9c-4b32-8cda-58a084f9334a"
        self.integration = self.create_integration(
            self.organization,
            self.tenant_id,
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "service_url": "https://testserviceurl.com/testendpoint/",
                "installation_type": "tenant",
                "expires_at": 1234567890,
                "tenant_id": self.tenant_id,
            },
            name="Personal Installation",
            provider="msteams",
        )
        self.idp = self.create_identity_provider(
            integration=self.integration, type="msteams", external_id=self.tenant_id, config={}
        )
        self.user_id_1 = "29:1XJKJMvc5GBtc2JwZq0oj8tHZmzrQgFmB39ATiQWA85gQtHieVkKilBZ9XHoq9j7Zaqt7CZ-NJWi7me2kHTL3Bw"
        self.user_1 = self.user
        self.identity_1 = self.create_identity(
            user=self.user_1, identity_provider=self.idp, external_id=self.user_id_1
        )

    def _install_msteams_team(self):
        self.team_id = "19:8d46058cda57449380517cc374727f2a@thread.tacv2"
        self.integration = self.create_integration(
            self.organization,
            self.team_id,
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "service_url": "https://testserviceurl.com/testendpoint/",
                "expires_at": 1234567890,
            },
            name="Team Installation",
            provider="msteams",
        )
        self.idp = self.create_identity_provider(
            integration=self.integration, type="msteams", external_id=self.team_id, config={}
        )
        self.user_id_1 = "29:1XJKJMvc5GBtc2JwZq0oj8tHZmzrQgFmB39ATiQWA85gQtHieVkKilBZ9XHoq9j7Zaqt7CZ-NJWi7me2kHTL3Bw"
        self.user_1 = self.user
        self.identity_1 = self.create_identity(
            user=self.user_1, identity_provider=self.idp, external_id=self.user_id_1
        )

    def setUp(self):
        super().setUp()

    def test_simple(
        self,
        mock_send_card: MagicMock,
    ):
        self._install_msteams_personal()

        notification = DummyNotification(self.organization)
        with self.tasks():
            send_notification_as_msteams(notification, [self.user_1], {}, {})

        mock_send_card.assert_called_once_with("some_conversation_id", TEST_CARD)

    def test_unsupported_notification_type(self, mock_send_card: MagicMock):
        """
        Unsupported notification types should not be sent.
        """
        self._install_msteams_personal()

        notification = DummyNotification(self.organization)

        with patch(
            "sentry.integrations.msteams.notifications.SUPPORTED_NOTIFICATION_TYPES",
            [DummyNotificationWithMoreFields],
        ):
            with self.tasks():
                send_notification_as_msteams(notification, [self.user_1], {}, {})

        mock_send_card.assert_not_called()

    def test_missing_tenant_id(self, mock_send_card: MagicMock):
        self._install_msteams_team()

        with patch(
            "sentry.integrations.msteams.MsTeamsAbstractClient.get_user_conversation_id",
        ) as mock_get_user_conversation_id:
            mock_get_user_conversation_id.return_value = "some_conversation_id"

            notification = DummyNotification(self.organization)
            with self.tasks():
                send_notification_as_msteams(notification, [self.user_1], {}, {})

            mock_get_user_conversation_id.assert_called_once_with(self.user_id_1, "some_tenant_id")
            mock_send_card.assert_called_once_with("some_conversation_id", TEST_CARD)

    def test_no_identity(self, mock_send_card: MagicMock):
        """
        Notification should not be sent when identity is not linked.
        """
        self._install_msteams_team()

        user_2 = self.create_user()
        self.create_identity(user=user_2, identity_provider=self.idp, external_id=self.team_id)

        notification = DummyNotification(self.organization)
        with self.tasks():
            send_notification_as_msteams(notification, [user_2], {}, {})

        mock_send_card.assert_not_called()

    def test_multiple(self, mock_send_card: MagicMock):
        self._install_msteams_personal()

        user_2 = self.create_user()
        user_id_2 = "some_external_user_id"
        self.create_identity(user=user_2, identity_provider=self.idp, external_id=user_id_2)

        notification = DummyNotification(self.organization)
        with self.tasks():
            send_notification_as_msteams(notification, [self.user_1, user_2], {}, {})

        mock_send_card.assert_has_calls(
            [call("some_conversation_id", TEST_CARD), call("some_conversation_id", TEST_CARD)]
        )


class MSTeamsNotificationIntegrationTest(MSTeamsActivityNotificationTest):
    """
    Test the MS Teams notification flow end to end without mocking out functions.
    """

    def _setup_msteams_api(self):
        responses.add(
            method=responses.POST,
            url="https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            body='{"access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx", "expires_in": "1234567890"}',
            status=200,
            content_type="application/json",
        )

        responses.add(
            method=responses.POST,
            url="https://testserviceurl.com/testendpoint/v3/conversations",
            body='{"id": "some_conversation_id"}',
            status=200,
            content_type="application/json",
        )

        responses.add(
            method=responses.POST,
            url="https://testserviceurl.com/testendpoint/v3/conversations/some_conversation_id/activities",
            body='{"ok": true}',
            status=200,
            content_type="application/json",
        )

    def setUp(self):
        super().setUp()
        self._setup_msteams_api()

    @responses.activate
    def test_send_note_activity_notification(self):
        notification = NoteActivityNotification(
            Activity(
                project=self.project,
                group=self.group,
                user_id=self.user.id,
                type=ActivityType.NOTE,
                data={"text": "text", "mentions": []},
            )
        )

        with self.tasks():
            notification.send()

        data = json.loads(responses.calls[-1].request.body)

        attachment = data["attachments"][0]
        assert "AdaptiveCard" == attachment["content"]["type"]
        assert 4 == len(attachment["content"]["body"])

        assert (
            f"New comment by {self.user.get_display_name()}"
            == attachment["content"]["body"][0]["text"]
        )
