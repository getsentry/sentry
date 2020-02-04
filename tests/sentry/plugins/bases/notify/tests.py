from __future__ import absolute_import

from sentry.exceptions import PluginError
from sentry.integrations.exceptions import ApiError
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.plugins.base.structs import Notification
from sentry.testutils import TestCase
from requests.exceptions import HTTPError, SSLError
from sentry.models import GroupStatus


class DummyNotificationPlugin(NotificationPlugin):
    def is_configured(self, project):
        return True


class NotifyPlugin(TestCase):
    def test_add_notification_referrer_param(self):
        n = NotificationPlugin()
        n.slug = "slack"
        url = "https://sentry.io/"
        assert n.add_notification_referrer_param(url) == url + "?referrer=" + n.slug

        url = "https://sentry.io/?referrer=notslack"
        assert n.add_notification_referrer_param(url) == "https://sentry.io/?referrer=slack"

        url = "https://sentry.io/?utm_source=google"
        assert (
            n.add_notification_referrer_param(url)
            == "https://sentry.io/?referrer=slack&utm_source=google"
        )

        n.slug = ""
        url = "https://sentry.io/"
        assert n.add_notification_referrer_param(url) == "https://sentry.io/"

    def test_notify_failure(self):
        errors = (
            ApiError("The server is sad"),
            SSLError("[SSL: UNKNOWN_PROTOCOL] unknown protocol (_ssl.c:590)"),
            HTTPError("A bad response"),
            PluginError("A plugin is sad"),
        )
        for err in errors:
            n = NotificationPlugin()
            n.slug = "slack"

            def hook(*a, **kw):
                raise err

            event = self.store_event(data={}, project_id=self.project.id)
            notification = Notification(event)

            n.notify_users = hook
            assert n.notify(notification) is False


class DummyNotificationPluginTest(TestCase):
    def setUp(self):
        self.event = self.store_event(data={}, project_id=self.project.id)
        self.group = self.event.group
        self.plugin = DummyNotificationPlugin()

    def test_should_notify(self):
        assert self.plugin.should_notify(self.group, self.event)

    def test_dont_notify_ignored(self):
        self.group.status = GroupStatus.IGNORED
        self.group.save()
        assert not self.plugin.should_notify(self.group, self.event)

    def test_dont_notify_resolved(self):
        self.group.status = GroupStatus.RESOLVED
        self.group.save()
        assert not self.plugin.should_notify(self.group, self.event)
