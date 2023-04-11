from unittest.mock import patch

from sentry.issues.status_change import handle_status_update
from sentry.models import Activity, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.testutils import TestCase
from sentry.types.activity import ActivityType


class HandleStatusChangeTest(TestCase):  # type: ignore
    def create_issue(self, status):
        self.group = self.create_group(status=status)
        self.group_list = [self.group]
        self.group_ids = [self.group]
        self.projects = [self.group.project]
        self.project_lookup = {self.project.id: self.project}

    @patch("sentry.signals.issue_unignored.send_robust")
    def test_unresolve_ignored_issue(self, issue_unignored):
        self.create_issue(GroupStatus.IGNORED)
        handle_status_update(
            self.group_list,
            self.projects,
            self.project_lookup,
            self.user,
            GroupStatus.UNRESOLVED,
            False,
            {},
            self,
        )

        assert issue_unignored.called
        activity = Activity.objects.filter(
            group=self.group, type=ActivityType.SET_UNRESOLVED.value
        ).first()
        assert activity.data == {}

        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.UNRESOLVED
        ).exists()

    @patch("sentry.signals.issue_unresolved.send_robust")
    def test_unresolve_resolved_issue(self, issue_unresolved):
        self.create_issue(GroupStatus.RESOLVED)
        handle_status_update(
            self.group_list,
            self.projects,
            self.project_lookup,
            self.user,
            GroupStatus.UNRESOLVED,
            False,
            {},
            self,
        )

        assert issue_unresolved.called
        activity = Activity.objects.filter(
            group=self.group, type=ActivityType.SET_UNRESOLVED.value
        ).first()
        assert activity.data == {}

        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.UNRESOLVED
        ).exists()

    @patch("sentry.signals.issue_ignored.send_robust")
    def test_ignore_new_issue(self, issue_ignored):
        self.create_issue(GroupStatus.UNRESOLVED)
        handle_status_update(
            self.group_list,
            self.projects,
            self.project_lookup,
            self.user,
            GroupStatus.IGNORED,
            False,
            {"ignoreDuration": 30},
            self,
        )

        assert issue_ignored.called
        activity = Activity.objects.filter(
            group=self.group, type=ActivityType.SET_IGNORED.value
        ).first()
        assert activity.data.get("ignoreDuration") == 30

        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.IGNORED
        ).exists()
