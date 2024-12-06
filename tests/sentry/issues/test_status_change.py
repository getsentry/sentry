from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from unittest.mock import patch

from sentry.issues.ignored import IGNORED_CONDITION_FIELDS
from sentry.issues.status_change import handle_status_update, infer_substatus
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.testutils.cases import TestCase
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus


class InferSubstatusTest(TestCase):
    def test_ignore_until_escalating(self) -> None:
        assert (
            infer_substatus(
                new_status=GroupStatus.IGNORED,
                new_substatus=None,
                status_details={"untilEscalating": True},
                group_list=[],
            )
            == GroupSubStatus.UNTIL_ESCALATING
        )

    def test_ignore_condition_met(self) -> None:
        for condition in IGNORED_CONDITION_FIELDS:
            assert (
                infer_substatus(
                    new_status=GroupStatus.IGNORED,
                    new_substatus=None,
                    status_details={condition: 50},
                    group_list=[],
                )
                == GroupSubStatus.UNTIL_CONDITION_MET
            )

    def test_ignore_forever(self) -> None:
        assert (
            infer_substatus(
                new_status=GroupStatus.IGNORED,
                new_substatus=None,
                status_details={"status": "ignored"},
                group_list=[],
            )
            == GroupSubStatus.FOREVER
        )

    def test_unresolve_new_group(self) -> None:
        assert (
            infer_substatus(
                new_status=GroupStatus.UNRESOLVED,
                new_substatus=None,
                status_details={},
                group_list=[self.create_group(status=GroupStatus.IGNORED)],
            )
            == GroupSubStatus.NEW
        )

    def test_unresolve_ongoing_group(self) -> None:
        assert (
            infer_substatus(
                new_status=GroupStatus.UNRESOLVED,
                new_substatus=None,
                status_details={},
                group_list=[
                    self.create_group(first_seen=datetime.now(timezone.utc) - timedelta(days=10))
                ],
            )
            == GroupSubStatus.ONGOING
        )

    def test_unresolve_regressed_group(self) -> None:
        assert (
            infer_substatus(
                new_status=GroupStatus.UNRESOLVED,
                new_substatus=None,
                status_details={},
                group_list=[
                    self.create_group(
                        status=GroupStatus.RESOLVED,
                        first_seen=datetime.now(timezone.utc) - timedelta(days=10),
                    )
                ],
            )
            == GroupSubStatus.REGRESSED
        )


class HandleStatusChangeTest(TestCase):
    def create_issue(self, status: int, substatus: int | None = None) -> None:
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
            is_bulk=False,
            status_details={},
            new_status=GroupStatus.UNRESOLVED,
            new_substatus=GroupSubStatus.ONGOING,
            sender=self,
        )

        assert issue_unignored.called
        activity = Activity.objects.get(group=self.group, type=ActivityType.SET_UNRESOLVED.value)
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
            is_bulk=False,
            status_details={},
            sender=self,
        )

        assert issue_unresolved.called
        activity = Activity.objects.get(group=self.group, type=ActivityType.SET_UNRESOLVED.value)
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
            is_bulk=False,
            status_details={"ignoreDuration": 30},
            sender=self,
        )

        assert issue_ignored.called
        activity = Activity.objects.get(group=self.group, type=ActivityType.SET_IGNORED.value)
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
            is_bulk=False,
            status_details={"ignoreUntilEscalating": True},
            sender=self,
        )

        assert issue_ignored.called
        activity = Activity.objects.get(group=self.group, type=ActivityType.SET_IGNORED.value)
        assert activity.data.get("ignoreUntilEscalating")

        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.IGNORED
        ).exists()
