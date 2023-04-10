from sentry.issues.ignored import handle_archived_until_escalating
from sentry.models import GroupInbox, GroupInboxReason, GroupSnooze, add_group_to_inbox
from sentry.testutils import TestCase
from sentry.testutils.helpers.features import apply_feature_flag_on_cls


@apply_feature_flag_on_cls("organizations:escalating-issues")
class HandleArchiveUntilEscalating(TestCase):  # type: ignore
    def test_archive_until_escalating(self):
        group = self.create_group()
        add_group_to_inbox(group, GroupInboxReason.NEW)

        handle_archived_until_escalating([group], self.user)
        assert not GroupInbox.objects.filter(group=group).exists()
        assert not GroupSnooze.objects.filter(group=group).exists()
