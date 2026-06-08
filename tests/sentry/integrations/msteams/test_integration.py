from typing import Any
from unittest.mock import MagicMock, patch
from urllib.parse import urlencode

import pytest
import responses
from django.urls import reverse

from sentry.integrations.models.integration import Integration
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.msteams.constants import SALT
from sentry.integrations.msteams.integration import MsTeamsIntegration, MsTeamsIntegrationProvider
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.notifications.platform.target import IntegrationNotificationTarget
from sentry.notifications.platform.types import (
    NotificationProviderKey,
    NotificationTargetResourceType,
)
from sentry.shared_integrations.exceptions import ApiError, IntegrationConfigurationError
from sentry.testutils.cases import APITestCase, TestCase
from sentry.testutils.silo import control_silo_test
from sentry.utils import json
from sentry.utils.signing import sign

team_id = "19:8d46058cda57449380517cc374727f2a@thread.tacv2"
user_id = (
    "29:1XJKJMvc5GBtc2JwZq0oj8tHZmzrQgFmB39ATiQWA85gQtHieVkKilBZ9XHoq9j7Zaqt7CZ-NJWi7me2kHTL3Bw"
)
tenant_id = "50cccd00-7c9c-4b32-8cda-58a084f9334a"


@control_silo_test
class MsTeamsApiPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"
    method = "post"
    provider = MsTeamsIntegrationProvider

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.start_time = 1594768808
        self.install_params = {
            "external_id": team_id,
            "external_name": "my_team",
            "service_url": "https://smba.trafficmanager.net/amer/",
            "user_id": user_id,
            "conversation_id": team_id,
            "tenant_id": tenant_id,
        }

    def tearDown(self) -> None:
        responses.reset()
        super().tearDown()

    def _get_pipeline_url(self) -> str:
        return reverse(
            self.endpoint,
            args=[self.organization.slug, IntegrationPipeline.pipeline_name],
        )

    def _initialize_pipeline(self, initial_data: dict[str, Any] | None = None) -> Any:
        payload: dict[str, Any] = {"action": "initialize", "provider": self.provider.key}
        if initial_data is not None:
            payload["initialData"] = initial_data
        return self.client.post(self._get_pipeline_url(), data=payload, format="json")

    def _advance_step(self, data: dict[str, Any]) -> Any:
        return self.client.post(self._get_pipeline_url(), data=data, format="json")

    def _signed_params(self, installation_type: str) -> str:
        return sign(salt=SALT, **{**self.install_params, "installation_type": installation_type})

    @responses.activate
    def test_initialize_returns_auto_advance_data(self) -> None:
        resp = self._initialize_pipeline(initial_data={"signedParams": self._signed_params("team")})
        assert resp.status_code == 200
        assert resp.data["step"] == "msteams_install"
        data = resp.data["data"]
        assert data["appDirectoryInstall"] is True
        assert "state" in data

    @responses.activate
    def test_initialize_expired_signature(self) -> None:
        with patch("sentry.integrations.msteams.integration.INSTALL_EXPIRATION_TIME", -1):
            resp = self._initialize_pipeline(
                initial_data={"signedParams": self._signed_params("team")}
            )
        assert resp.status_code == 400

    @responses.activate
    def test_initialize_tampered_signature(self) -> None:
        # Signed with a different salt, so unsigning with SALT raises
        # BadSignature rather than SignatureExpired.
        tampered = sign(salt="not-the-msteams-salt", **self.install_params)
        resp = self._initialize_pipeline(initial_data={"signedParams": tampered})
        assert resp.status_code == 400

    def _complete_install(self, installation_type: str) -> str:
        """Run the full API pipeline and return the post-install card body."""
        responses.add(
            responses.POST,
            "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token",
            json={"expires_in": 86399, "access_token": "my_token"},
        )
        responses.add(
            responses.POST,
            "https://smba.trafficmanager.net/amer/v3/conversations/%s/activities" % team_id,
            json={},
        )

        with patch("time.time") as mock_time:
            mock_time.return_value = self.start_time

            resp = self._initialize_pipeline(
                initial_data={"signedParams": self._signed_params(installation_type)}
            )
            pipeline_signature = resp.data["data"]["state"]

            resp = self._advance_step({"state": pipeline_signature})

        assert resp.status_code == 200
        assert resp.data["status"] == "complete"

        token_body = responses.calls[0].request.body
        assert token_body == urlencode(
            {
                "client_id": "msteams-client-id",
                "client_secret": "msteams-client-secret",
                "grant_type": "client_credentials",
                "scope": "https://api.botframework.com/.default",
            }
        )

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
        assert OrganizationIntegration.objects.filter(
            integration=integration, organization_id=self.organization.id
        ).exists()

        return responses.calls[1].request.body.decode("utf-8")

    @responses.activate
    def test_team_installation(self) -> None:
        post_install_body = self._complete_install(installation_type="team")
        assert f"organizations/{self.organization.slug}/alerts/rules/" in post_install_body
        assert self.organization.name in post_install_body

    @responses.activate
    def test_personal_installation(self) -> None:
        post_install_body = self._complete_install(installation_type="tenant")
        assert "Personal installation successful" in post_install_body
        assert "/settings/account/notifications" in post_install_body


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
