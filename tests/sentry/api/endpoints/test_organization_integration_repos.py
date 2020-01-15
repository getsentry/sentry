from __future__ import absolute_import

from sentry.utils.compat.mock import patch
from sentry.models import Integration
from sentry.testutils import APITestCase


class OrganizationIntegrationReposTest(APITestCase):
    def setUp(self):
        super(OrganizationIntegrationReposTest, self).setUp()

        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name="baz")
        self.integration = Integration.objects.create(provider="github", name="Example")
        self.integration.add_organization(self.org, self.user)
        self.path = u"/api/0/organizations/{}/integrations/{}/repos/".format(
            self.org.slug, self.integration.id
        )

    @patch("sentry.integrations.github.GitHubAppsClient.get_repositories", return_value=[])
    def test_simple(self, get_repositories):
        get_repositories.return_value = [
            {"name": "rad-repo", "full_name": "Example/rad-repo"},
            {"name": "cool-repo", "full_name": "Example/cool-repo"},
        ]
        response = self.client.get(self.path, format="json")

        assert response.status_code == 200, response.content
        assert response.data == {
            "repos": [
                {"name": "rad-repo", "identifier": "Example/rad-repo"},
                {"name": "cool-repo", "identifier": "Example/cool-repo"},
            ],
            "searchable": True,
        }

    def test_no_repository_method(self):
        integration = Integration.objects.create(provider="example", name="Example")
        integration.add_organization(self.org, self.user)
        path = u"/api/0/organizations/{}/integrations/{}/repos/".format(
            self.org.slug, integration.id
        )
        response = self.client.get(path, format="json")

        assert response.status_code == 400
