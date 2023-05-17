from typing import Any
from unittest.mock import patch

from sentry.issues.ongoing import transition_new_to_ongoing, transition_regressed_to_ongoing
from sentry.models import (
    Activity,
    GroupHistory,
    GroupHistoryStatus,
    GroupInbox,
    GroupInboxReason,
    GroupStatus,
    add_group_to_inbox,
)
from sentry.testutils import TestCase
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


class TransitionNewToOngoingTest(TestCase):  # type: ignore
    @patch("sentry.signals.inbox_in.send_robust")
    def test_new_to_ongoing(self, inbox_in: Any) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.NEW)
        add_group_to_inbox(group, GroupInboxReason.NEW)

        assert GroupInbox.objects.filter(group=group, reason=GroupInboxReason.NEW.value).exists()
        assert not inbox_in.called

        transition_new_to_ongoing(group)
        assert GroupInbox.objects.filter(
            group=group, reason=GroupInboxReason.ONGOING.value
        ).exists()
        assert inbox_in.called
        assert Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).exists()
        assert GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.UNRESOLVED
        ).exists()

    @patch("sentry.signals.inbox_in.send_robust")
    def test_regressed_to_ongoing(self, inbox_in: Any) -> None:
        group = self.create_group(status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.REGRESSED)
        add_group_to_inbox(group, GroupInboxReason.REGRESSION)

        assert GroupInbox.objects.filter(
            group=group, reason=GroupInboxReason.REGRESSION.value
        ).exists()
        assert inbox_in.called

        transition_regressed_to_ongoing(group)
        assert GroupInbox.objects.filter(
            group=group, reason=GroupInboxReason.ONGOING.value
        ).exists()
        assert inbox_in.called
        assert Activity.objects.filter(
            group=group, type=ActivityType.AUTO_SET_ONGOING.value
        ).exists()
        assert GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.UNRESOLVED
        ).exists()
        assert inbox_in.call_count == 2
