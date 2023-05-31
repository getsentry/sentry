from datetime import datetime, timedelta

import pytz

from sentry.models import Activity, GroupHistory, GroupHistoryStatus, GroupInbox, GroupStatus
from sentry.tasks.auto_archive_issues import run_auto_archive
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


class ScheduleAutoOngoingToArchivedIssuesTest(TestCase):
    @with_feature("organizations:escalating-issues-v2")
    def test_simple(self):
        now = datetime.now(tz=pytz.UTC)
        project = self.create_project()
        group = self.create_group(
            project=project, status=GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING
        )
        GroupHistory.objects.create(
            group=group,
            project=project,
            organization=project.organization,
            status=GroupHistoryStatus.ONGOING,
            date_added=now - timedelta(days=15),
        )

        with self.tasks():
            run_auto_archive()

        group.refresh_from_db()
        assert group.status == GroupStatus.IGNORED
        assert group.substatus == GroupSubStatus.UNTIL_ESCALATING

        ongoing_inbox = GroupInbox.objects.filter(group=group)
        assert len(ongoing_inbox) == 0

        assert GroupHistory.objects.filter(
            group=group, status=GroupHistoryStatus.ARCHIVED_UNTIL_ESCALATING
        ).exists()

        activity = Activity.objects.filter(group=group).order_by("-datetime").first()
        assert activity.type == ActivityType.SET_IGNORED.value
        assert activity.data.get("ignoreUntilEscalating")
