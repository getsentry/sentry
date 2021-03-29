import pytest

from django.conf import settings

from sentry import newsletter
from sentry.models import UserEmail
from sentry.testutils import APITestCase


@pytest.mark.skipif(
    settings.SENTRY_NEWSLETTER != "sentry.newsletter.dummy.DummyNewsletter",
    reason="Requires DummyNewsletter.",
)
class UserSubscriptionsNewsletterTest(APITestCase):
    endpoint = "sentry-api-0-user-subscriptions"
    method = "put"

    def setUp(self):
        self.user = self.create_user(email="foo@example.com")
        self.login_as(self.user)

        def disable_newsletter():
            newsletter.backend.disable()

        self.addCleanup(disable_newsletter)
        newsletter.backend.enable()

    def test_get_subscriptions(self):
        self.get_valid_response(self.user.id, method="get")

    def test_subscribe(self):
        self.get_valid_response(self.user.id, listId="123", subscribed=True, status_code=204)
        results = newsletter.get_subscriptions(self.user)["subscriptions"]
        assert len(results) == 1
        assert results[0].list_id == 123
        assert results[0].subscribed
        assert results[0].verified

    def test_requires_subscribed(self):
        self.get_valid_response(self.user.id, listId="123", status_code=400)

    def test_unverified_emails(self):
        UserEmail.objects.get(email=self.user.email).update(is_verified=False)
        self.get_valid_response(self.user.id, listId="123", subscribed=True, status_code=204)

    def test_unsubscribe(self):
        self.get_valid_response(self.user.id, listId="123", subscribed=False, status_code=204)
        results = newsletter.get_subscriptions(self.user)["subscriptions"]
        assert len(results) == 1
        assert results[0].list_id == 123
        assert not results[0].subscribed
        assert results[0].verified

    def test_default_subscription(self):
        self.get_valid_response(self.user.id, method="post", subscribed=True, status_code=204)
        results = newsletter.get_subscriptions(self.user)["subscriptions"]
        assert len(results) == 1
        assert results[0].list_id == newsletter.get_default_list_id()
        assert results[0].subscribed
        assert results[0].verified
