import copy
from unittest import mock
from unittest.mock import call

import pytest
import responses
from responses import matchers

from sentry.api.serializers import ExternalEventSerializer, serialize
from sentry.integrations.pagerduty.utils import add_service
from sentry.testutils.cases import APITestCase
from sentry.testutils.factories import DEFAULT_EVENT_DATA
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import control_silo_test
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


@control_silo_test
class PagerDutyClientTest(APITestCase):
    provider = "pagerduty"

    @pytest.fixture(autouse=True)
    def _setup_metric_patch(self):
        with mock.patch("sentry.shared_integrations.track_response.metrics") as self.metrics:
            yield

    def setUp(self):
        self.login_as(self.user)
        self.integration, _ = self.create_provider_integration_for(
            self.organization,
            self.user,
            provider=self.provider,
            name="Example PagerDuty",
            external_id=EXTERNAL_ID,
            metadata={"services": SERVICES},
        )
        self.service = add_service(
            self.integration.organizationintegration_set.first(),
            service_name=SERVICES[0]["service_name"],
            integration_key=SERVICES[0]["integration_key"],
        )

        self.installation = self.integration.get_installation(self.organization.id)
        self.min_ago = iso_format(before_now(minutes=1))

        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            },
            project_id=self.project.id,
        )

        self.integration_key = self.service["integration_key"]
        self.custom_details = serialize(self.event, None, ExternalEventSerializer())
        assert self.event.group is not None
        self.group = self.event.group

    @responses.activate
    def test_send_trigger(self):
        expected_data = {
            "routing_key": self.integration_key,
            "event_action": "trigger",
            "dedup_key": self.group.qualified_short_id,
            "payload": {
                "summary": self.event.message,
                "severity": "error",
                "source": self.event.transaction or self.event.culprit,
                "component": self.project.slug,
                "custom_details": self.custom_details,
            },
            "links": [
                {
                    "href": self.group.get_absolute_url(
                        params={"referrer": "pagerduty_integration"}
                    ),
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
        client.send_trigger(self.event, severity="default")

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

    @responses.activate
    def test_send_trigger_custom_severity(self):
        expected_data = {
            "routing_key": self.integration_key,
            "event_action": "trigger",
            "dedup_key": self.group.qualified_short_id,
            "payload": {
                "summary": self.event.message,
                "severity": "info",
                "source": self.event.transaction or self.event.culprit,
                "component": self.project.slug,
                "custom_details": self.custom_details,
            },
            "links": [
                {
                    "href": self.group.get_absolute_url(
                        params={"referrer": "pagerduty_integration"}
                    ),
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
        client.send_trigger(self.event, severity="info")

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
