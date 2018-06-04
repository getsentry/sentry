from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.plugins import bindings, providers
from sentry.testutils import APITestCase


class OrganizationConfigRepositoriesTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')

        url = reverse('sentry-api-0-organization-config-repositories', args=[org.slug])
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data['providers']) == 1
        provider = response.data['providers'][0]
        assert provider['id'] == 'dummy'
        assert provider['name'] == 'Example'
        assert provider['config']


class DummyPluginRepoProvider(providers.RepositoryProvider):
    def get_config(self):
        return {}


class DummyIntegrationRepoProvider(providers.IntegrationRepositoryProvider):
    def get_config(self, organization):
        return {}


class OrganizationConfigRepositoriesIntegrationTest(APITestCase):
    def setUp(self):
        super(OrganizationConfigRepositoriesIntegrationTest, self).setUp()
        plugin_repo = 'repository.provider'
        integration_repo = 'integration-repository.provider'

        # integration bindiings
        bindings.add(
            integration_repo,
            DummyIntegrationRepoProvider,
            id='integrations:bitbucket')
        bindings.add(
            integration_repo,
            DummyIntegrationRepoProvider,
            id='integrations:github')
        # plugin bindings
        bindings.add(
            plugin_repo,
            DummyPluginRepoProvider,
            id='bitbucket')
        bindings.add(
            plugin_repo,
            DummyPluginRepoProvider,
            id='github')

        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='baz')

        self.url = reverse('sentry-api-0-organization-config-repositories', args=[org.slug])

    def tearDown(self):
        super(OrganizationConfigRepositoriesIntegrationTest, self).tearDown()
        # TODO(LB): Do I need to remove the bindings? I notice there's no remove/delete function
        pass

    def assert_provider_ids(self, response, provider_ids):
        assert response.status_code == 200, response.content
        assert sorted([provider['id']
                       for provider in response.data['providers']]) == sorted(provider_ids)

    def test_no_flags(self):
        response = self.client.get(self.url, format='json')
        self.assert_provider_ids(response, ['bitbucket', 'dummy', 'github'])

    def test_integrations_flags(self):
        with self.feature('organizations:github-apps'):
            response = self.client.get(self.url, format='json')
            self.assert_provider_ids(response, ['bitbucket', 'dummy', 'integrations:github'])

        with self.feature('organizations:bitbucket-integration'):
            response = self.client.get(self.url, format='json')
            self.assert_provider_ids(response, ['dummy', 'integrations:bitbucket', 'github'])

    def test_multiple_flags(self):
        with self.feature({'organizations:github-apps': True, 'organizations:bitbucket-integration': True}):
            response = self.client.get(self.url, format='json')
            self.assert_provider_ids(
                response, [
                    'integrations:bitbucket', 'dummy', 'integrations:github'])
