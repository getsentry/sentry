from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class AccountSubscriptionsTest(APITestCase):
    def test_get_subscriptions(self):
        user = self.create_user(email='foo@example.com')
        self.login_as(user)

        url = reverse('sentry-api-0-account-settings-subscriptions', kwargs={})
        response = self.client.get(url)
        assert response.status_code == 200, response.content

    def test_update_subscriptions(self):
        user = self.create_user(email='foo@example.com')
        self.login_as(user)

        url = reverse('sentry-api-0-account-settings-subscriptions', kwargs={})
        response = self.client.put(url, data={
            'list_id': '123',
            'subscribed': True,
        })
        assert response.status_code == 204, response.content

    # TODO
    # Test subscription does not update if email is not verified
