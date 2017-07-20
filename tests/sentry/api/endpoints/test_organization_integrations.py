from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse

from social_auth.models import UserSocialAuth
from sentry.models import Integration, OrganizationIntegration
from sentry.testutils import APITestCase


class OrganizationIntegrationsListTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        auth = UserSocialAuth.objects.create(
            provider='dummy',
            user=self.user,
            uid='123456',
        )

        url = reverse('sentry-api-0-organization-integrations', args=[org.slug])
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0] == {
            'id': 'dummy',
            'name': 'Example',
            'auths': [{
                'externalId': auth.uid,
                'defaultAuthId': auth.id,
                'user': {'email': self.user.email},
                'linked': False,
                'integrationId': None,
            }],
        }


class OrganizationIntegrationsCreateTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        org = self.create_organization(owner=self.user, name='baz')
        auth = UserSocialAuth.objects.create(
            provider='dummy',
            user=self.user,
            uid='123456',
        )

        url = reverse('sentry-api-0-organization-integrations', args=[org.slug])
        response = self.client.post(url, data={
            'providerId': 'dummy',
            'defaultAuthId': auth.id,
        })

        assert response.status_code == 201, response.content

        assert Integration.objects.filter(default_auth_id=auth.id).exists()

        assert response.data == {
            'id': u'dummy',
            'name': 'Example',
            'auths': [{
                'externalId': auth.uid,
                'defaultAuthId': auth.id,
                'user': {'email': self.user.email},
                'linked': True,
                'integrationId': six.text_type(
                    Integration.objects.get(default_auth_id=auth.id).id
                ),
            }],
        }
        assert OrganizationIntegration.objects.filter(
            integration__default_auth_id=auth.id,
            organization_id=org.id,
        ).exists()

    def test_adding_bad_social_auth(self):
        self.login_as(user=self.user)
        user2 = self.create_user()
        auth = UserSocialAuth.objects.create(
            provider='dummy',
            user=user2,
            uid='123456',
        )
        org = self.create_organization(owner=self.user, name='baz')

        url = reverse('sentry-api-0-organization-integrations', args=[org.slug])
        response = self.client.post(url, data={
            'provider': 'dummy',
            'defaultAuthId': auth.id,
        })

        assert response.status_code == 400
