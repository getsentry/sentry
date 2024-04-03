import re

import responses
from responses import matchers

from sentry.integrations.slack.client import SlackClient
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode


class SlackClientTest(TestCase):
    def setUp(self):
        self.user_access_token = "xoxp-user-access-token"
        self.access_token = "xoxb-access-token"
        self.integration, self.organization_integration = self.create_provider_integration_for(
            organization=self.organization,
            user=self.user,
            external_id="slack:1",
            provider="slack",
            metadata={"access_token": self.access_token},
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
    @assume_test_silo_mode(SiloMode.CONTROL)
    def test_authorize_with_integration_id(self):
        client = SlackClient(integration_id=self.integration.id)
        response = client.post("/chat.postMessage", data=self.payload)
        assert response == self.mock_access_token_response

    @responses.activate
    @assume_test_silo_mode(SiloMode.CONTROL)
    def test_authorize_user_access_token(self):
        self.integration.update(metadata={"user_access_token": self.user_access_token})
        client = SlackClient(integration_id=self.integration.id)
        response = client.post("/chat.postMessage", data=self.payload)
        assert response == self.mock_user_access_token_response

    @responses.activate
    def test_no_authorization_in_region_mode(self):
        client = SlackClient(integration_id=self.integration.id)
        response = client.post("/chat.postMessage", data=self.payload)
        assert response == self.mock_access_token_response

        with assume_test_silo_mode(SiloMode.CONTROL):
            self.integration.update(metadata={"user_access_token": self.user_access_token})
        client = SlackClient(integration_id=self.integration.id)
        response = client.post("/chat.postMessage", data=self.payload)
        assert response == self.mock_user_access_token_response
