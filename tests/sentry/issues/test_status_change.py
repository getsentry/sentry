from typing import Any, Optional
from unittest.mock import patch

from sentry.issues.status_change import handle_resolved_status, handle_status_update
from sentry.models import Activity, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.repository import Repository
from sentry.testutils import TestCase
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


class HandleStatusChangeTest(TestCase):
    def create_issue(self, status: GroupStatus, substatus: Optional[GroupSubStatus] = None) -> None:
        self.group = self.create_group(status=status)
        self.group_list = [self.group]
        self.group_ids = [self.group]
        self.projects = [self.group.project]
        self.project_lookup = {self.project.id: self.project}

    @patch("sentry.signals.issue_unignored.send_robust")
    def test_unresolve_ignored_issue(self, issue_unignored: Any) -> None:
        self.create_issue(GroupStatus.IGNORED)
        handle_status_update(
            self.group_list,
            self.projects,
            self.project_lookup,
            acting_user=self.user,
            is_bulk=True,
            status_details={},
            new_status=GroupStatus.UNRESOLVED,
            new_substatus=GroupSubStatus.ONGOING,
            sender=self,
            activity_type=None,
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
    def test_unresolve_resolved_issue(self, issue_unresolved: Any) -> None:
        self.create_issue(GroupStatus.RESOLVED)
        handle_status_update(
            self.group_list,
            self.projects,
            self.project_lookup,
            acting_user=self.user,
            new_status=GroupStatus.UNRESOLVED,
            new_substatus=GroupSubStatus.ONGOING,
            is_bulk=True,
            status_details={},
            sender=self,
            activity_type=None,
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
    def test_ignore_new_issue(self, issue_ignored: Any) -> None:
        self.create_issue(GroupStatus.UNRESOLVED)
        handle_status_update(
            self.group_list,
            self.projects,
            self.project_lookup,
            acting_user=self.user,
            new_status=GroupStatus.IGNORED,
            new_substatus=None,
            is_bulk=True,
            status_details={"ignoreDuration": 30},
            sender=self,
            activity_type=None,
        )

        assert issue_ignored.called
        activity = Activity.objects.filter(
            group=self.group, type=ActivityType.SET_IGNORED.value
        ).first()
        assert activity.data.get("ignoreDuration") == 30

        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.IGNORED
        ).exists()

    @patch("sentry.signals.issue_ignored.send_robust")
    def test_ignore_until_escalating(self, issue_ignored: Any) -> None:
        self.create_issue(GroupStatus.UNRESOLVED)
        handle_status_update(
            self.group_list,
            self.projects,
            self.project_lookup,
            acting_user=self.user,
            new_status=GroupStatus.IGNORED,
            new_substatus=None,
            is_bulk=True,
            status_details={"ignoreUntilEscalating": True},
            sender=self,
            activity_type=None,
        )

        assert issue_ignored.called
        activity = Activity.objects.filter(
            group=self.group, type=ActivityType.SET_IGNORED.value
        ).first()
        assert activity.data.get("ignoreUntilEscalating")

        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.IGNORED
        ).exists()


class HandleResolvedStatusTest(TestCase):
    def create_issue(self, status: GroupStatus, substatus: GroupSubStatus = None) -> None:
        self.group = self.create_group(status=status)
        self.group_list = [self.group]
        self.group_ids = [self.group]
        self.projects = [self.group.project]
        self.project_lookup = {self.project.id: self.project}
        self.acting_user = self.user if self.user.is_authenticated else None

    def setUp(self):
        self.create_issue(GroupStatus.UNRESOLVED, substatus=GroupSubStatus.ONGOING)

    @patch("sentry.signals.issue_resolved.send_robust")
    def test_handle_resolved_in_next_release(self, issue_resolved):
        self.create_release(project=self.group.project)
        handle_resolved_status(
            "resolvedInNextRelease",
            {},
            self.projects,
            self.user,
            self.acting_user,
            self.group.project.organization_id,
            self.group_list,
            self.project_lookup,
            None,
            False,
        )

        activity = Activity.objects.filter(
            group=self.group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        ).first()
        assert activity.data.get("version") == ""
        assert issue_resolved.called

        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.SET_RESOLVED_IN_RELEASE
        ).exists()

    @patch("sentry.signals.issue_resolved.send_robust")
    def test_handle_resolved_in_release(self, issue_resolved):
        self.create_release(project=self.group.project)
        handle_resolved_status(
            "resolved",
            {"inRelease": self.release},
            self.projects,
            self.user,
            self.acting_user,
            self.group.project.organization_id,
            self.group_list,
            self.project_lookup,
            None,
            False,
        )

        assert issue_resolved.called
        activity = Activity.objects.filter(
            group=self.group, type=ActivityType.SET_RESOLVED_IN_RELEASE.value
        ).first()
        assert activity.data.get("version") == self.release.version

        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.SET_RESOLVED_IN_RELEASE
        ).exists()

    @patch("sentry.signals.issue_resolved.send_robust")
    def test_handle_resolved_in_commit(self, issue_resolved):
        self.create_release(project=self.group.project)
        self.repo = Repository.objects.create(
            organization_id=self.organization.id,
            name="example",
            integration_id=self.integration.id,
        )
        self.commit = self.create_commit(
            project=self.project,
            repo=self.repo,
            author=self.create_commit_author(project=self.project, user=self.user),
            key="asdfwreqr",
            message="placeholder commit message",
        )
        handle_resolved_status(
            "resolved",
            {"inCommit": self.commit},
            self.projects,
            self.user,
            self.acting_user,
            self.group.project.organization_id,
            self.group_list,
            self.project_lookup,
            None,
            False,
        )

        assert issue_resolved.called
        activity = Activity.objects.filter(
            group=self.group, type=ActivityType.SET_RESOLVED_IN_COMMIT.value
        ).first()
        assert activity.data.get("commit") == self.commit.id

        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.SET_RESOLVED_IN_COMMIT
        ).exists()

    @patch("sentry.signals.issue_resolved.send_robust")
    def test_handle_resolved(self, issue_resolved):
        handle_resolved_status(
            "resolved",
            {},
            self.projects,
            self.user,
            self.acting_user,
            self.group.project.organization_id,
            self.group_list,
            self.project_lookup,
            None,
            False,
        )

        assert issue_resolved.called
        activity = Activity.objects.filter(
            group=self.group, type=ActivityType.SET_RESOLVED.value
        ).first()
        assert activity.data == {}

        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.RESOLVED
        ).exists()
