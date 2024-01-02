import re

import responses
from django.test import override_settings
from responses import matchers

from sentry.integrations.slack.client import SlackClient
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_PATH, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import TestCase
from tests.sentry.integrations.test_helpers import add_control_silo_proxy_response

control_address = "http://controlserver"
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

        def _add_response(*, json, match):
            responses.add(
                method=responses.POST,
                url=re.compile(r"\S+chat.postMessage$"),
                status=200,
                content_type="application/json",
                json=json,
                match=match,
            )

            add_control_silo_proxy_response(
                method=responses.POST,
                path="chat.postMessage",
                status=200,
                json=json,
                additional_matchers=match,
            )

        _add_response(
            json=self.mock_user_access_token_response,
            match=[
                matchers.header_matcher(
                    {"Authorization": f"Bearer {self.user_access_token}"},
                )
            ],
        )
        _add_response(
            json=self.mock_access_token_response,
            match=[matchers.header_matcher({"Authorization": f"Bearer {self.access_token}"})],
        )
        _add_response(
            json=self.mock_not_authed_response,
            match=[matchers.header_matcher({})],
        )

    def assert_proxy_request(self, request, is_proxy=True):
        assert (PROXY_BASE_PATH in request.url) == is_proxy
        assert (PROXY_OI_HEADER in request.headers) == is_proxy
        assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
        if is_proxy:
            assert request.headers[PROXY_OI_HEADER] is not None

    @responses.activate
    def test_integration_proxy_is_active(self):
        class SlackProxyTestClient(SlackClient):
            _use_proxy_url_for_tests = True

        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = SlackProxyTestClient(integration_id=self.integration.id)
            client.post("/chat.postMessage", data=self.payload)
            request = responses.calls[0].request

            assert "/chat.postMessage" in request.url
            assert client.base_url in request.url
            self.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = SlackProxyTestClient(integration_id=self.integration.id)
            client.post("/chat.postMessage", data=self.payload)
            request = responses.calls[0].request

            assert "/chat.postMessage" in request.url
            assert client.base_url in request.url
            self.assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = SlackProxyTestClient(integration_id=self.integration.id)
            client.post("/chat.postMessage", data=self.payload)
            request = responses.calls[0].request

            assert request.headers[PROXY_PATH] == "chat.postMessage"
            assert client.base_url not in request.url
            self.assert_proxy_request(request, is_proxy=True)

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
