import responses
from django.test import override_settings
from responses import matchers

from sentry.integrations.slack.client import SlackClient
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.testutils import TestCase

control_address = "https://sentry.io"
secret = "hush-hush-im-invisible"


@override_settings(
    SENTRY_SUBNET_SECRET=secret,
    SENTRY_CONTROL_ADDRESS=control_address,
)
class SlackClientTest(TestCase):
    def setUp(self):
        self.user_access_token = "xoxp-user-access-token"
        self.access_token = "xoxb-access-token"
        self.integration = self.create_integration(
            organization=self.organization,
            external_id="slack:1",
            provider="slack",
            metadata={"access_token": self.access_token},
        )
        self.organization_integration = OrganizationIntegration.objects.get(
            integration_id=self.integration.id
        )
        self.payload = {"channel": "#announcements", "message": "i'm ooo next week"}
        self.mock_user_access_token_response = {"ok": True, "auth": "user"}
        self.mock_access_token_response = {"ok": True, "auth": "token"}
        self.mock_not_authed_response = {"ok": True, "auth": None}
        base_response_kwargs = {
            "method": responses.POST,
            "url": "https://slack.com/api/chat.postMessage",
            "status": 200,
            "content_type": "application/json",
        }
        responses.add(
            **base_response_kwargs,
            json=self.mock_user_access_token_response,
            match=[
                matchers.header_matcher(
                    {"Authorization": f"Bearer {self.user_access_token}"},
                )
            ],
        )
        responses.add(
            **base_response_kwargs,
            json=self.mock_access_token_response,
            match=[matchers.header_matcher({"Authorization": f"Bearer {self.access_token}"})],
        )
        responses.add(
            **base_response_kwargs,
            json=self.mock_not_authed_response,
            match=[matchers.header_matcher({})],
        )

    @responses.activate
    def test_authorize_with_no_id_noop(self):
        client = SlackClient()
        response = client.post("/chat.postMessage", data=self.payload)
        assert response == self.mock_not_authed_response

    @responses.activate
    def test_authorize_manually(self):
        client = SlackClient()
        response = client.post(
            "/chat.postMessage",
            data=self.payload,
            headers={"Authorization": f"Bearer {self.user_access_token}"},
        )
        assert response == self.mock_user_access_token_response

    @responses.activate
    def test_authorize_with_org_integration_id(self):
        client = SlackClient(org_integration_id=self.organization_integration.id)
        response = client.post("/chat.postMessage", data=self.payload)
        assert response == self.mock_access_token_response

    @responses.activate
    def test_authorize_with_integration_id(self):
        client = SlackClient(integration_id=self.integration.id)
        response = client.post("/chat.postMessage", data=self.payload)
        assert response == self.mock_access_token_response

    @responses.activate
    def test_authorize_user_access_token(self):
        self.integration.update(metadata={"user_access_token": self.user_access_token})
        client = SlackClient(org_integration_id=self.organization_integration.id)
        response = client.post("/chat.postMessage", data=self.payload)
        assert response == self.mock_user_access_token_response
