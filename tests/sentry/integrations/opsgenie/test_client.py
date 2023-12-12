import pytest
import responses

from sentry.models.integrations.integration import Integration
from sentry.models.rule import Rule
from sentry.testutils.cases import APITestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils import json

pytestmark = [requires_snuba]

EXTERNAL_ID = "test-app"
METADATA = {
    "api_key": "1234-ABCD",
    "base_url": "https://api.opsgenie.com/",
    "domain_name": "test-app.app.opsgenie.com",
}


class OpsgenieClientTest(APITestCase):
    def create_integration(self):
        integration = Integration.objects.create(
            provider="opsgenie", name="test-app", external_id=EXTERNAL_ID, metadata=METADATA
        )
        org_integration = integration.add_organization(self.organization, self.user)
        org_integration.config = {
            "team_table": [
                {"id": "team-123", "integration_key": "1234-ABCD", "team": "default team"},
            ],
        }
        org_integration.save()

        return integration

    def setUp(self) -> None:
        self.login_as(self.user)
        self.integration = self.create_integration()
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
    def test_authorize_integration(self):
        client = self.installation.get_keyring_client("team-123")

        resp_data = {
            "result": "Integration [sentry] is valid",
            "took": 1,
            "requestId": "hello-world",
        }
        responses.add(
            responses.POST, url=f"{client.base_url}/integrations/authenticate", json=resp_data
        )

        resp = client.authorize_integration(type="sentry")
        assert resp == resp_data

    @responses.activate
    def test_send_notification(self):
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
        payload = json.loads(request.body)
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
