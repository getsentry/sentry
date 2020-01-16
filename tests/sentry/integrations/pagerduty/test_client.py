from __future__ import absolute_import

import copy

from sentry.utils.compat.mock import patch

from sentry.api.serializers import serialize, ExternalEventSerializer
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.models import Integration, PagerDutyService
from sentry.testutils.factories import DEFAULT_EVENT_DATA

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


class PagerDutyClientTest(APITestCase):
    provider = "pagerduty"

    def setUp(self):
        self.login_as(self.user)
        self.integration = Integration.objects.create(
            provider=self.provider,
            name="Example PagerDuty",
            external_id=EXTERNAL_ID,
            metadata={"services": SERVICES},
        )
        self.integration.add_organization(self.organization, self.user)
        self.service = PagerDutyService.objects.create(
            service_name=SERVICES[0]["service_name"],
            integration_key=SERVICES[0]["integration_key"],
            organization_integration=self.integration.organizationintegration_set.first(),
        )
        self.installation = self.integration.get_installation(self.organization.id)
        self.min_ago = iso_format(before_now(minutes=1))

    @patch("sentry.integrations.pagerduty.client.PagerDutyClient.request")
    def test_send_trigger(self, mock_request):
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "message",
                "timestamp": self.min_ago,
                "stacktrace": copy.deepcopy(DEFAULT_EVENT_DATA["stacktrace"]),
            },
            project_id=self.project.id,
        )
        group = event.group

        integration_key = self.service.integration_key
        client = self.installation.get_client(integration_key=integration_key)
        custom_details = serialize(event, None, ExternalEventSerializer())

        client.send_trigger(event)
        data = {
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
                    "text": "Issue Details",
                }
            ],
        }
        mock_request.assert_called_once_with("POST", "/", data=data)
