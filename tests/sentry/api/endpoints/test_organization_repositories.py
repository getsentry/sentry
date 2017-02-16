from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from sentry.models import Repository
from sentry.testutils import APITestCase


class OrganizationRepositoriesListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        repo = Repository.objects.create(
            name='example',
            organization_id=org.id,
        )

        url = reverse('sentry-api-0-organization-repositories', args=[org.slug])
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]['id'] == six.text_type(repo.id)


class OrganizationRepositoriesCreateTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')

        url = reverse('sentry-api-0-organization-repositories', args=[org.slug])
        response = self.client.post(url, data={
            'provider': 'dummy',
            'name': 'getsentry/sentry',
        })

        assert response.status_code == 201, (response.status_code, response.content)
        assert response.data['id']

        repo = Repository.objects.get(id=response.data['id'])
        assert repo.provider == 'dummy'
        assert repo.name == 'getsentry/sentry'
