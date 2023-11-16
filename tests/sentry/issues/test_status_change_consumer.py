from __future__ import annotations

from typing import Any, Dict

from sentry.issues.occurrence_consumer import _process_message
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

        occurrence = result[0]
        assert Group.objects.filter(grouphash__hash=occurrence.fingerprint[0]).exists()

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
