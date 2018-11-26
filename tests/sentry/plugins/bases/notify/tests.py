from __future__ import absolute_import

from sentry.plugins import NotificationPlugin
from sentry.plugins.base.structs import Notification
from sentry.testutils import TestCase
from requests import HTTPError


class NotifyPlugin(TestCase):
    def test_add_notification_referrer_param(self):
        n = NotificationPlugin()
        n.slug = 'slack'
        url = 'https://sentry.io/'
        assert n.add_notification_referrer_param(url) == url + '?referrer=' + n.slug

        url = 'https://sentry.io/?referrer=notslack'
        assert n.add_notification_referrer_param(url) == 'https://sentry.io/?referrer=slack'

        url = 'https://sentry.io/?utm_source=google'
        assert n.add_notification_referrer_param(
            url
        ) == 'https://sentry.io/?referrer=slack&utm_source=google'

        n.slug = ''
        url = 'https://sentry.io/'
        assert n.add_notification_referrer_param(url) == 'https://sentry.io/'

    def test_notify_failure(self):
        n = NotificationPlugin()
        n.slug = 'slack'

        def hook(*a, **kw):
            raise HTTPError('401 Unauthorized')
        event = self.create_event()
        notification = Notification(event)

        n.notify_users = hook
        assert n.notify(notification) is False
