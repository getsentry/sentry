from __future__ import absolute_import

from sentry.newsletter.dummy import DummyNewsletter
from sentry.testutils import TestCase


class DummyNewsletterTest(TestCase):
    def setUp(self):
        self.newsletter = DummyNewsletter()

    def test_defaults(self):
        assert self.newsletter.DEFAULT_LISTS == self.newsletter.get_default_list_ids()
        assert self.newsletter.DEFAULT_LIST_ID == self.newsletter.get_default_list_id()

    def assert_subscriptions(self, user, count):
        subscriptions = self.newsletter.get_subscriptions(user)
        assert subscriptions.get("subscriptions") is not None
        assert len(subscriptions["subscriptions"]) == count

    def test_update_subscription(self):
        user = self.create_user("subscriber@example.com")

        self.assert_subscriptions(user, 0)
        self.newsletter.create_or_update_subscription(user)
        self.assert_subscriptions(user, 1)

    def test_update_subscriptions(self):
        user = self.create_user("subscriber@example.com")

        self.assert_subscriptions(user, 0)
        self.newsletter.create_or_update_subscriptions(user)
        self.assert_subscriptions(user, 1)
