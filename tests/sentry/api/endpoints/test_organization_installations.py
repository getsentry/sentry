from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Installation, OrganizationInstallation, Repository
from sentry.testutils import APITestCase


class OrganizationInstallationsListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        Installation.objects.create(
            provider='dummy',
            installation_id='54321',
            external_id='987612345',
            external_organization='dummyorg',
        )

        url = reverse('sentry-api-0-organization-installations', args=[org.slug])
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0] == {
            'id': 'dummy',
            'name': 'Example',
            'installUrl': None,
            'installations': [{
                'installationId': '54321',
                'linked': False,
                'externalOrganization': 'dummyorg',
            }]
        }


class OrganizationInstallationsCreateTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        inst = Installation.objects.create(
            provider='dummy',
            installation_id='54321',
            external_id='987612345',
            external_organization='dummyorg',
        )

        url = reverse('sentry-api-0-organization-installations', args=[org.slug])
        response = self.client.post(url, data={
            'provider': 'dummy',
            'installationId': '54321',
        })

        assert response.status_code == 201, response.content
        assert response.data == {
            'id': 'dummy',
            'name': 'Example',
            'installUrl': None,
            'installations': [{
                'installationId': '54321',
                'linked': True,
                'externalOrganization': 'dummyorg',
            }]
        }
        assert OrganizationInstallation.objects.filter(
            installation_id=inst.id,
            organization_id=org.id,
        ).exists()
        assert Repository.objects.filter(
            organization_id=org.id,
            name='dummyorg/dummyrepo',
        ).exists()

    def test_no_access(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        inst = Installation.objects.create(
            provider='dummy',
            installation_id='123',
            external_id='987612345',
            external_organization='dummyorg',
        )
        url = reverse('sentry-api-0-organization-installations', args=[org.slug])
        response = self.client.post(url, data={
            'provider': 'dummy',
            'installationId': inst.id,
        })

        assert response.status_code == 400
