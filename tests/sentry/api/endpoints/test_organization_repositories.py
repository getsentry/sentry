from __future__ import absolute_import

import six

from mock import patch

from django.core.urlresolvers import reverse

from sentry.models import Integration, OrganizationIntegration, Repository
from sentry.plugins.providers.dummy.repository import DummyRepositoryProvider
from sentry.testutils import APITestCase


class OrganizationRepositoriesListTest(APITestCase):
    def setUp(self):
        super(OrganizationRepositoriesListTest, self).setUp()

        self.org = self.create_organization(owner=self.user, name='baz')
        self.url = reverse(
            'sentry-api-0-organization-repositories',
            args=[self.org.slug],
        )

        self.login_as(user=self.user)

    def test_simple(self):
        repo = Repository.objects.create(
            name='example',
            organization_id=self.org.id,
        )

        response = self.client.get(self.url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(repo.id)

    def test_status_unmigratable(self):
        self.url = self.url + '?status=unmigratable'

        integration = Integration.objects.create(
            provider='github',
        )

        OrganizationIntegration.objects.create(
            organization_id=self.org.id,
            integration_id=integration.id,
        )

        unmigratable_repo = Repository.objects.create(
            name='NotConnected/foo',
            organization_id=self.org.id,
        )

        with patch('sentry.integrations.github.GitHubIntegration.get_unmigratable_repositories') as f:
            f.return_value = [unmigratable_repo]

            response = self.client.get(self.url, format='json')

            assert response.status_code == 200, response.content
            assert response.data[0]['name'] == unmigratable_repo.name

    def test_status_unmigratable_missing_org_integration(self):
        self.url = self.url + '?status=unmigratable'

        Integration.objects.create(
            provider='github',
        )

        unmigratable_repo = Repository.objects.create(
            name='NotConnected/foo',
            organization_id=self.org.id,
        )

        with patch('sentry.integrations.github.GitHubIntegration.get_unmigratable_repositories') as f:
            f.return_value = [unmigratable_repo]

            response = self.client.get(self.url, format='json')

            # Doesn't return anything when the OrganizatioIntegration doesn't
            # exist (the Integration has been disabled)
            assert response.status_code == 200, response.content
            assert len(response.data) == 0


class OrganizationRepositoriesCreateTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')

        with patch.object(DummyRepositoryProvider, 'needs_auth', return_value=False):
            url = reverse('sentry-api-0-organization-repositories', args=[org.slug])
            response = self.client.post(
                url, data={
                    'provider': 'dummy',
                    'name': 'getsentry/sentry',
                }
            )

        assert response.status_code == 201, (response.status_code, response.content)
        assert response.data['id']

        repo = Repository.objects.get(id=response.data['id'])
        assert repo.provider == 'dummy'
        assert repo.name == 'getsentry/sentry'
