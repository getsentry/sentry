from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

from sentry.issues.occurrence_consumer import _process_message
from sentry.models.group import GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.testutils.helpers.datetime import iso_format
from sentry.testutils.helpers.features import with_feature
from sentry.testutils.pytest.fixtures import django_db_all
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


class StatusChangeProcessMessageTest(IssueOccurrenceTestBase):
    @django_db_all
    @with_feature("organizations:issue-platform-api-crons-sd")
    def test_valid_payload(self) -> None:
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
        group_hash = GroupHash.objects.filter(group=group, project=self.project).first()

        message = get_test_message(self.project.id, fingerprint=[group_hash.hash])
        result = _process_message(message)
        assert result is not None
        group_info = result[1]
        assert group_info is not None
        group = group_info.group
        group.refresh_from_db()

        assert group.status == GroupStatus.RESOLVED
        assert group.substatus is None
