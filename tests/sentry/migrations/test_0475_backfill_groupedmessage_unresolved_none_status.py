import datetime
from typing import Any, Dict, Optional, Sequence, Tuple

import pytest

from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.project import Project
from sentry.testutils.cases import TestMigrations
from sentry.types.group import GroupSubStatus


@pytest.mark.skip("Migration is no longer runnable. Retain until migration is removed.")
class BackfillGroupUnresolvedNoneStatus(TestMigrations):
    migrate_from = "0474_make_organization_mapping_org_id_unique"
    migrate_to = "0475_backfill_groupedmessage_unresolved_none_status"

    def _create_unresolved_none_group(
        self, project: Project, group_history_kwargs: Optional[Sequence[Dict[str, Any]]] = None
    ) -> Tuple[Group, Sequence[GroupHistory]]:
        group = self.create_group(project=project, status=GroupStatus.UNRESOLVED)
        updated = Group.objects.filter(id=group.id).update(substatus=None)
        if updated:
            group.substatus = None

        group_histories = []
        for kwargs in group_history_kwargs or ():
            kwargs.update(
                {
                    "organization_id": project.organization.id,
                    "project_id": project.id,
                    "group_id": group.id,
                }
            )
            group_histories.append(GroupHistory.objects.create(**kwargs))

        return (group, group_histories)

    def setup_initial_state(self):
        now = datetime.datetime.now()

        self.no_group_history, _ = self._create_unresolved_none_group(self.project)

        self.regressed_group, _ = self._create_unresolved_none_group(
            self.project, [{"status": GroupHistoryStatus.REGRESSED, "date_added": now}]
        )

        self.unresolved_group, _ = self._create_unresolved_none_group(
            self.project, [{"status": GroupHistoryStatus.UNRESOLVED, "date_added": now}]
        )

        self.unresolved_unignored_group, _ = self._create_unresolved_none_group(
            self.project, [{"status": GroupHistoryStatus.UNIGNORED, "date_added": now}]
        )

        self.multiple_group_history, _ = self._create_unresolved_none_group(
            self.project,
            [
                {"status": GroupHistoryStatus.REGRESSED, "date_added": now},
                {
                    "status": GroupHistoryStatus.UNRESOLVED,
                    "date_added": now - datetime.timedelta(minutes=1),
                },
            ],
        )

        self.unchanged_groups = [
            self._create_unresolved_none_group(
                self.project, [{"status": gh_status, "date_added": now}]
            )
            for gh_status in (
                GroupHistoryStatus.RESOLVED,
                GroupHistoryStatus.SET_RESOLVED_IN_RELEASE,
                GroupHistoryStatus.SET_RESOLVED_IN_COMMIT,
                GroupHistoryStatus.SET_RESOLVED_IN_PULL_REQUEST,
                GroupHistoryStatus.AUTO_RESOLVED,
                GroupHistoryStatus.IGNORED,
                GroupHistoryStatus.ASSIGNED,
                GroupHistoryStatus.UNASSIGNED,
                GroupHistoryStatus.DELETED,
                GroupHistoryStatus.DELETED_AND_DISCARDED,
                GroupHistoryStatus.REVIEWED,
                GroupHistoryStatus.ESCALATING,
                GroupHistoryStatus.ARCHIVED_UNTIL_ESCALATING,
                GroupHistoryStatus.ARCHIVED_FOREVER,
                GroupHistoryStatus.ARCHIVED_UNTIL_CONDITION_MET,
                GroupHistoryStatus.NEW,
            )
        ]

    def test(self):
        # positive cases
        self.regressed_group.refresh_from_db()
        assert self.regressed_group.status == GroupStatus.UNRESOLVED
        assert self.regressed_group.substatus == GroupSubStatus.REGRESSED

        self.unresolved_group.refresh_from_db()
        assert self.unresolved_group.status == GroupStatus.UNRESOLVED
        assert self.unresolved_group.substatus == GroupSubStatus.ONGOING

        self.unresolved_unignored_group.refresh_from_db()
        assert self.unresolved_unignored_group.status == GroupStatus.UNRESOLVED
        assert self.unresolved_unignored_group.substatus == GroupSubStatus.ONGOING

        self.multiple_group_history.refresh_from_db()
        assert self.multiple_group_history.status == GroupStatus.UNRESOLVED
        assert self.multiple_group_history.substatus == GroupSubStatus.REGRESSED

        # migration should skip these
        self.no_group_history.refresh_from_db()
        assert self.no_group_history.status == GroupStatus.UNRESOLVED
        assert self.no_group_history.substatus is None

        # groups with these as the latest GroupHistory should be skipped
        for unchanged, _ in self.unchanged_groups:
            unchanged.refresh_from_db()
            assert unchanged.status == GroupStatus.UNRESOLVED
            assert unchanged.substatus is None
