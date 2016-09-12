from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Authenticator
from sentry.testutils import APITestCase


class DeleteUserAuthenticatorTest(APITestCase):
    def test_simple(self):
        user = self.create_user(email='a@example.com', is_superuser=True)
        auth = Authenticator.objects.create(
            type=3,  # u2f
            user=user,
        )

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-authenticator-details', kwargs={
            'user_id': user.id,
            'auth_id': auth.id,
        })
        resp = self.client.delete(url, format='json')
        assert resp.status_code == 204, (resp.status_code, resp.content)

        assert not Authenticator.objects.filter(
            id=auth.id,
        ).exists()

    def test_cannot_delete_without_superuser(self):
        user = self.create_user(email='a@example.com', is_superuser=False)
        auth = Authenticator.objects.create(
            type=3,  # u2f
            user=user,
        )

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-authenticator-details', kwargs={
            'user_id': user.id,
            'auth_id': auth.id,
        })
        resp = self.client.delete(url, format='json')
        assert resp.status_code == 403, (resp.status_code, resp.content)

        assert Authenticator.objects.filter(
            id=auth.id,
        ).exists()
