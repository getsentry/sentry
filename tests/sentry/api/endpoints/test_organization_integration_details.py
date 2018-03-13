from __future__ import absolute_import

import six

from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import APITestCase


class OrganizationIntegrationDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='baz')
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)
        path = '/api/0/organizations/{}/integrations/{}/'.format(org.slug, integration.id)

        with self.feature('organizations:integrations-v3'):
            response = self.client.get(path, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == six.text_type(integration.id)


class OrganizationIntegrationDeleteTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)
        org = self.create_organization(owner=self.user, name='baz')
        integration = Integration.objects.create(
            provider='example',
            name='Example',
        )
        integration.add_organization(org.id)
        path = '/api/0/organizations/{}/integrations/{}/'.format(org.slug, integration.id)

        with self.feature('organizations:integrations-v3'):
            response = self.client.delete(path, format='json')

        assert response.status_code == 204, response.content
        assert Integration.objects.filter(id=integration.id).exists()
        assert not OrganizationIntegration.objects.filter(
            id=integration.id,
            organization=org,
        ).exists()
