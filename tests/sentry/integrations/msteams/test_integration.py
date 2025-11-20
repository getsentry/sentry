from unittest.mock import MagicMock, patch
from urllib.parse import urlencode

import pytest
import responses

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.msteams.integration import MsTeamsIntegration, MsTeamsIntegrationProvider
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.shared_integrations.exceptions import ApiError, IntegrationConfigurationError
from sentry.testutils.cases import IntegrationTestCase, TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.signing import sign

team_id = "19:8d46058cda57449380517cc374727f2a@thread.tacv2"
user_id = (
    "29:1XJKJMvc5GBtc2JwZq0oj8tHZmzrQgFmB39ATiQWA85gQtHieVkKilBZ9XHoq9j7Zaqt7CZ-NJWi7me2kHTL3Bw"
)
tenant_id = "50cccd00-7c9c-4b32-8cda-58a084f9334a"


@control_silo_test
class MsTeamsIntegrationTest(IntegrationTestCase):
    provider = MsTeamsIntegrationProvider

    def setUp(self) -> None:
        super().setUp()
        self.start_time = 1594768808
        self.pipeline_state = {
            "external_id": team_id,
            "service_url": "https://smba.trafficmanager.net/amer/",
            "external_name": "my_team",
            "user_id": user_id,
            "conversation_id": team_id,
            "tenant_id": tenant_id,
        }

    def assert_team_installation_post_install(self) -> None:
        integration_url = f"organizations/{self.organization.slug}/alerts/rules/"
        assert integration_url in responses.calls[1].request.body.decode("utf-8")
        assert self.organization.name in responses.calls[1].request.body.decode("utf-8")

    def assert_personal_installation_post_install(self) -> None:
        integration_url = "/settings/account/notifications"
        request_body = responses.calls[1].request.body.decode("utf-8")
        assert "Personal installation successful" in request_body
        assert integration_url in request_body

    def assert_setup_flow(self, installation_type: str) -> None:
        responses.reset()

        responses.add(
            responses.POST,
            "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities" % team_id,
            json={},
        )

        with patch("time.time") as mock_time:
            mock_time.return_value = self.start_time
            # token mock
            access_json = {"expires_in": 86399, "access_token": "my_token"}
            responses.add(
                responses.POST,
                "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
                json=access_json,
            )

            self.pipeline_state.update({"installation_type": installation_type})

            params = {"signed_params": sign(**self.pipeline_state)}

            self.pipeline.bind_state(self.provider.key, self.pipeline_state)
            resp = self.client.get(self.setup_path, params)

            body = responses.calls[0].request.body
            assert body == urlencode(
                {
                    "client_id": "msteams-client-id",
                    "client_secret": "msteams-client-secret",
                    "grant_type": "client_credentials",
                    "scope": "https://api.botframework.com/.default",
                }
            )

            assert resp.status_code == 200
            self.assertDialogSuccess(resp)

            integration = Integration.objects.get(provider=self.provider.key)

            assert integration.external_id == team_id
            assert integration.name == "my_team"
            assert integration.metadata == {
                "access_token": "my_token",
                "service_url": "https://smba.trafficmanager.net/amer/",
                "expires_at": self.start_time + 86399 - 60 * 5,
                "installation_type": installation_type,
                "tenant_id": tenant_id,
            }
            assert OrganizationIntegration.objects.get(
                integration=integration, organization_id=self.organization.id
            )

            if "team" == installation_type:
                self.assert_team_installation_post_install()
            else:
                self.assert_personal_installation_post_install()

    @responses.activate
    def test_team_installation(self) -> None:
        self.assert_setup_flow(installation_type="team")

    @responses.activate
    def test_personal_installation(self) -> None:
        self.assert_setup_flow(installation_type="tenant")


@control_silo_test
class MsTeamsIntegrationSendNotificationTest(TestCase):
    def setUp(self) -> None:
        self.integration = self.create_provider_integration(
            provider="msteams",
            name="MS Teams",
            external_id=team_id,
            metadata={
                "access_token": "test-access-token",
                "service_url": "https://smba.trafficmanager.net/amer/",
                "installation_type": "team",
                "tenant_id": tenant_id,
            },
        )
        self.installation = MsTeamsIntegration(self.integration, self.organization.id)
        self.target = IntegrationNotificationTarget(
            provider_key=NotificationProviderKey.MSTEAMS,
            resource_type=NotificationTargetResourceType.CHANNEL,
            resource_id="conversation123",
            integration_id=self.integration.id,
            organization_id=self.organization.id,
        )

    @patch("sentry.integrations.msteams.client.MsTeamsClient.send_card")
    def test_send_notification_success(self, mock_send_card: MagicMock) -> None:
        from sentry.integrations.msteams.card_builder.block import AdaptiveCard

        payload: AdaptiveCard = {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2",
            "body": [],
        }

        self.installation.send_notification(target=self.target, payload=payload)

        mock_send_card.assert_called_once_with(conversation_id="conversation123", card=payload)

    @patch("sentry.integrations.msteams.client.MsTeamsClient.send_card")
    def test_send_notification_api_error(self, mock_send_card: MagicMock) -> None:
        from sentry.integrations.msteams.card_builder.block import AdaptiveCard

        error_payload = json.dumps(
            {
                "error": {
                    "code": "ConversationBlockedByUser",
                    "message": "User blocked the conversation with the bot.",
                },
            }
        )

        mock_send_card.side_effect = ApiError(
            text=error_payload,
            code=400,
        )
        payload: AdaptiveCard = {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2",
            "body": [],
        }

        with pytest.raises(IntegrationConfigurationError) as e:
            self.installation.send_notification(target=self.target, payload=payload)

        assert str(e.value) == error_payload
