from unittest.mock import patch

import orjson
import pytest
import responses

from sentry.integrations.types import EventLifecycleOutcome
from sentry.models.rule import Rule
from sentry.testutils.asserts import assert_slo_metric
from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]

EXTERNAL_ID = "test-app"
METADATA = {
    "api_key": "1234-ABCD",
    "base_url": "https://api.opsgenie.com/",
    "domain_name": "test-app.app.opsgenie.com",
}


class OpsgenieClientTest(APITestCase):
    def setUp(self) -> None:
        self.login_as(self.user)
        self.integration = self.create_integration(
            organization=self.organization,
            external_id=EXTERNAL_ID,
            provider="opsgenie",
            name="test-app",
            metadata=METADATA,
            oi_params={
                "config": {
                    "team_table": [
                        {"id": "team-123", "integration_key": "1234-ABCD", "team": "default team"},
                    ]
                },
            },
        )
        self.installation = self.integration.get_installation(self.organization.id)

    def test_get_client(self):
        with pytest.raises(NotImplementedError):
            self.installation.get_client()

    def test_get_keyring_client(self):
        client = self.installation.get_keyring_client("team-123")
        assert client.integration == self.installation.model
        assert client.base_url == METADATA["base_url"] + "v2"
        assert client.integration_key == METADATA["api_key"]

    @responses.activate
    @patch("sentry.integrations.utils.metrics.EventLifecycle.record_event")
    def test_send_notification(self, mock_record):
        resp_data = {
            "result": "Request will be processed",
            "took": 1,
            "requestId": "hello-world",
        }
        responses.add(responses.POST, url="https://api.opsgenie.com/v2/alerts", json=resp_data)

        event = self.store_event(
            data={
                "message": "Hello world",
                "level": "warning",
                "platform": "python",
                "culprit": "foo.bar",
            },
            project_id=self.project.id,
        )
        group = event.group
        assert group is not None

        rule = Rule.objects.create(project=self.project, label="my rule")
        client = self.installation.get_keyring_client("team-123")
        with self.options({"system.url-prefix": "http://example.com"}):
            client.send_notification(event, "P2", [rule])

        request = responses.calls[0].request
        payload = orjson.loads(request.body)
        group_id = str(group.id)
        assert payload == {
            "tags": ["level:warning"],
            "entity": "foo.bar",
            "alias": "sentry: %s" % group_id,
            "priority": "P2",
            "details": {
                "Project Name": self.project.name,
                "Triggering Rules": "my rule",
                "Triggering Rule URLs": f"http://example.com/organizations/baz/alerts/rules/{self.project.slug}/{rule.id}/details/",
                "Sentry Group": "Hello world",
                "Sentry ID": group_id,
                "Logger": "",
                "Level": "warning",
                "Project ID": "bar",
                "Issue URL": f"http://example.com/organizations/baz/issues/{group_id}/?referrer=opsgenie",
                "Release": event.release,
            },
            "message": "Hello world",
            "source": "Sentry",
        }
        assert_slo_metric(mock_record, EventLifecycleOutcome.SUCCESS)
