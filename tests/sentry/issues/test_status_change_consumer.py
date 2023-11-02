from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from sentry.issues.occurrence_consumer import _process_message
from sentry.models.group import GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.testutils.helpers.datetime import iso_format
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.group import GroupSubStatus
from tests.sentry.issues.test_occurrence_consumer import IssueOccurrenceTestBase


def get_test_message(
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
    def setUp(self):
        super().setUp()
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": iso_format(datetime.now()),
                "fingerprint": ["group-1"],
            },
            project_id=self.project.id,
        )
        group = event.group
        assert group
        self.group_hash = GroupHash.objects.filter(group=group, project=self.project).first()

    @django_db_all
    def test_valid_payloa_resolved(self) -> None:
        message = get_test_message(self.project.id, fingerprint=[self.group_hash.hash])
        result = _process_message(message)
        assert result is not None
        group_info = result[1]
        assert group_info is not None
        group = group_info.group
        group.refresh_from_db()

        assert group.status == GroupStatus.RESOLVED
        assert group.substatus is None

    def test_valid_payload_archived_forever(self) -> None:
        message = get_test_message(
            self.project.id,
            fingerprint=[self.group_hash.hash],
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
        message = get_test_message(
            self.project.id,
            fingerprint=[self.group_hash.hash],
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
