import six

from sentry.models import Integration
from sentry.testutils import APITestCase
from sentry.testutils.helpers import with_feature


class OrganizationIntegrationsListTest(APITestCase):
    def setUp(self):
        super(OrganizationIntegrationsListTest, self).setUp()
        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.integration = Integration.objects.create(provider="example", name="Example")
        self.integration.add_organization(self.org, self.user)

    def test_simple(self):
        path = "/api/0/organizations/{}/integrations/".format(self.org.slug)

        response = self.client.get(path, format="json")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(self.integration.id)
        assert "configOrganization" in response.data[0]

    def test_no_config(self):
        path = "/api/0/organizations/{}/integrations/?includeConfig=0".format(self.org.slug)

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
        path = "/api/0/organizations/{}/integrations/".format(self.org.slug)

        response = self.client.get(path, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(self.integration.id)
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
        path = "/api/0/organizations/{}/integrations/".format(self.org.slug)

        response = self.client.get(path, format="json")
        assert response.status_code == 200, response.content
        assert len(response.data) == 2
