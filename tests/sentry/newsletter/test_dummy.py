from __future__ import absolute_import

from sentry.newsletter.dummy import DummyNewsletter
from sentry.testutils import TestCase

newsletter = DummyNewsletter()


class DummyNewsletterTest(TestCase):

    def test_defaults(self):
        assert newsletter.DEFAULT_LISTS == newsletter.get_default_list_ids()
        assert newsletter.DEFAULT_LIST_ID == newsletter.get_default_list_id()

    def assert_subscriptions(self, user, count):
        subscriptions = newsletter.get_subscriptions(user)
        assert subscriptions.get('subscriptions') is not None
        assert len(subscriptions['subscriptions']) == count

    def test_update_subscription(self):
        user = self.create_user('subscriber@example.com')

        self.assert_subscriptions(user, 0)
        newsletter.create_or_update_subscription(user)
        self.assert_subscriptions(user, 1)

    def test_update_subscriptions(self):
        user = self.create_user('subscriber@example.com')

        self.assert_subscriptions(user, 0)
        newsletter.create_or_update_subscriptions(user)
        self.assert_subscriptions(user, 1)
