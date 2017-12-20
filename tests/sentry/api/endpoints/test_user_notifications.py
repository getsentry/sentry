from __future__ import absolute_import

from sentry.testutils import APITestCase

from django.core.urlresolvers import reverse


class UserListTest(APITestCase):
    def test_lookup_self(self):
        user = self.create_user(email='a@example.com')

        self.login_as(user=user)

        url = reverse(
            'sentry-api-0-user-notifications', kwargs={
                'user_id': 'me',
            }
        )
        resp = self.client.get(url, format='json')

        assert resp.status_code == 200

    def test_lookup_other_user(self):
        user_a = self.create_user(email='a@example.com')
        user_b = self.create_user(email='b@example.com')

        self.login_as(user=user_b)

        url = reverse(
            'sentry-api-0-user-notifications', kwargs={
                'user_id': user_a.id
            }
        )

        resp = self.client.get(url, format='json')

        assert resp.status_code == 403

    def test_superuser(self):
        user = self.create_user(email='a@example.com')
        superuser = self.create_user(email='b@example.com', is_superuser=True)

        self.login_as(user=superuser, superuser=True)

        url = reverse(
            'sentry-api-0-user-notifications', kwargs={
                'user_id': user.id,
            }
        )
        resp = self.client.get(url, format='json')

        assert resp.status_code == 200
