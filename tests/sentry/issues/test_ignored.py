from typing import Any
from unittest.mock import patch

from sentry.issues.ignored import handle_archived_until_escalating
from sentry.models import (
    GroupForecast,
    GroupInbox,
    GroupInboxReason,
    GroupSnooze,
    add_group_to_inbox,
)
from sentry.testutils import TestCase


class TestHandleArchiveUntilEscalating(TestCase):  # type: ignore
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        add_group_to_inbox(self.group, GroupInboxReason.NEW)

    @patch("sentry.tasks.weekly_escalating_forecast.get_forecast_per_group")
    def test_archive_until_escalating(self, mock_get_forecast_per_group: Any) -> None:
        mock_get_forecast_per_group.return_value = [(self.group, [1, 2, 3])]

        handle_archived_until_escalating([self.group], self.user)
        assert not GroupInbox.objects.filter(group=self.group).exists()
        assert not GroupSnooze.objects.filter(group=self.group).exists()

        forecast = GroupForecast.objects.filter(group=self.group)
        assert forecast.exists()
        assert forecast.first().forecast == [1, 2, 3]

    @patch("sentry.tasks.weekly_escalating_forecast.get_forecast_per_group")
    def test_archived_until_escalating_no_forecast(self, mock_get_forecast_per_group: Any) -> None:
        GroupForecast.objects.all().delete()
        mock_get_forecast_per_group.return_value = [(self.group, [])]

        handle_archived_until_escalating([self.group], self.user)
        assert not GroupInbox.objects.filter(group=self.group).exists()
        assert not GroupSnooze.objects.filter(group=self.group).exists()
        assert not GroupForecast.objects.filter(group=self.group).exists()
