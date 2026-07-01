from unittest import mock

from sentry.models.activity import Activity
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType


class ActivityNotificationsTest(TestCase):
    @mock.patch("sentry.tasks.activity.send_activity_notifications")
    def test_simple(self, mock_func: mock.MagicMock) -> None:
        group = self.create_group()
        Activity.objects.create_group_activity(
            group, ActivityType.ASSIGNED, user=self.user, data={"assignee": None}
        )
        assert mock_func.delay.call_count == 1
