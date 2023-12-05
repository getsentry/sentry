from __future__ import annotations

from typing import Any, Dict
from unittest.mock import MagicMock, patch

from sentry.issues.occurrence_consumer import _process_message
from sentry.issues.status_change_consumer import bulk_get_groups_from_fingerprints
from sentry.models.group import Group, GroupStatus
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.group import GroupSubStatus
from tests.sentry.issues.test_occurrence_consumer import IssueOccurrenceTestBase, get_test_message


def get_test_message_status_change(
    project_id: int,
    fingerprint: list[str] | None = None,
    new_status: int = GroupStatus.RESOLVED,
    new_substatus: int | None = None,
) -> Dict[str, Any]:
    payload = {
        "project_id": project_id,
        "fingerprint": fingerprint or ["group-1"],
        "new_status": new_status,
        "new_substatus": new_substatus,
        "payload_type": "status_change",
    }

    return payload


@apply_feature_flag_on_cls("organizations:issue-platform-api-crons-sd")
class StatusChangeProcessMessageTest(IssueOccurrenceTestBase):
    @django_db_all
    def setUp(self):
        super().setUp()
        message = get_test_message(self.project.id)
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(message)
        assert result is not None

        self.occurrence = result[0]
        self.group = Group.objects.get(grouphash__hash=self.occurrence.fingerprint[0])
        self.fingerprint = ["touch-id"]

    @django_db_all
    def test_valid_payload_resolved(self) -> None:
        message = get_test_message_status_change(self.project.id, fingerprint=["touch-id"])
        result = _process_message(message)
        assert result is not None
        group_info = result[1]
        assert group_info is not None
        group = group_info.group
        group.refresh_from_db()

        assert group.status == GroupStatus.RESOLVED
        assert group.substatus is None

    def test_valid_payload_archived_forever(self) -> None:
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

        assert group.status == GroupStatus.IGNORED
        assert group.substatus == GroupSubStatus.FOREVER

    def test_valid_payload_unresolved_escalating(self) -> None:
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

        assert group.status == GroupStatus.UNRESOLVED
        assert group.substatus == GroupSubStatus.ESCALATING

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

    @patch("sentry.issues.status_change_consumer.logger.error")
    def test_bulk_get_missing_hash(self, mock_logger_error: MagicMock) -> None:
        # set up second project and occurrence
        project2 = self.create_project(organization=self.organization)
        message = get_test_message(project2.id, fingerprint="new-fingerprint")
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(message)
        assert result is not None
        assert Group.objects.filter(grouphash__hash=result[0].fingerprint[0]).exists()

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
        mock_logger_error.assert_called_with(
            "grouphash.not_found",
            extra={
                "project_id": project2.id,
                "fingerprint": self.occurrence.fingerprint[0],
            },
        )

    def test_bulk_get_same_fingerprint(self) -> None:
        # Set up second project and occurrence with the same
        # fingerprint as the occurrence from the first project.
        project2 = self.create_project(organization=self.organization)
        message = get_test_message(project2.id)
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(message)
        assert result is not None
        occurrence2 = result[0]
        group2 = Group.objects.get(grouphash__hash=result[0].fingerprint[0], project=project2)

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
