from unittest import mock

from sentry.models.activity import Activity
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.testutils.cases import PluginTestCase
from sentry.types.activity import ActivityType


class BasicPreprocessorPlugin(NotificationPlugin):
    def notify_about_activity(self, activity):
        pass

    def is_enabled(self, project=None):
        return True


class ActivityNotificationsTest(PluginTestCase):
    plugin = BasicPreprocessorPlugin

    @mock.patch("sentry.tasks.activity.send_activity_notifications")
    def test_simple(self, mock_func):
        group = self.create_group()
        Activity.objects.create_group_activity(
            group, ActivityType.ASSIGNED, user=self.user, data={"assignee": None}
        )
        assert mock_func.delay.call_count == 1
