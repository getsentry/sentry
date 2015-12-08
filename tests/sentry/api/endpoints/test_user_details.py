from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import User
from sentry.testutils import APITestCase


class UserDetailsTest(APITestCase):
    def test_simple(self):
        user = self.create_user(email='a@example.com')

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-details', kwargs={
            'user_id': 'me',
        })
        response = self.client.get(url, format='json')

        assert response.status_code == 200, response.content
        assert response.data['id'] == str(user.id)


class UserUpdateTest(APITestCase):
    def test_simple(self):
        user = self.create_user(email='a@example.com')

        self.login_as(user=user)

        url = reverse('sentry-api-0-user-details', kwargs={
            'user_id': 'me',
        })

        resp = self.client.put(url, data={
            'name': 'hello world',
            'email': 'b@example.com',
        })
        assert resp.status_code == 200, resp.content
        assert resp.data['id'] == str(user.id)

        user = User.objects.get(id=user.id)
        assert user.name == 'hello world'
        assert user.email == 'b@example.com'
