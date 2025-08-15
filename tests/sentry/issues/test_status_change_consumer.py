from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from sentry.issues.occurrence_consumer import _process_message
from sentry.issues.status_change_consumer import bulk_get_groups_from_fingerprints, update_status
from sentry.issues.status_change_message import StatusChangeMessageData
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
    detector_id: int | None = None,
) -> dict[str, Any]:
    payload = {
        "project_id": project_id,
        "fingerprint": fingerprint or ["group-1"],
        "new_status": new_status,
        "new_substatus": new_substatus,
        "payload_type": "status_change",
        "detector_id": detector_id,
        "activity_data": {"test": "test"},
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
        group = groups_by_fingerprint[(self.project.id, tuple(self.occurrence.fingerprint))]
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
        group1 = groups_by_fingerprint[(self.project.id, tuple(self.occurrence.fingerprint))]
        assert group1.id == self.group.id
        group2 = groups_by_fingerprint[(project2.id, tuple(occurrence2.fingerprint))]
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
        group = groups_by_fingerprint[(self.project.id, tuple(self.occurrence.fingerprint))]
        assert group.id == self.group.id
        mock_metrics_incr.assert_called_with("occurrence_ingest.grouphash.not_found", amount=1)

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
        group1 = groups_by_fingerprint[(self.project.id, tuple(self.occurrence.fingerprint))]
        assert group1.id == self.group.id
        group2 = groups_by_fingerprint[(project2.id, tuple(self.occurrence.fingerprint))]
        assert group2.id == group2.id
        assert group1.id != group2.id

    def test_bulk_get_single_project_multiple_hash(self) -> None:
        message = get_test_message(self.project.id, fingerprint=["new-fingerprint"])
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(message)
        assert result is not None

        other_occurrence = result[0]
        assert other_occurrence is not None
        other_group = Group.objects.get(grouphash__hash=other_occurrence.fingerprint[0])

        groups_by_fingerprint = bulk_get_groups_from_fingerprints(
            [(self.project.id, self.occurrence.fingerprint)]
        )
        assert groups_by_fingerprint == {
            (self.project.id, tuple(self.occurrence.fingerprint)): self.group
        }

        groups_by_fingerprint = bulk_get_groups_from_fingerprints(
            [(self.project.id, other_occurrence.fingerprint)]
        )
        assert groups_by_fingerprint == {
            (self.project.id, tuple(other_occurrence.fingerprint)): other_group
        }

        groups_by_fingerprint = bulk_get_groups_from_fingerprints(
            [
                (
                    self.project.id,
                    tuple([*self.occurrence.fingerprint, *other_occurrence.fingerprint]),
                )
            ]
        )
        assert groups_by_fingerprint == {
            (
                self.project.id,
                tuple([*self.occurrence.fingerprint, *other_occurrence.fingerprint]),
            ): self.group
        }

        groups_by_fingerprint = bulk_get_groups_from_fingerprints(
            [
                (
                    self.project.id,
                    tuple([*other_occurrence.fingerprint, *self.occurrence.fingerprint]),
                )
            ]
        )
        assert groups_by_fingerprint == {
            (
                self.project.id,
                tuple([*other_occurrence.fingerprint, *self.occurrence.fingerprint]),
            ): other_group
        }


class TestStatusChangeRegistry(IssueOccurrenceTestBase):
    def setUp(self) -> None:
        super().setUp()
        self.detector = self.create_detector()
        self.group = self.create_group(
            project=self.project,
            status=GroupStatus.UNRESOLVED,
            substatus=GroupSubStatus.ESCALATING,
        )

        status_change = get_test_message_status_change(
            self.project.id,
            new_status=GroupStatus.RESOLVED,
            detector_id=self.detector.id,
        )

        self.message = StatusChangeMessageData(
            id="test-id",
            project_id=status_change["project_id"],
            fingerprint=status_change["fingerprint"],
            new_status=status_change["new_status"],
            new_substatus=status_change.get("new_substatus"),
            detector_id=status_change.get("detector_id"),
            activity_data=status_change.get("activity_data"),
        )

    def get_latest_activity(self, activity_type: ActivityType) -> Activity:
        latest_activity = (
            Activity.objects.filter(group_id=self.group.id, type=activity_type.value)
            .order_by("-datetime")
            .first()
        )

        if latest_activity is None:
            raise AssertionError(f"No activity found for type {activity_type}")

        return latest_activity

    def test_handler_is_called__resolved(self) -> None:
        with patch(
            "sentry.issues.status_change_consumer.group_status_update_registry",
        ) as mock_registry:
            mock_handler = MagicMock()
            mock_registry.registrations = {
                "test_status_change": mock_handler,
            }

            update_status(self.group, self.message)
            latest_activity = self.get_latest_activity(ActivityType.SET_RESOLVED)

            assert latest_activity.data == {"test": "test"}

            mock_handler.assert_called_once_with(self.group, self.message, latest_activity)

    def test_handler_is_not_called__unresolved_escalating(self) -> None:
        # There will be an issue occurrence that triggers this instead

        self.message["new_status"] = GroupStatus.UNRESOLVED
        self.message["new_substatus"] = GroupSubStatus.ESCALATING
        with patch(
            "sentry.issues.status_change_consumer.group_status_update_registry",
        ) as mock_registry:
            mock_handler = MagicMock()
            mock_registry.registrations = {
                "test_status_change": mock_handler,
            }

            update_status(self.group, self.message)
            assert mock_handler.call_count == 0

    def test_handler_is_called_unresolved_ongoing(self) -> None:
        self.message["new_status"] = GroupStatus.UNRESOLVED
        self.message["new_substatus"] = GroupSubStatus.ONGOING

        with patch(
            "sentry.issues.status_change_consumer.group_status_update_registry",
        ) as mock_registry:
            mock_handler = MagicMock()
            mock_registry.registrations = {
                "test_status_change": mock_handler,
            }

            update_status(self.group, self.message)
            latest_activity = self.get_latest_activity(ActivityType.AUTO_SET_ONGOING)

            assert latest_activity.data == {"test": "test"}

            mock_handler.assert_called_once_with(self.group, self.message, latest_activity)

    def test_handler_is_called__unresolved_regressed(self) -> None:
        self.message["new_status"] = GroupStatus.UNRESOLVED
        self.message["new_substatus"] = GroupSubStatus.REGRESSED

        with patch(
            "sentry.issues.status_change_consumer.group_status_update_registry",
        ) as mock_registry:
            mock_handler = MagicMock()
            mock_registry.registrations = {
                "test_status_change": mock_handler,
            }

            update_status(self.group, self.message)
            latest_activity = self.get_latest_activity(ActivityType.SET_REGRESSION)

            assert latest_activity.data == {"test": "test"}

            mock_handler.assert_called_once_with(self.group, self.message, latest_activity)

    def test_handler_is_called__ignored(self) -> None:
        self.message["new_status"] = GroupStatus.IGNORED
        self.message["new_substatus"] = GroupSubStatus.FOREVER

        with patch(
            "sentry.issues.status_change_consumer.group_status_update_registry",
        ) as mock_registry:
            mock_handler = MagicMock()
            mock_registry.registrations = {
                "test_status_change": mock_handler,
            }

            update_status(self.group, self.message)
            latest_activity = self.get_latest_activity(ActivityType.SET_IGNORED)

            assert latest_activity.data == {"test": "test"}

            mock_handler.assert_called_once_with(self.group, self.message, latest_activity)
