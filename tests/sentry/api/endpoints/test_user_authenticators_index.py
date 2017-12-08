from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import Authenticator
from sentry.testutils import APITestCase


class AuthenticatorIndex(APITestCase):
    def test_simple(self):
        user = self.create_user(email='a@example.com', is_superuser=True)
        Authenticator.objects.create(
            type=3,  # u2f
            user=user,
        )

        self.login_as(user=user, superuser=True)

        url = reverse(
            'sentry-api-0-authenticator-index',
        )
        resp = self.client.get(url, format='json')

        assert resp.status_code == 200, (resp.status_code, resp.content)
        assert len(resp.content) == 1
