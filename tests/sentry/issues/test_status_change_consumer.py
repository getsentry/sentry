from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from sentry.issues.occurrence_consumer import _process_message
from sentry.issues.status_change_consumer import bulk_get_groups_from_fingerprints
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.models.groupinbox import GroupInbox, GroupInboxReason
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.activity import ActivityType
from sentry.types.group import GroupSubStatus, PriorityLevel
from tests.sentry.issues.test_occurrence_consumer import IssueOccurrenceTestBase, get_test_message


def get_test_message_status_change(
    project_id: int,
    fingerprint: list[str] | None = None,
    new_status: int = GroupStatus.RESOLVED,
    new_substatus: int | None = None,
) -> dict[str, Any]:
    payload = {
        "project_id": project_id,
        "fingerprint": fingerprint or ["group-1"],
        "new_status": new_status,
        "new_substatus": new_substatus,
        "payload_type": "status_change",
    }

    return payload


class StatusChangeProcessMessageTest(IssueOccurrenceTestBase):
    @django_db_all
    def setUp(self) -> None:
        super().setUp()
        message = get_test_message(self.project.id)
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(message)
        assert result is not None

        self.occurrence = result[0]
        assert self.occurrence is not None
        self.group = Group.objects.get(grouphash__hash=self.occurrence.fingerprint[0])
        self.fingerprint = ["touch-id"]

    def _assert_statuses_set(
        self,
        status: int,
        substatus: int | None,
        group_history_status: int,
        activity_type: ActivityType,
        priority: int | None = None,
        group_inbox_reason: GroupInboxReason | None = None,
    ) -> None:
        self.group.refresh_from_db()
        assert self.group.status == status
        assert self.group.substatus == substatus
        assert GroupHistory.objects.filter(
            group_id=self.group.id, status=group_history_status
        ).exists()
        assert Activity.objects.filter(group_id=self.group.id, type=activity_type.value).exists()
        if priority:
            assert self.group.priority == priority
            assert Activity.objects.filter(
                group_id=self.group.id, type=ActivityType.SET_PRIORITY.value
            ).exists()

        if group_inbox_reason:
            assert GroupInbox.objects.filter(
                group=self.group, reason=group_inbox_reason.value
            ).exists()
        else:
            assert not GroupInbox.objects.filter(group=self.group).exists()

    @django_db_all
    @patch("sentry.issues.status_change_consumer.kick_off_status_syncs")
    def test_valid_payload_resolved(self, mock_kick_off_status_syncs: MagicMock) -> None:
        message = get_test_message_status_change(self.project.id, fingerprint=["touch-id"])
        result = _process_message(message)
        assert result is not None
        group_info = result[1]
        assert group_info is not None
        group = group_info.group
        group.refresh_from_db()

        self._assert_statuses_set(
            GroupStatus.RESOLVED,
            None,
            GroupHistoryStatus.RESOLVED,
            ActivityType.SET_RESOLVED,
            group_inbox_reason=None,
        )

        mock_kick_off_status_syncs.apply_async.assert_called_once_with(
            kwargs={"project_id": self.project.id, "group_id": self.group.id}
        )

    @patch("sentry.issues.status_change_consumer.kick_off_status_syncs")
    def test_valid_payload_archived_forever(self, mock_kick_off_status_syncs: MagicMock) -> None:
        message = get_test_message_status_change(
            self.project.id,
            fingerprint=self.fingerprint,
            new_status=GroupStatus.IGNORED,
            new_substatus=GroupSubStatus.FOREVER,
        )
        result = _process_message(message)
        assert result is not None
        group_info = result[1]
        assert group_info is not None
        group = group_info.group
        group.refresh_from_db()

        self._assert_statuses_set(
            GroupStatus.IGNORED,
            GroupSubStatus.FOREVER,
            GroupHistoryStatus.ARCHIVED_FOREVER,
            ActivityType.SET_IGNORED,
            group_inbox_reason=None,
        )

        mock_kick_off_status_syncs.apply_async.assert_called_once_with(
            kwargs={"project_id": self.project.id, "group_id": self.group.id}
        )

    @patch("sentry.integrations.tasks.kick_off_status_syncs.kick_off_status_syncs")
    def test_valid_payload_unresolved_escalating(
        self, mock_kick_off_status_syncs: MagicMock
    ) -> None:
        self.group.update(
            status=GroupStatus.IGNORED,
            substatus=GroupSubStatus.UNTIL_ESCALATING,
            priority=PriorityLevel.MEDIUM,
        )
        message = get_test_message_status_change(
            self.project.id,
            fingerprint=self.fingerprint,
            new_status=GroupStatus.UNRESOLVED,
            new_substatus=GroupSubStatus.ESCALATING,
        )
        result = _process_message(message)
        assert result is not None
        group_info = result[1]
        assert group_info is not None
        group = group_info.group
        group.refresh_from_db()

        self._assert_statuses_set(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.ESCALATING,
            GroupHistoryStatus.ESCALATING,
            ActivityType.SET_ESCALATING,
            PriorityLevel.HIGH,
            group_inbox_reason=GroupInboxReason.ESCALATING,
        )

        mock_kick_off_status_syncs.apply_async.assert_called_once_with(
            kwargs={"project_id": self.project.id, "group_id": self.group.id}
        )

    def test_valid_payload_auto_ongoing(self) -> None:
        self.group.update(
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ESCALATING,
            priority=PriorityLevel.HIGH,
        )
        self.group.data.get("metadata", {}).update({"initial_priority": PriorityLevel.MEDIUM})
        self.group.save()

        message = get_test_message_status_change(
            self.project.id,
            fingerprint=self.fingerprint,
            new_status=GroupStatus.UNRESOLVED,
            new_substatus=GroupSubStatus.ONGOING,
        )
        result = _process_message(message)
        assert result is not None
        group_info = result[1]
        assert group_info is not None
        group = group_info.group
        group.refresh_from_db()

        self._assert_statuses_set(
            GroupStatus.UNRESOLVED,
            GroupSubStatus.ONGOING,
            GroupHistoryStatus.ONGOING,
            ActivityType.AUTO_SET_ONGOING,
            PriorityLevel.MEDIUM,
            group_inbox_reason=GroupInboxReason.ONGOING,
        )


class StatusChangeBulkGetGroupsFromFingerprintsTest(IssueOccurrenceTestBase):
    @django_db_all
    def setUp(self) -> None:
        super().setUp()
        message = get_test_message(self.project.id)
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(message)
        assert result is not None

        occurrence = result[0]
        assert occurrence is not None
        self.occurrence = occurrence
        self.group = Group.objects.get(grouphash__hash=self.occurrence.fingerprint[0])
        self.fingerprint = ["touch-id"]

    def test_bulk_get_single_project(self) -> None:
        groups_by_fingerprint = bulk_get_groups_from_fingerprints(
            [(self.project.id, self.occurrence.fingerprint)]
        )
        assert len(groups_by_fingerprint) == 1
        group = groups_by_fingerprint[(self.project.id, self.occurrence.fingerprint[0])]
        assert group.id == self.group.id

    def test_bulk_get_multiple_projects(self) -> None:
        # set up second project and occurrence
        project2 = self.create_project(organization=self.organization)
        message = get_test_message(project2.id, fingerprint="new-fingerprint")
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(message)
        assert result is not None
        occurrence2 = result[0]
        assert occurrence2 is not None
        group2 = Group.objects.get(grouphash__hash=occurrence2.fingerprint[0])

        # get groups by fingerprint
        groups_by_fingerprint = bulk_get_groups_from_fingerprints(
            [
                (self.project.id, self.occurrence.fingerprint),
                (project2.id, occurrence2.fingerprint),
            ]
        )
        assert len(groups_by_fingerprint) == 2
        group1 = groups_by_fingerprint[(self.project.id, self.occurrence.fingerprint[0])]
        assert group1.id == self.group.id
        group2 = groups_by_fingerprint[(project2.id, occurrence2.fingerprint[0])]
        assert group2.id == group2.id

    @patch("sentry.issues.status_change_consumer.metrics.incr")
    def test_bulk_get_missing_hash(self, mock_metrics_incr: MagicMock) -> None:
        # set up second project and occurrence
        project2 = self.create_project(organization=self.organization)
        message = get_test_message(project2.id, fingerprint="new-fingerprint")
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(message)
        assert result is not None
        occurrence2 = result[0]
        assert occurrence2 is not None
        assert Group.objects.filter(grouphash__hash=occurrence2.fingerprint[0]).exists()

        # get groups by fingerprint
        groups_by_fingerprint = bulk_get_groups_from_fingerprints(
            [
                (self.project.id, self.occurrence.fingerprint),
                (project2.id, self.occurrence.fingerprint),  # this one is missing
            ]
        )

        assert len(groups_by_fingerprint) == 1
        group = groups_by_fingerprint[(self.project.id, self.occurrence.fingerprint[0])]
        assert group.id == self.group.id
        mock_metrics_incr.assert_called_with("occurrence_ingest.grouphash.not_found")

    def test_bulk_get_same_fingerprint(self) -> None:
        # Set up second project and occurrence with the same
        # fingerprint as the occurrence from the first project.
        project2 = self.create_project(organization=self.organization)
        message = get_test_message(project2.id)
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(message)
        assert result is not None
        occurrence2 = result[0]
        assert occurrence2 is not None
        group2 = Group.objects.get(grouphash__hash=occurrence2.fingerprint[0], project=project2)

        assert occurrence2.fingerprint[0] == self.occurrence.fingerprint[0]

        # get groups by fingerprint
        groups_by_fingerprint = bulk_get_groups_from_fingerprints(
            [
                (self.project.id, self.occurrence.fingerprint),
                (project2.id, self.occurrence.fingerprint),
            ]
        )
        assert len(groups_by_fingerprint) == 2
        group1 = groups_by_fingerprint[(self.project.id, self.occurrence.fingerprint[0])]
        assert group1.id == self.group.id
        group2 = groups_by_fingerprint[(project2.id, self.occurrence.fingerprint[0])]
        assert group2.id == group2.id
        assert group1.id != group2.id
