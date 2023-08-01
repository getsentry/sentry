import responses

from sentry.models import Integration, OrganizationIntegration, Rule
from sentry.testutils.cases import APITestCase
from sentry.utils import json

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
        integration.add_organization(self.organization, self.user)
        return integration

    def setUp(self) -> None:
        self.login_as(self.user)
        self.integration = self.create_integration()
        self.installation = self.integration.get_installation(self.organization.id)

    def test_get_client(self):
        client = self.installation.get_client(integration_key="1234-ABCD")
        assert client.integration == self.installation.model
        assert client.base_url == METADATA["base_url"] + "v2"
        assert client.integration_key == METADATA["api_key"]

    @responses.activate
    def test_get_team_id(self):
        client = self.installation.get_client(integration_key="1234-5678")

        org_integration = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration_id=self.integration.id
        )
        org_integration.config = {
            "team_table": [{"id": "", "team": "cool-team", "integration_key": "1234-5678"}]
        }
        org_integration.save()
        resp_data = {"data": {"id": "123-id", "name": "cool-team"}}
        responses.add(responses.GET, url=f"{client.base_url}/teams/cool-team", json=resp_data)

        resp = client.get_team_id(team_name="cool-team")
        assert resp == resp_data

    @responses.activate
    def test_send_notification(self):
        resp_data = {
            "result": "Request will be processed",
            "took": 0.302,
            "requestId": "43a29c5c-3dbf-4fa4-9c26-f4f71023e120",
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
        client = self.installation.get_client(integration_key="1234-5678")
        with self.options({"system.url-prefix": "http://example.com"}):
            client.send_notification(event, [rule])

        request = responses.calls[0].request
        payload = json.loads(request.body)
        group_id = str(group.id)
        assert payload == {
            "tags": ["level:warning"],
            "entity": "foo.bar",
            "alias": "sentry: %s" % group_id,
            "details": {
                "Project Name": self.project.name,
                "Triggering Rules": "my rule",
                "Triggering Rule URLs": f"http://example.com/organizations/baz/alerts/rules/{self.project.name}/{rule.id}/details/",
                "Sentry Group": "Hello world",
                "Sentry ID": group_id,
                "Logger": "",
                "Level": "warning",
                "Project ID": "bar",
                "Issue URL": "http://example.com/organizations/baz/issues/%s/" % group_id,
                "Release": event.release,
            },
            "message": "Hello world",
            "source": "Sentry",
        }
