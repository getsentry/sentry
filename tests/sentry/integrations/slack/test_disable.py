from datetime import datetime, timedelta

import pytest
import responses
from django.test import override_settings
from freezegun import freeze_time

from sentry.constants import ObjectStatus
from sentry.integrations.request_buffer import IntegrationRequestBuffer
from sentry.integrations.slack.client import SlackClient
from sentry.models import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils import APITestCase, TestCase
from sentry.testutils.helpers import install_slack, with_feature
from sentry.testutils.silo import region_silo_test
from sentry.utils import json

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
    @with_feature("organizations:disable-on-broken")
    def test_fatal_and_disable_integration(self):
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
        assert buffer.is_integration_broken() is True
        assert (
            integration_service.get_integration(integration_id=self.integration.id).status
            == ObjectStatus.DISABLED
        )

    # test with flag off
    @responses.activate
    def test_fatal_integration(self):
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
        assert buffer.is_integration_broken() is True
        assert (
            integration_service.get_integration(integration_id=self.integration.id).status
            == ObjectStatus.ACTIVE
        )

    @responses.activate
    def test_error_integration(self):
        bodydict = {"ok": False, "error": "The requested resource does not exist"}
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=404,
            content_type="application/json",
            body=json.dumps(bodydict),
        )
        client = SlackClient(integration_id=self.integration.id)
        with pytest.raises(ApiError):
            client.post("/chat.postMessage", data=self.payload)
        buffer = IntegrationRequestBuffer(client._get_redis_key())
        assert (buffer._get()[0]["error_count"]) >= 1
        assert buffer.is_integration_broken() is False

    # fake slow test w disable off
    @responses.activate
    def test_integration_is_broken(self):
        bodydict = {"ok": False, "error": "The requested resource does not exist"}
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=404,
            content_type="application/json",
            body=json.dumps(bodydict),
        )
        client = SlackClient(integration_id=self.integration.id)
        buffer = IntegrationRequestBuffer(client._get_redis_key())
        now = datetime.now() - timedelta(hours=1)
        for i in reversed(range(10)):
            with freeze_time(now - timedelta(days=i)):
                buffer.record_error()

        with pytest.raises(ApiError):
            client.post("/chat.postMessage", data=self.payload)
        assert buffer.is_integration_broken() is True
        assert (
            integration_service.get_integration(integration_id=self.integration.id).status
            == ObjectStatus.ACTIVE
        )

    # fake slow test w disable on
    @responses.activate
    @with_feature("organizations:disable-on-broken")
    def test_integration_is_broken_and_disabled(self):
        bodydict = {"ok": False, "error": "The requested resource does not exist"}
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=404,
            content_type="application/json",
            body=json.dumps(bodydict),
        )
        client = SlackClient(integration_id=self.integration.id)
        buffer = IntegrationRequestBuffer(client._get_redis_key())
        now = datetime.now() - timedelta(hours=1)
        for i in reversed(range(10)):
            with freeze_time(now - timedelta(days=i)):
                buffer.record_error()
        with pytest.raises(ApiError):
            client.post("/chat.postMessage", data=self.payload)
        assert buffer.is_integration_broken() is True
        assert (
            integration_service.get_integration(integration_id=self.integration.id).status
            == ObjectStatus.DISABLED
        )
