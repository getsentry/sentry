from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import AuthIdentity, AuthProvider
from sentry.testutils import APITestCase


class DeleteUserIdentityTest(APITestCase):
    def test_simple(self):
        user = self.create_user(email='a@example.com')
        org = self.create_organization(owner=user)
        auth_provider = AuthProvider.objects.create(
            organization=org,
            provider='dummy',
        )
        auth_identity = AuthIdentity.objects.create(
            auth_provider=auth_provider,
            ident=user.email,
            user=user,
        )

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-identity-details', kwargs={
            'user_id': user.id,
            'identity_id': auth_identity.id,
        })
        resp = self.client.delete(url, format='json')
        assert resp.status_code == 204, resp.content

        assert not AuthIdentity.objects.filter(
            id=auth_identity.id,
        ).exists()
