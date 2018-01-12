from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class UserSubscriptionsTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email='foo@example.com')
        self.login_as(self.user)
        self.url = reverse('sentry-api-0-user-subscriptions', kwargs={'user_id': self.user.id})

    def test_get_subscriptions(self):
        response = self.client.get(self.url)
        assert response.status_code == 200, response.content

    def test_update_subscriptions(self):
        response = self.client.put(self.url, data={
            'listId': '123',
            'subscribed': True,
        })
        assert response.status_code == 204, response.content
