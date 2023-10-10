from unittest.mock import MagicMock, patch

from sentry.issues.escalating_group_forecast import ONE_EVENT_FORECAST, EscalatingGroupForecast
from sentry.issues.ignored import handle_archived_until_escalating, handle_ignored
from sentry.models.group import Group, GroupStatus
from sentry.models.groupinbox import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.models.groupsnooze import GroupSnooze
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba
from sentry.types.group import GroupSubStatus
from tests.sentry.issues.test_utils import get_mock_groups_past_counts_response

pytestmark = [requires_snuba]


class HandleIgnoredTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.group = self.create_group()
        self.group_list = [self.group]
        self.group_ids = [self.group]
        add_group_to_inbox(self.group, GroupInboxReason.NEW)

    def test_ignored_forever(self) -> None:
        status_details = handle_ignored(self.group_ids, self.group_list, {}, self.user, self.user)
        assert status_details == {}
        assert not GroupInbox.objects.filter(group=self.group).exists()
        assert not GroupSnooze.objects.filter(group=self.group).exists()

    def test_ignored_duration(self) -> None:
        status_details = handle_ignored(
            self.group_ids, self.group_list, {"ignoreDuration": 30}, self.user, self.user
        )
        assert status_details is not None
        assert not GroupInbox.objects.filter(group=self.group).exists()
        snooze = GroupSnooze.objects.filter(group=self.group).first()
        assert snooze.until == status_details.get("ignoreUntil")

    def test_ignored_count(self) -> None:
        status_details = handle_ignored(
            self.group_ids, self.group_list, {"ignoreCount": 50}, self.user, self.user
        )
        assert status_details is not None
        assert not GroupInbox.objects.filter(group=self.group).exists()
        snooze = GroupSnooze.objects.filter(group=self.group).first()
        assert snooze.count == status_details.get("ignoreCount")

    def test_ignored_user_count(self) -> None:
        status_details = handle_ignored(
            self.group_ids, self.group_list, {"ignoreUserCount": 100}, self.user, self.user
        )
        assert status_details is not None
        assert not GroupInbox.objects.filter(group=self.group).exists()
        snooze = GroupSnooze.objects.filter(group=self.group).first()
        assert snooze.user_count == status_details.get("ignoreUserCount")
        assert Group.objects.get(id=self.group.id).status == GroupStatus.IGNORED
        assert Group.objects.get(id=self.group.id).substatus == GroupSubStatus.UNTIL_CONDITION_MET


@apply_feature_flag_on_cls("organizations:escalating-issues")
class HandleArchiveUntilEscalating(TestCase):
    @patch("sentry.issues.forecasts.query_groups_past_counts", return_value={})
    @patch("sentry.issues.forecasts.generate_and_save_missing_forecasts.delay")
    def test_archive_until_escalating_no_counts(
        self,
        mock_generate_and_save_missing_forecasts: MagicMock,
        mock_query_groups_past_counts: MagicMock,
    ) -> None:
        self.group = self.create_group()
        add_group_to_inbox(self.group, GroupInboxReason.NEW)
        assert GroupInbox.objects.filter(
            group=self.group, reason=GroupInboxReason.NEW.value
        ).exists()

        status_details = handle_archived_until_escalating(
            [self.group], self.user, [self.project], sender=self
        )
        assert not GroupInbox.objects.filter(group=self.group).exists()
        # Make sure we don't create a snooze for until_escalating
        assert not GroupSnooze.objects.filter(group=self.group).exists()
        assert status_details == {"ignoreUntilEscalating": True}

        fetched_forecast = EscalatingGroupForecast.fetch(self.group.project.id, self.group.id)
        assert fetched_forecast and fetched_forecast.forecast == ONE_EVENT_FORECAST
        assert mock_generate_and_save_missing_forecasts.call_count == 1

    @patch("sentry.issues.forecasts.query_groups_past_counts")
    def test_archive_until_escalating_with_counts(
        self, mock_query_groups_past_counts: MagicMock
    ) -> None:
        self.group = self.create_group()

        mock_query_groups_past_counts.return_value = get_mock_groups_past_counts_response(
            num_days=7, num_hours=1, groups=[self.group]
        )

        add_group_to_inbox(self.group, GroupInboxReason.NEW)
        assert GroupInbox.objects.filter(
            group=self.group, reason=GroupInboxReason.NEW.value
        ).exists()

        status_details = handle_archived_until_escalating(
            [self.group], self.user, [self.project], sender=self
        )
        assert not GroupInbox.objects.filter(group=self.group).exists()
        # Make sure we don't create a snooze for until_escalating
        assert not GroupSnooze.objects.filter(group=self.group).exists()
        assert status_details == {"ignoreUntilEscalating": True}

        fetched_forecast = EscalatingGroupForecast.fetch(self.group.project.id, self.group.id)
        assert fetched_forecast is not None
        assert fetched_forecast.project_id == self.group.project.id
        assert fetched_forecast.group_id == self.group.id
        assert fetched_forecast.forecast == [100] * 14

    @patch("sentry.issues.forecasts.query_groups_past_counts", return_value={})
    @patch("sentry.signals.issue_archived.send_robust")
    def test_archive_until_escalating_analytics(
        self, mock_query_groups_past_counts: MagicMock, mock_send_robust: MagicMock
    ) -> None:
        self.group = self.create_group()
        add_group_to_inbox(self.group, GroupInboxReason.NEW)
        assert GroupInbox.objects.filter(
            group=self.group, reason=GroupInboxReason.NEW.value
        ).exists()

        status_details = handle_archived_until_escalating(
            [self.group], self.user, [self.project], sender=self
        )
        assert mock_send_robust.called
        assert status_details == {"ignoreUntilEscalating": True}
