from datetime import datetime, timedelta

import pytz

from sentry.models import GroupInbox, GroupInboxReason, add_group_to_inbox
from sentry.tasks.auto_ongoing_issues import schedule_auto_transition
from sentry.testutils import TestCase
from sentry.testutils.helpers import Feature


class ScheduleAutoOngoingIssuesTest(TestCase):
    def test_simple(self):
        now = datetime.now(tz=pytz.UTC)

        project = self.create_project()

        group = self.create_group(
            project=project,
        )
        group_inbox = add_group_to_inbox(group, GroupInboxReason.NEW)
        group_inbox.date_added = now - timedelta(days=3, hours=1)
        group_inbox.save()

        with self.tasks(), Feature(
            {"organizations:issue-states-auto-transition-new-ongoing": True}
        ):
            schedule_auto_transition()

        ongoing_inbox = GroupInbox.objects.filter(group=group).get()
        assert ongoing_inbox.reason == GroupInboxReason.ONGOING.value
        assert ongoing_inbox.date_added >= now
