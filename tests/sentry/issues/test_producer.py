import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload
from django.test import override_settings

from sentry.issues.ingest import process_occurrence_data
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import PayloadType, produce_occurrence_to_kafka
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.activity import Activity
from sentry.models.group import GroupStatus
from sentry.models.grouphistory import STRING_TO_STATUS_LOOKUP, GroupHistory, GroupHistoryStatus
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import apply_feature_flag_on_cls
from sentry.testutils.skips import requires_snuba
from sentry.types.activity import ActivityType
from sentry.types.group import GROUP_SUBSTATUS_TO_GROUP_HISTORY_STATUS, GroupSubStatus
from sentry.utils import json
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin

pytestmark = [requires_snuba]


@apply_feature_flag_on_cls("organizations:profile-file-io-main-thread-ingest")
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
        occurrence = self.build_occurrence(project_id=self.project.id)
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

    def test_without_payload_type(self) -> None:
        # Ensure the occurrence is processes without a payload_type too.
        occurrence = self.build_occurrence(project_id=self.project.id)
        produce_occurrence_to_kafka(
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

    @patch(
        "sentry.issues.producer._prepare_occurrence_message", return_value={"mock_data": "great"}
    )
    @patch("sentry.issues.producer._occurrence_producer.produce")
    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_payload_sent_to_kafka_with_partition_key(
        self, mock_produce: MagicMock, mock_prepare_occurrence_message: MagicMock
    ) -> None:
        occurrence = self.build_occurrence(project_id=self.project.id, fingerprint=["group-1"])
        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data={},
        )
        mock_produce.assert_called_once_with(
            ArroyoTopic(name="ingest-occurrences"),
            KafkaPayload(
                f"{occurrence.fingerprint[0]}-{occurrence.project_id}".encode(),
                json.dumps({"mock_data": "great"}).encode("utf-8"),
                [],
            ),
        )

    @patch(
        "sentry.issues.producer._prepare_occurrence_message", return_value={"mock_data": "great"}
    )
    @patch("sentry.issues.producer._occurrence_producer.produce")
    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_payload_sent_to_kafka_with_partition_key_no_fingerprint(
        self, mock_produce: MagicMock, mock_prepare_occurrence_message: MagicMock
    ) -> None:
        occurrence = self.build_occurrence(project_id=self.project.id, fingerprint=[])
        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=occurrence,
            event_data={},
        )
        mock_produce.assert_called_once_with(
            ArroyoTopic(name="ingest-occurrences"),
            KafkaPayload(None, json.dumps({"mock_data": "great"}).encode("utf-8"), []),
        )

    @patch(
        "sentry.issues.producer._prepare_occurrence_message", return_value={"mock_data": "great"}
    )
    @patch("sentry.issues.producer._occurrence_producer.produce")
    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_payload_sent_to_kafka_with_partition_key_no_occurrence(
        self, mock_produce: MagicMock, mock_prepare_occurrence_message: MagicMock
    ) -> None:
        produce_occurrence_to_kafka(
            payload_type=PayloadType.OCCURRENCE,
            occurrence=None,
            event_data={},
        )
        mock_produce.assert_called_once_with(
            ArroyoTopic(name="ingest-occurrences"),
            KafkaPayload(None, json.dumps({"mock_data": "great"}).encode("utf-8"), []),
        )


class TestProduceOccurrenceForStatusChange(TestCase, OccurrenceTestMixin):
    def setUp(self) -> None:
        self.fingerprint = ["group-1"]
        self.event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": datetime.now().isoformat(),
                "fingerprint": self.fingerprint,
            },
            project_id=self.project.id,
        )
        self.group = self.event.group
        assert self.group
        self.group.substatus = GroupSubStatus.ONGOING
        self.group.save()

        self.initial_status = self.group.status
        self.initial_substatus = self.group.substatus

    def test_with_invalid_payloads(self) -> None:
        with pytest.raises(ValueError, match="occurrence must be provided"):
            # Should raise an error because the occurrence is not provided for the OCCURRENCE payload type.
            produce_occurrence_to_kafka(
                payload_type=PayloadType.OCCURRENCE,
            )

        with pytest.raises(ValueError, match="status_change must be provided"):
            # Should raise an error because the status_change object is not provided for the STATUS_CHANGE payload type.
            produce_occurrence_to_kafka(
                payload_type=PayloadType.STATUS_CHANGE,
            )

        with pytest.raises(NotImplementedError, match="Unknown payload type: invalid"):
            # Should raise an error because the payload type is not supported.
            produce_occurrence_to_kafka(payload_type="invalid")  # type: ignore[arg-type]

    def test_with_no_status_change(self) -> None:
        status_change = StatusChangeMessage(
            fingerprint=self.fingerprint,
            project_id=self.group.project_id,
            new_status=self.initial_status,
            new_substatus=self.initial_substatus,
        )
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=status_change,
        )
        self.group.refresh_from_db()
        assert self.group.status == self.initial_status
        assert self.group.substatus == self.initial_substatus

        assert not Activity.objects.filter(group=self.group).exists()
        assert not GroupHistory.objects.filter(group=self.group).exists()

    def test_with_status_change_resolved(self) -> None:
        status_change = StatusChangeMessage(
            fingerprint=self.fingerprint,
            project_id=self.group.project_id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=None,
        )
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=status_change,
        )
        self.group.refresh_from_db()
        assert self.group.status == GroupStatus.RESOLVED
        assert self.group.substatus is None

        assert Activity.objects.filter(
            group=self.group, type=ActivityType.SET_RESOLVED.value
        ).exists()
        assert GroupHistory.objects.filter(
            group=self.group, status=GroupHistoryStatus.RESOLVED
        ).exists()

    def test_with_status_change_archived(self) -> None:
        for substatus in [
            GroupSubStatus.UNTIL_ESCALATING,
            GroupSubStatus.UNTIL_CONDITION_MET,
            GroupSubStatus.FOREVER,
        ]:
            status_change = StatusChangeMessage(
                fingerprint=self.fingerprint,
                project_id=self.group.project_id,
                new_status=GroupStatus.IGNORED,
                new_substatus=substatus,
            )
            produce_occurrence_to_kafka(
                payload_type=PayloadType.STATUS_CHANGE,
                status_change=status_change,
            )
            self.group.refresh_from_db()
            assert self.group.status == GroupStatus.IGNORED
            assert self.group.substatus == substatus

            assert Activity.objects.filter(
                group=self.group, type=ActivityType.SET_IGNORED.value
            ).exists()

            gh_status = GROUP_SUBSTATUS_TO_GROUP_HISTORY_STATUS[substatus]
            assert GroupHistory.objects.filter(
                group=self.group,
                status=STRING_TO_STATUS_LOOKUP[gh_status],
            ).exists()

    def test_with_status_change_unresolved(self) -> None:
        # We modify a single group through different substatuses that are supported in the UI
        # to ensure the status change is processed correctly.
        self.group.update(status=GroupStatus.IGNORED, substatus=GroupSubStatus.UNTIL_ESCALATING)
        for substatus, activity_type in [
            (GroupSubStatus.ESCALATING, ActivityType.SET_ESCALATING),
            (GroupSubStatus.ONGOING, ActivityType.AUTO_SET_ONGOING),
            (GroupSubStatus.REGRESSED, ActivityType.SET_REGRESSION),
            (GroupSubStatus.ONGOING, ActivityType.SET_UNRESOLVED),
        ]:
            # Produce the status change message and process it
            status_change = StatusChangeMessage(
                fingerprint=self.fingerprint,
                project_id=self.group.project_id,
                new_status=GroupStatus.UNRESOLVED,
                new_substatus=substatus,
            )
            produce_occurrence_to_kafka(
                payload_type=PayloadType.STATUS_CHANGE,
                status_change=status_change,
            )
            self.group.refresh_from_db()
            assert self.group.status == GroupStatus.UNRESOLVED
            assert self.group.substatus == substatus

            assert Activity.objects.filter(group=self.group, type=activity_type.value).exists()

            gh_status = GROUP_SUBSTATUS_TO_GROUP_HISTORY_STATUS[substatus]
            assert GroupHistory.objects.filter(
                group=self.group,
                status=STRING_TO_STATUS_LOOKUP[gh_status],
            ).exists()

    @patch("sentry.issues.status_change_consumer.logger.error")
    def test_with_invalid_status_change(self, mock_logger_error: MagicMock) -> None:
        for status, substatus, error_msg in [
            (
                GroupStatus.RESOLVED,
                GroupSubStatus.FOREVER,
                "group.update_status.unexpected_substatus",
            ),
            (GroupStatus.IGNORED, None, "group.update_status.missing_substatus"),
            (
                GroupStatus.IGNORED,
                GroupSubStatus.REGRESSED,
                "group.update_status.invalid_substatus",
            ),
            (GroupStatus.UNRESOLVED, GroupSubStatus.NEW, "group.update_status.invalid_substatus"),
        ]:
            bad_status_change = StatusChangeMessage(
                fingerprint=self.fingerprint,
                project_id=self.group.project_id,
                new_status=status,
                new_substatus=substatus,
            )
            produce_occurrence_to_kafka(
                payload_type=PayloadType.STATUS_CHANGE,
                status_change=bad_status_change,
            )
            processed_fingerprint = {"fingerprint": ["group-1"]}
            process_occurrence_data(processed_fingerprint)

            self.group.refresh_from_db()
            mock_logger_error.assert_called_with(
                error_msg,
                extra={
                    "project_id": self.group.project_id,
                    "fingerprint": processed_fingerprint["fingerprint"],
                    "new_status": status,
                    "new_substatus": substatus,
                },
            )
            assert self.group.status == self.initial_status
            assert self.group.substatus == self.initial_substatus

    @patch("sentry.issues.status_change_consumer.metrics.incr")
    def test_invalid_hashes(self, mock_metrics_incr: MagicMock) -> None:
        event = self.store_event(
            data={
                "event_id": "a" * 32,
                "message": "oh no",
                "timestamp": datetime.now().isoformat(),
                "fingerprint": ["group-2"],
            },
            project_id=self.project.id,
        )
        group = event.group
        assert group
        initial_status = group.status
        initial_substatus = group.substatus
        wrong_fingerprint = {"fingerprint": ["wronghash"]}
        process_occurrence_data(wrong_fingerprint)

        bad_status_change_resolve = StatusChangeMessage(
            fingerprint=["wronghash"],
            project_id=group.project_id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=GroupSubStatus.FOREVER,
        )
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=bad_status_change_resolve,
        )
        group.refresh_from_db()
        mock_metrics_incr.assert_any_call("occurrence_ingest.grouphash.not_found")
        assert group.status == initial_status
        assert group.substatus == initial_substatus

    def test_generate_status_changes_id(self) -> None:
        status_change_1 = StatusChangeMessage(
            fingerprint=["status-change-1"],
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=GroupSubStatus.FOREVER,
        )
        status_change_2 = StatusChangeMessage(
            fingerprint=["status-change-2"],
            project_id=self.project.id,
            new_status=GroupStatus.RESOLVED,
            new_substatus=GroupSubStatus.FOREVER,
        )
        assert status_change_1.id
        assert status_change_1.id != status_change_2.id

    @patch(
        "sentry.issues.producer._prepare_status_change_message", return_value={"mock_data": "great"}
    )
    @patch("sentry.issues.producer._occurrence_producer.produce")
    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_payload_sent_to_kafka_with_partition_key(
        self, mock_produce: MagicMock, mock_prepare_status_change_message: MagicMock
    ) -> None:
        status_change = StatusChangeMessage(
            project_id=self.project.id,
            fingerprint=["group-1"],
            new_status=GroupStatus.RESOLVED,
            new_substatus=GroupSubStatus.FOREVER,
        )
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=status_change,
            event_data={},
        )
        mock_produce.assert_called_once_with(
            ArroyoTopic(name="ingest-occurrences"),
            KafkaPayload(
                f"{status_change.fingerprint[0]}-{status_change.project_id}".encode(),
                json.dumps({"mock_data": "great"}).encode("utf-8"),
                [],
            ),
        )

    @patch(
        "sentry.issues.producer._prepare_status_change_message", return_value={"mock_data": "great"}
    )
    @patch("sentry.issues.producer._occurrence_producer.produce")
    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_payload_sent_to_kafka_with_partition_key_no_fingerprint(
        self, mock_produce: MagicMock, mock_prepare_status_change_message: MagicMock
    ) -> None:
        status_change = StatusChangeMessage(
            project_id=self.project.id,
            fingerprint=[],
            new_status=GroupStatus.RESOLVED,
            new_substatus=GroupSubStatus.FOREVER,
        )
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=status_change,
            event_data={},
        )
        mock_produce.assert_called_once_with(
            ArroyoTopic(name="ingest-occurrences"),
            KafkaPayload(
                None,
                json.dumps({"mock_data": "great"}).encode("utf-8"),
                [],
            ),
        )

    @patch(
        "sentry.issues.producer._prepare_status_change_message", return_value={"mock_data": "great"}
    )
    @patch("sentry.issues.producer._occurrence_producer.produce")
    @override_settings(SENTRY_EVENTSTREAM="sentry.eventstream.kafka.KafkaEventStream")
    def test_payload_sent_to_kafka_with_partition_key_no_status_change(
        self, mock_produce: MagicMock, mock_prepare_status_change_message: MagicMock
    ) -> None:
        produce_occurrence_to_kafka(
            payload_type=PayloadType.STATUS_CHANGE,
            status_change=None,
            event_data={},
        )
        mock_produce.assert_called_once_with(
            ArroyoTopic(name="ingest-occurrences"),
            KafkaPayload(
                None,
                json.dumps({"mock_data": "great"}).encode("utf-8"),
                [],
            ),
        )
