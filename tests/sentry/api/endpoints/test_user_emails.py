from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import UserEmail, User
from sentry.testutils import APITestCase


class UserEmailsTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email='a@example.com')
        self.login_as(user=self.user)

    def test_simple(self):
        url = reverse('sentry-api-0-user-emails', kwargs={'user_id': self.user.id})
        response = self.client.post(
            url,
            data={
                'email': 'b@example.com',
                'primary': True},
            format='json')

        assert response.status_code == 201, response.content
        assert UserEmail.objects.filter(email='b@example.com').exists()
        assert User.objects.filter(email='b@example.com').exists()

    def test_with_primary_false(self):
        url = reverse('sentry-api-0-user-emails', kwargs={'user_id': self.user.id})
        response = self.client.post(
            url,
            data={
                'email': 'b@example.com',
                'primary': False},
            format='json')

        assert response.status_code == 201, response.content
        assert UserEmail.objects.filter(email='b@example.com').exists()
        assert User.objects.filter(email='b@example.com').exists() is False

    def test_bad_request(self):
        url = reverse('sentry-api-0-user-emails', kwargs={'user_id': self.user.id})
        response = self.client.post(url, data={}, format='json')
        assert response.status_code == 400, response.content

    def test_unauthenticated_request(self):
        url = reverse('sentry-api-0-user-emails', kwargs={'user_id': self.user.id})
        response = self.client.post(url, data={}, format='json')
        assert response.status_code == 400, response.content
