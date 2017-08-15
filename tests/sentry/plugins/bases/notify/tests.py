from __future__ import absolute_import

from sentry.plugins import NotificationPlugin
from sentry.testutils import TestCase


class NotifyPlugin(TestCase):
    def test_add_notification_referrer_param(self):
        n = NotificationPlugin()
        n.slug = 'slack'
        url = 'https://sentry.io/'
        assert n.add_notification_referrer_param(url) == url + '?referrer=' + n.slug
