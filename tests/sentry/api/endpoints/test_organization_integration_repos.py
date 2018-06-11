from __future__ import absolute_import

from mock import patch
from sentry.models import Integration
from sentry.testutils import APITestCase


class OrganizationIntegrationReposTest(APITestCase):
    def setUp(self):
        super(OrganizationIntegrationReposTest, self).setUp()

        self.login_as(user=self.user)
        self.org = self.create_organization(owner=self.user, name='baz')
        self.integration = Integration.objects.create(
            provider='github',
            name='Example',
        )
        self.integration.add_organization(self.org.id)
        self.path = '/api/0/organizations/{}/integrations/{}/repos/'.format(
            self.org.slug, self.integration.id)

    @patch('sentry.integrations.github.GitHubAppsClient.get_repositories', return_value=[])
    def test_simple(self, get_repositories):
        get_repositories.return_value = [{'id': '1'}, {'id': '2'}]
        response = self.client.get(self.path, format='json')

        assert response.status_code == 200, response.content
        assert response.data == {"repos": [{"id": "1"}, {"id": "2"}]}

    def test_no_repository_method(self):
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(self.org.id)
        path = '/api/0/organizations/{}/integrations/{}/repos/'.format(
            self.org.slug, integration.id)
        response = self.client.get(path, format='json')

        assert response.status_code == 200, response.content
        assert response.data == {}
