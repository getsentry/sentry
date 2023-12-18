import copy
from unittest import mock
from unittest.mock import call

import pytest
import responses
from django.test import override_settings
from responses import matchers

from sentry.api.serializers import ExternalEventSerializer, serialize
from sentry.integrations.pagerduty.client import PagerDutyProxyClient
from sentry.integrations.pagerduty.utils import add_service
from sentry.models.integrations.integration import Integration
from sentry.silo.base import SiloMode
from sentry.silo.util import PROXY_BASE_PATH, PROXY_OI_HEADER, PROXY_SIGNATURE_HEADER
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]

# external_id is the account name in pagerduty
EXTERNAL_ID = "example-pagerduty"
SERVICES = [
    {
        "type": "service",
        "integration_key": "PND4F9",
        "service_id": "123",
        "service_name": "Critical",
    }
]


class PagerDutyProxyClientTest(APITestCase):
    provider = "pagerduty"

    @pytest.fixture(autouse=True)
    def _setup_metric_patch(self):
        with mock.patch("sentry.shared_integrations.track_response.metrics") as self.metrics:
            yield

    def setUp(self):
        self.login_as(self.user)
        self.integration = Integration.objects.create(
            provider=self.provider,
            name="Example PagerDuty",
            external_id=EXTERNAL_ID,
            metadata={"services": SERVICES},
        )
        self.integration.add_organization(self.organization, self.user)
        self.service = add_service(
            self.integration.organizationintegration_set.first(),
            service_name=SERVICES[0]["service_name"],
            integration_key=SERVICES[0]["integration_key"],
        )

        self.installation = self.integration.get_installation(self.organization.id)
        self.min_ago = iso_format(before_now(minutes=1))

    @responses.activate
    def test_send_trigger(self):
        integration_key = self.service["integration_key"]

        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            },
            project_id=self.project.id,
        )
        custom_details = serialize(event, None, ExternalEventSerializer())
        assert event.group is not None
        group = event.group
        expected_data = {
            "routing_key": integration_key,
            "event_action": "trigger",
            "dedup_key": group.qualified_short_id,
            "payload": {
                "summary": event.message,
                "severity": "error",
                "source": event.transaction or event.culprit,
                "component": self.project.slug,
                "custom_details": custom_details,
            },
            "links": [
                {
                    "href": group.get_absolute_url(params={"referrer": "pagerduty_integration"}),
                    "text": "View Sentry Issue Details",
                }
            ],
        }

        responses.add(
            responses.POST,
            "https://events.pagerduty.com/v2/enqueue/",
            body=b"{}",
            match=[
                matchers.header_matcher(
                    {
                        "Content-Type": "application/json",
                    }
                ),
                matchers.json_params_matcher(expected_data),
            ],
        )

        client = self.installation.get_keyring_client(self.service["id"])
        client.send_trigger(event)

        assert len(responses.calls) == 1
        request = responses.calls[0].request
        assert "https://events.pagerduty.com/v2/enqueue/" == request.url
        assert client.base_url and (client.base_url.lower() in request.url)

        # Check if metrics is generated properly
        calls = [
            call(
                "integrations.http_response",
                sample_rate=1.0,
                tags={"integration": "pagerduty", "status": 200},
            )
        ]
        assert self.metrics.incr.mock_calls == calls


def assert_proxy_request(request, is_proxy=True):
    assert (PROXY_BASE_PATH in request.url) == is_proxy
    assert (PROXY_OI_HEADER in request.headers) == is_proxy
    assert (PROXY_SIGNATURE_HEADER in request.headers) == is_proxy
    # PagerDuty API does not require the Authorization header.
    # The secret is instead passed in the body payload called routing_key/integration key
    assert "Authorization" not in request.headers
    if is_proxy:
        assert request.headers[PROXY_OI_HEADER] is not None


@override_settings(
    SENTRY_SUBNET_SECRET="hush-hush-im-invisible",
    SENTRY_CONTROL_ADDRESS="http://controlserver",
)
class PagerDutyProxyApiClientTest(APITestCase):
    def setUp(self):
        self.login_as(self.user)
        self.integration = Integration.objects.create(
            provider="pagerduty",
            name="Example PagerDuty",
            external_id=EXTERNAL_ID,
            metadata={"services": SERVICES},
        )
        self.integration.add_organization(self.organization, self.user)
        self.service = add_service(
            self.integration.organizationintegration_set.first(),
            service_name=SERVICES[0]["service_name"],
            integration_key=SERVICES[0]["integration_key"],
        )
        self.installation = self.integration.get_installation(self.organization.id)
        self.min_ago = iso_format(before_now(minutes=1))

    @responses.activate
    def test_integration_proxy_is_active(self):
        responses.add(
            responses.POST,
            "https://events.pagerduty.com/v2/enqueue/",
            body=b"{}",
            match=[
                matchers.header_matcher(
                    {
                        "Content-Type": "application/json",
                    }
                ),
            ],
        )

        responses.add(
            responses.POST,
            "http://controlserver/api/0/internal/integration-proxy/",
            body=b"{}",
            match=[
                matchers.header_matcher(
                    {
                        "Content-Type": "application/json",
                    }
                ),
            ],
        )

        class PagerDutyProxyApiTestClient(PagerDutyProxyClient):
            _use_proxy_url_for_tests = True

        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            },
            project_id=self.project.id,
        )

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.MONOLITH):
            client = PagerDutyProxyApiTestClient(
                org_integration_id=self.installation.org_integration.id,
                integration_key=self.service["integration_key"],
                keyid=str(self.service["id"]),
            )
            client.send_trigger(event)

            assert len(responses.calls) == 1
            request = responses.calls[0].request
            assert "https://events.pagerduty.com/v2/enqueue/" == request.url
            assert client.base_url and (client.base_url.lower() in request.url)
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.CONTROL):
            client = PagerDutyProxyApiTestClient(
                org_integration_id=self.installation.org_integration.id,
                integration_key=self.service["integration_key"],
                keyid=str(self.service["id"]),
            )
            client.send_trigger(event)

            assert len(responses.calls) == 1
            request = responses.calls[0].request
            assert "https://events.pagerduty.com/v2/enqueue/" == request.url
            assert client.base_url and (client.base_url.lower() in request.url)
            assert_proxy_request(request, is_proxy=False)

        responses.calls.reset()
        with override_settings(SILO_MODE=SiloMode.REGION):
            client = PagerDutyProxyApiTestClient(
                org_integration_id=self.installation.org_integration.id,
                integration_key=self.service["integration_key"],
                keyid=str(self.service["id"]),
            )
            client.send_trigger(event)

            assert len(responses.calls) == 1
            request = responses.calls[0].request
            assert "http://controlserver/api/0/internal/integration-proxy/" == request.url
            assert client.base_url and (client.base_url.lower() not in request.url)
            assert_proxy_request(request, is_proxy=True)
