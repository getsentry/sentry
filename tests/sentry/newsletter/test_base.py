from __future__ import absolute_import

from sentry.newsletter.base import Newsletter
from sentry.testutils import TestCase

newsletter = Newsletter()


class BaseNewsletterTest(TestCase):
    def test_defaults(self):
        assert newsletter.DEFAULT_LISTS == newsletter.get_default_list_ids()
        assert newsletter.DEFAULT_LIST_ID == newsletter.get_default_list_id()

    def test_update_subscription(self):
        user = self.create_user("subscriber@example.com")
        newsletter.update_subscription(user)

        assert newsletter.get_subscriptions(user) is None
        assert newsletter.create_or_update_subscription(user) is None
        assert newsletter.create_or_update_subscriptions(user) is None

    def test_update_subscriptions(self):
        user = self.create_user("subscriber@example.com")
        newsletter.update_subscriptions(user)

        assert newsletter.get_subscriptions(user) is None
        assert newsletter.create_or_update_subscription(user) is None
        assert newsletter.create_or_update_subscriptions(user) is None
