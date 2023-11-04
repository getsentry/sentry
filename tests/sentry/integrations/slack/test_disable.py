import time
from datetime import datetime, timedelta

import pytest
import responses
from django.core import mail
from django.test import override_settings

from sentry import audit_log
from sentry.constants import ObjectStatus
from sentry.integrations.notify_disable import notify_disable
from sentry.integrations.request_buffer import IntegrationRequestBuffer
from sentry.integrations.slack.client import SlackClient
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.integrations.integration import Integration
from sentry.shared_integrations.exceptions import ApiError
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]

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

        self.organization = self.create_organization(owner=self.user)

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
    def test_fatal_and_disable_integration(self):
        """
        fatal fast shut off integration should be broken and disabled
        """

        bodydict = {"ok": False, "error": "account_inactive"}
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=200,
            content_type="application/json",
            body=json.dumps(bodydict),
        )
        client = SlackClient(integration_id=self.integration.id)

        with self.tasks() and pytest.raises(ApiError):
            client.post("/chat.postMessage", data=self.payload)
        buffer = IntegrationRequestBuffer(client._get_redis_key())
        integration = Integration.objects.get(id=self.integration.id)
        assert integration.status == ObjectStatus.DISABLED
        assert [len(item) == 0 for item in buffer._get_broken_range_from_buffer()]
        assert len(buffer._get_all_from_buffer()) == 0
        assert AuditLogEntry.objects.filter(
            event=audit_log.get_event_id("INTEGRATION_DISABLED"),
            organization_id=self.organization.id,
        ).exists()

    @responses.activate
    def test_email(self):
        client = SlackClient(integration_id=self.integration.id)
        with self.tasks():
            notify_disable(self.organization, self.integration.provider, client._get_redis_key())
        assert len(mail.outbox) == 1
        msg = mail.outbox[0]
        assert msg.subject == "Action required: re-authenticate or fix your Slack integration"
        assert (
            self.organization.absolute_url(
                f"/settings/{self.organization.slug}/integrations/{self.integration.provider}"
            )
            in msg.body
        )
        assert (
            self.organization.absolute_url(
                f"/settings/{self.organization.slug}/integrations/{self.integration.provider}/?referrer=disabled-integration"
            )
            in msg.body
        )

    @responses.activate
    def test_error_integration(self):
        """
        recieve two errors and errors are recorded, integration is not broken yet so no disable
        """
        bodydict = {"ok": False, "error": "The requested resource does not exist"}
        self.resp.add(
            method=responses.POST,
            url="https://slack.com/api/chat.postMessage",
            status=404,
            content_type="application/json",
            body=json.dumps(bodydict),
        )
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
        with pytest.raises(ApiError):
            client.post("/chat.postMessage", data=self.payload)
        buffer = IntegrationRequestBuffer(client._get_redis_key())
        assert int(buffer._get_all_from_buffer()[0]["error_count"]) == 2
        assert buffer.is_integration_broken() is False

    @responses.activate
    def test_slow_integration_is_not_broken_or_disabled(self):
        """
        slow test
        put errors and success in buffer for 10 days, assert integration is not broken or disabled
        """
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
                buffer.record_success()
        with pytest.raises(ApiError):
            client.post("/chat.postMessage", data=self.payload)
        assert buffer.is_integration_broken() is False
        assert Integration.objects.get(id=self.integration.id).status == ObjectStatus.ACTIVE

    @responses.activate
    def test_a_slow_integration_is_broken(self):
        """
        slow shut off
        put errors in buffer for 10 days, assert integration is broken and not disabled
        since only fatal shut off should disable
        """
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
        assert Integration.objects.get(id=self.integration.id).status == ObjectStatus.ACTIVE

    @responses.activate
    def test_expiry(self):
        """
        call add in buffer for 32 days, assert buffer len is 30, keys are expired
        """
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
        for i in reversed(range(30)):
            with freeze_time(now - timedelta(days=i)):
                buffer.record_error()

        buffer_expired = IntegrationRequestBuffer(client._get_redis_key(), 1)
        with freeze_time(now - timedelta(days=30)):
            buffer_expired.record_error()
        with freeze_time(now - timedelta(days=31)):
            buffer_expired.record_error()
        with pytest.raises(ApiError):
            client.post("/chat.postMessage", data=self.payload)
        time.sleep(1)
        resp = buffer._get_range_buffers(
            [
                f"{client._get_redis_key()}:{(now - timedelta(days=i)).strftime('%Y-%m-%d')}"
                for i in range(32)
            ]
        )
        assert len(resp) == 32
        assert len([item for item in resp if item]) == 30
