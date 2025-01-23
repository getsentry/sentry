from unittest import mock

from requests.exceptions import HTTPError, SSLError

from sentry.exceptions import PluginError
from sentry.plugins.base.structs import Notification
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.shared_integrations.exceptions import ApiError, ApiHostError, ApiUnauthorized
from sentry.testutils.cases import TestCase
from sentry.testutils.skips import requires_snuba
from sentry_plugins.base import CorePluginMixin

pytestmark = [requires_snuba]


class DummyNotificationPlugin(CorePluginMixin, NotificationPlugin):
    def is_configured(self, project) -> bool:
        return True


class NotifyPluginTest(TestCase):
    def test_notify_failure(self):
        errors = (
            ApiError("The server is sad"),
            SSLError("[SSL: UNKNOWN_PROTOCOL] unknown protocol (_ssl.c:590)"),
            HTTPError("A bad response"),
            PluginError("A plugin is sad"),
        )
        for err in errors:
            n = DummyNotificationPlugin()
            n.slug = "slack"

            event = self.store_event(data={}, project_id=self.project.id)
            notification = Notification(event)

            with mock.patch.object(DummyNotificationPlugin, "notify_users", side_effect=err):
                n.notify(notification)  # does not raise!

    def test_test_configuration_and_get_test_results(self):
        errors = (
            ApiError("The server is sad"),
            ApiHostError("host error"),
            ApiUnauthorized("not used"),
        )
        for err in errors:
            n = DummyNotificationPlugin()
            n.slug = "slack"

            def hook(*a, **kw):
                n.raise_error(err)

            if isinstance(err, ApiUnauthorized):
                message = "your access token was invalid"
            else:
                message = err.text
            assert message

            with mock.patch.object(DummyNotificationPlugin, "notify_users", hook):
                assert message in n.test_configuration_and_get_test_results(self.project)


class DummyNotificationPluginTest(TestCase):
    def setUp(self):
        self.event = self.store_event(data={}, project_id=self.project.id)
        self.group = self.event.group
        self.plugin = DummyNotificationPlugin()

    def test_should_notify(self):
        assert self.plugin.should_notify(self.group, self.event)
