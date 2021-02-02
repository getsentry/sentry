from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature


class OrganizationIntegrationsListTest(APITestCase):
    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.integration = Integration.objects.create(provider="example", name="Example")
        self.integration.add_organization(self.org, self.user)

    def test_simple(self):
        path = f"/api/0/organizations/{self.org.slug}/integrations/"

        response = self.client.get(path, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.integration.id)
        assert "configOrganization" in response.data[0]

    def test_no_config(self):
        path = f"/api/0/organizations/{self.org.slug}/integrations/?includeConfig=0"

        response = self.client.get(path, format="json")
        assert response.status_code == 200, response.content
        assert "configOrganization" not in response.data[0]

    def test_no_workspace_apps(self):
        integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX2",
            metadata={"access_token": "xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(self.org, self.user)
        path = f"/api/0/organizations/{self.org.slug}/integrations/"

        response = self.client.get(path, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(self.integration.id)
        assert "configOrganization" in response.data[0]

    @with_feature("organizations:slack-allow-workspace")
    def test_show_workspace_apps(self):
        integration = Integration.objects.create(
            provider="slack",
            name="Awesome Team",
            external_id="TXXXXXXX2",
            metadata={"access_token": "xoxa-xxxxxxxxx-xxxxxxxxxx-xxxxxxxxxxxx"},
        )
        integration.add_organization(self.org, self.user)
        path = f"/api/0/organizations/{self.org.slug}/integrations/"

        response = self.client.get(path, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
