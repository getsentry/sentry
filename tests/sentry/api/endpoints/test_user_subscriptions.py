from __future__ import absolute_import

import pytest

from django.conf import settings
from django.core.urlresolvers import reverse

from sentry import newsletter
from sentry.models import UserEmail
from sentry.testutils import APITestCase


@pytest.mark.skipIf(
    lambda x: settings.SENTRY_NEWSLETTER != "sentry.newsletter.dummy.DummyNewsletter"
)
class UserSubscriptionsNewsletterTest(APITestCase):
    def setUp(self):
        self.user = self.create_user(email="foo@example.com")
        self.login_as(self.user)
        self.url = reverse("sentry-api-0-user-subscriptions", kwargs={"user_id": self.user.id})

        def disable_newsletter():
            newsletter.backend.disable()

        self.addCleanup(disable_newsletter)
        newsletter.backend.enable()

    def test_get_subscriptions(self):
        response = self.client.get(self.url)
        assert response.status_code == 200, response.content

    def test_subscribe(self):
        response = self.client.put(self.url, data={"listId": "123", "subscribed": True})
        assert response.status_code == 204, response.content
        results = newsletter.get_subscriptions(self.user)["subscriptions"]
        assert len(results) == 1
        assert results[0].list_id == 123
        assert results[0].subscribed
        assert results[0].verified

    def test_requires_subscribed(self):
        response = self.client.put(self.url, data={"listId": "123"})
        assert response.status_code == 400, response.content

    def test_unverified_emails(self):
        UserEmail.objects.get(email=self.user.email).update(is_verified=False)
        response = self.client.put(self.url, data={"listId": "123", "subscribed": True})
        assert response.status_code == 204, response.content

    def test_unsubscribe(self):
        response = self.client.put(self.url, data={"listId": "123", "subscribed": False})
        assert response.status_code == 204, response.content
        results = newsletter.get_subscriptions(self.user)["subscriptions"]
        assert len(results) == 1
        assert results[0].list_id == 123
        assert not results[0].subscribed
        assert results[0].verified

    def test_default_subscription(self):
        response = self.client.post(self.url, data={"subscribed": True})
        assert response.status_code == 204, response.content
        results = newsletter.get_subscriptions(self.user)["subscriptions"]
        assert len(results) == 1
        assert results[0].list_id == newsletter.get_default_list_id()
        assert results[0].subscribed
        assert results[0].verified
