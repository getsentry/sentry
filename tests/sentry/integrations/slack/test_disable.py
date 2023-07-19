import responses
from django.test import override_settings

import pytest
from sentry.integrations.request_buffer import IntegrationRequestBuffer
from sentry.integrations.slack.client import SlackClient
from sentry.models import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils import TestCase
from sentry.utils import json
from sentry.shared_integrations.exceptions import ApiError

control_address = "http://controlserver"
secret = "hush-hush-im-invisible"


@override_settings(
    SENTRY_SUBNET_SECRET=secret,
    SENTRY_CONTROL_ADDRESS=control_address,
)
class SlackClientDisable(TestCase):
    def setUp(self):
        self.resp = responses.mock
        self.resp.__enter__()

        self.integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX1",
            metadata={
                "access_token": "xoxb-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx",
                "installation_type": "born_as_bot",
            },
        )
        self.integration.add_organization(self.event.project.organization, self.user)
        self.payload = {"channel": "#announcements", "message": "i'm ooo next week"}

    def tearDown(self):
        self.resp.__exit__(None, None, None)

    @responses.activate
    def test_disabled_integration(self):
        bodydict = {"ok": False, "error": "account_inactive"}
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=200,
            content_type="application/json",
            body=json.dumps(bodydict),
        )
        client = SlackClient(integration_id=self.integration.id)
        with pytest.raises(ApiError):
            client.post("/chat.postMessage", data=self.payload)
        buffer = IntegrationRequestBuffer(client._get_redis_key())
        print(buffer._get_all_from_buffer(client._get_redis_key()))
        print(buffer.is_integration_broken())
        assert buffer.is_integration_broken() is True
