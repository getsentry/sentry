import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_status_change import OccurrenceStatusChange
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.models.activity import Activity, ActivityType
from sentry.models.group import GroupStatus
from sentry.models.grouphash import GroupHash
from sentry.models.grouphistory import GroupHistory, GroupHistoryStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.skips import requires_snuba
from sentry.types.group import GroupSubStatus
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = [requires_snuba]


class TestProduceOccurrenceToKafka(TestCase, OccurrenceTestMixin):
    def test_event_id_mismatch(self) -> None:
        with self.assertRaisesMessage(
            ValueError, "Event id on occurrence and event_data must be the same"
        ):
            produce_occurrence_to_kafka(
                payload_type=PayloadType.OCCURRENCE,
                occurrence=self.build_occurrence(),
                event_data={"event_id": uuid.uuid4().hex},
            )

    def test_with_event(self) -> None:
        occurrence = self.build_occurrence()
        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data={
                "event_id": occurrence.event_id,
                "project_id": self.project.id,
                "title": "some problem",
                "platform": "python",
                "tags": {"my_tag": "2"},
                "timestamp": before_now(minutes=1).isoformat(),
                "received": before_now(minutes=1).isoformat(),
            },
        )
        stored_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert stored_occurrence
        assert occurrence.event_id == stored_occurrence.event_id

    def test_with_only_occurrence(self) -> None:
        event = self.store_event(data=load_data("transaction"), project_id=self.project.id)
        occurrence = self.build_occurrence(event_id=event.event_id, project_id=self.project.id)
        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
        )
        stored_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert stored_occurrence
        assert occurrence.event_id == stored_occurrence.event_id

    def test_with_status_change(self):
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
        group_hash = GroupHash.objects.filter(group=group, project=self.project).first()
        initial_status = group.status
        initial_substatus = group.substatus

        status_change_resolve = OccurrenceStatusChange(
            fingerprint=[group_hash.hash],
            project_id=group.project_id,
            new_status=initial_status,
            new_substatus=initial_substatus,
        )
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=status_change_resolve,
        )
        group.refresh_from_db()
        assert group.status == initial_status
        assert group.substatus == initial_substatus

        assert not Activity.objects.filter(group=group).exists()
        assert not GroupHistory.objects.filter(group=group).exists()

        status_change_resolve = OccurrenceStatusChange(
            fingerprint=[group_hash.hash],
            project_id=group.project_id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
        )
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=status_change_resolve,
        )
        group.refresh_from_db()
        assert group.status == GroupStatus.RESOLVED
        assert group.substatus is None

        assert Activity.objects.filter(group=group, type=ActivityType.SET_RESOLVED.value).exists()
        assert GroupHistory.objects.filter(group=group, status=GroupHistoryStatus.RESOLVED).exists()

    @patch("sentry.issues.occurrence_status_change.logger.error")
    def test_with_invalid_status_change(self, mock_logger_error: MagicMock) -> None:
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": iso_format(datetime.now()),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        group = event.group
        group_hash = GroupHash.objects.filter(group=group, project=self.project).first()
        initial_status = group.status
        initial_substatus = group.substatus

        bad_status_change_resolve = OccurrenceStatusChange(
            fingerprint=[group_hash.hash],
            project_id=group.project_id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=GroupSubStatus.FOREVER,
        )
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=bad_status_change_resolve,
        )
        group.refresh_from_db()
        mock_logger_error.assert_called_with(
            "group.update_status.invalid_substatus",
            extra={
                "project_id": group.project_id,
                "fingerprint": [group_hash.hash],
                "new_status": GroupStatus.RESOLVED,
                "new_substatus": GroupSubStatus.FOREVER,
            },
        )
        assert group.status == initial_status
        assert group.substatus == initial_substatus

        bad_status_change_ignored = OccurrenceStatusChange(
            fingerprint=[group_hash.hash],
            project_id=group.project_id,
            new_status=GroupStatus.IGNORED,
            new_substatus=None,
        )
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=bad_status_change_ignored,
        )
        group.refresh_from_db()
        mock_logger_error.assert_called_with(
            "group.update_status.missing_substatus",
            extra={
                "project_id": group.project_id,
                "fingerprint": [group_hash.hash],
                "new_status": GroupStatus.IGNORED,
                "new_substatus": None,
            },
        )
        assert group.status == initial_status
        assert group.substatus == initial_substatus

    def test_with_invalid_payloads(self) -> None:
        with pytest.raises(ValueError):
            produce_occurrence_to_kafka(
                payload_type=PayloadType.OCCURRENCE,
            )

            produce_occurrence_to_kafka(
                payload_type=PayloadType.STATUS_CHANGE,
            )

        with pytest.raises(NotImplementedError):
            produce_occurrence_to_kafka(payload_type="invalid")  # type: ignore
