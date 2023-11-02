import datetime
import logging
import uuid
from copy import deepcopy
from datetime import timezone
from typing import Any, Dict, Optional, Sequence, Type
from unittest import mock

import pytest
from jsonschema import ValidationError

from sentry import eventstore
from sentry.eventstore.snuba.backend import SnubaEventStorage
from sentry.issues.grouptype import PerformanceSlowDBQueryGroupType, ProfileFileIOGroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_consumer import (
    EventLookupError,
    InvalidEventPayloadError,
    _get_kwargs,
    _process_message,
)
from sentry.models.group import Group
from sentry.receivers import create_default_projects
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin

logger = logging.getLogger(__name__)


def get_test_message(
    project_id: int, include_event: bool = True, **overrides: Any
) -> Dict[str, Any]:
    now = datetime.datetime.now()
    event_id = uuid.uuid4().hex
    payload = {
        "id": uuid.uuid4().hex,
        "event_id": event_id,
        "project_id": project_id,
        "fingerprint": ["touch-id"],
        "issue_title": "segfault",
        "subtitle": "buffer overflow",
        "resource_id": "12345",
        "evidence_data": {"Line": 40},
        "evidence_display": [
            {"name": "Line", "value": "40", "important": True},
            {"name": "Memory", "value": "breached", "important": False},
        ],
        "type": ProfileFileIOGroupType.type_id,
        "detection_time": now.isoformat(),
        "payload_type": "occurrence",
    }

    if include_event:
        payload["event"] = {
            "event_id": event_id,
            "project_id": project_id,
            "platform": "genesis",
            "stacktrace": {
                "frames": [
                    {"function": "0x0", "in_app": False},
                    {"function": "start_sim", "in_app": False},
                ],
            },
            "tags": {},
            "timestamp": now.isoformat(),
            "received": now.isoformat(),
        }

    payload.update(overrides)
    return payload


class IssueOccurrenceTestBase(OccurrenceTestMixin, TestCase, SnubaTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.eventstore = SnubaEventStorage()


class IssueOccurrenceProcessMessageTest(IssueOccurrenceTestBase):
    @django_db_all
    def test_occurrence_consumer_with_event(self) -> None:
        message = get_test_message(self.project.id)
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(message)
        assert result is not None
        occurrence = result[0]

        fetched_occurrence = IssueOccurrence.fetch(occurrence.id, self.project.id)
        assert fetched_occurrence is not None
        self.assert_occurrences_identical(occurrence, fetched_occurrence)
        assert fetched_occurrence.event_id is not None
        fetched_event = self.eventstore.get_event_by_id(
            self.project.id, fetched_occurrence.event_id
        )
        assert fetched_event is not None
        assert fetched_event.get_event_type() == "generic"

        assert Group.objects.filter(grouphash__hash=occurrence.fingerprint[0]).exists()

    @django_db_all
    def test_process_profiling_occurrence(self) -> None:
        create_default_projects()
        event_data = load_data("generic-event-profiling")
        event_data["detection_time"] = datetime.datetime.now(tz=timezone.utc)
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(event_data)
        assert result is not None
        project_id = event_data["event"]["project_id"]
        occurrence = result[0]

        event = eventstore.backend.get_event_by_id(project_id, event_data["event"]["event_id"])
        event = event.for_group(event.group)
        assert event.occurrence_id == occurrence.id

        fetched_occurrence = IssueOccurrence.fetch(occurrence.id, project_id)
        assert fetched_occurrence is not None
        self.assert_occurrences_identical(occurrence, fetched_occurrence)
        assert fetched_occurrence.event_id is not None
        fetched_event = self.eventstore.get_event_by_id(project_id, fetched_occurrence.event_id)
        assert fetched_event is not None
        assert fetched_event.get_event_type() == "generic"

        assert Group.objects.filter(grouphash__hash=occurrence.fingerprint[0]).exists()

    def test_invalid_event_payload(self) -> None:
        message = get_test_message(self.project.id, event={"title": "no project id"})
        with pytest.raises(InvalidEventPayloadError):
            with self.feature("organizations:profile-file-io-main-thread-ingest"):
                _process_message(message)

    def test_invalid_occurrence_payload(self) -> None:
        message = get_test_message(self.project.id, type=300)
        with pytest.raises(InvalidEventPayloadError):
            with self.feature("organizations:profile-file-io-main-thread-ingest"):
                _process_message(message)

    def test_mismatch_event_ids(self) -> None:
        message = deepcopy(get_test_message(self.project.id))
        message["event_id"] = "id1"
        message["event"]["event_id"] = "id2"
        with pytest.raises(InvalidEventPayloadError):
            with self.feature("organizations:profile-file-io-main-thread-ingest"):
                _process_message(message)

    @django_db_all
    def test_occurrence_consumer_without_payload_type(self) -> None:
        message = get_test_message(self.project.id)
        message.pop("payload_type")
        with self.feature("organizations:profile-file-io-main-thread-ingest"):
            result = _process_message(message)
        assert result is not None
        occurrence = result[0]

        fetched_occurrence = IssueOccurrence.fetch(occurrence.id, self.project.id)
        assert fetched_occurrence is not None
        self.assert_occurrences_identical(occurrence, fetched_occurrence)
        assert fetched_occurrence.event_id is not None
        fetched_event = self.eventstore.get_event_by_id(
            self.project.id, fetched_occurrence.event_id
        )
        assert fetched_event is not None
        assert fetched_event.get_event_type() == "generic"

        assert Group.objects.filter(grouphash__hash=occurrence.fingerprint[0]).exists()


class IssueOccurrenceLookupEventIdTest(IssueOccurrenceTestBase):
    def test_lookup_event_doesnt_exist(self) -> None:
        message = get_test_message(self.project.id, include_event=False)
        with pytest.raises(EventLookupError):
            with self.feature("organizations:profile-file-io-main-thread-ingest"):
                _process_message(message)

    @django_db_all
    def test_transaction_lookup(self) -> None:
        from sentry.event_manager import EventManager

        event_data = load_data("transaction")
        event_data["timestamp"] = iso_format(before_now(minutes=1))
        event_data["start_timestamp"] = iso_format(before_now(minutes=1, seconds=1))
        event_data["event_id"] = "d" * 32

        manager = EventManager(data=event_data)
        manager.normalize()
        event1 = manager.save(self.project.id)
        assert event1.get_event_type() == "transaction"

        message = get_test_message(
            self.project.id,
            include_event=False,
            event_id=event1.event_id,
            type=PerformanceSlowDBQueryGroupType.type_id,
        )
        with self.feature("organizations:performance-slow-db-query-ingest"):
            processed = _process_message(message)
        assert processed is not None
        occurrence, _ = processed[0], processed[1]

        fetched_event = self.eventstore.get_event_by_id(self.project.id, occurrence.event_id)
        assert fetched_event is not None
        assert fetched_event.get_event_type() == "transaction"


class ParseEventPayloadTest(IssueOccurrenceTestBase):
    def run_test(self, message: Dict[str, Any]) -> None:
        _get_kwargs(message)

    def run_invalid_schema_test(
        self, message: Dict[str, Any], expected_error: Type[Exception]
    ) -> None:
        with pytest.raises(expected_error):
            self.run_test(message)

    def run_invalid_payload_test(
        self,
        remove_event_fields: Optional[Sequence[str]] = None,
        update_event_fields: Optional[Dict[str, Any]] = None,
        expected_error: Type[Exception] = InvalidEventPayloadError,
    ) -> None:
        message = deepcopy(get_test_message(self.project.id))
        if remove_event_fields:
            for field in remove_event_fields:
                message["event"].pop(field)
        if update_event_fields:
            message["event"].update(update_event_fields)
        self.run_invalid_schema_test(message, expected_error)

    def test_invalid_payload(self) -> None:
        self.run_invalid_payload_test(
            remove_event_fields=["project_id"], expected_error=InvalidEventPayloadError
        )
        self.run_invalid_payload_test(
            remove_event_fields=["timestamp"], expected_error=ValidationError
        )
        self.run_invalid_payload_test(
            remove_event_fields=["platform"], expected_error=ValidationError
        )

        self.run_invalid_payload_test(
            update_event_fields={"project_id": "p_id"}, expected_error=InvalidEventPayloadError
        )

        self.run_invalid_payload_test(
            update_event_fields={"platform": 0000}, expected_error=ValidationError
        )
        self.run_invalid_payload_test(
            update_event_fields={"tags": "tagged"}, expected_error=ValidationError
        )

    def test_valid(self) -> None:
        self.run_test(get_test_message(self.project.id))

    def test_numeric_timestamp_valid_with_new_schema(self) -> None:
        # per https://develop.sentry.dev/sdk/event-payloads/ timestamp can be numeric

        message = deepcopy(get_test_message(self.project.id))
        message["event"]["timestamp"] = 0000
        self.run_test(message)

    def test_frame_additional_fields_valid_with_new_schema(self) -> None:
        message = deepcopy(get_test_message(self.project.id))
        message["event"]["stacktrace"]["frames"][0]["data"] = {"foo": "bar"}
        self.run_test(message)

    def test_tags_not_required_with_new_schema(self) -> None:
        # per https://develop.sentry.dev/sdk/event-payloads/ tags are optional
        message = deepcopy(get_test_message(self.project.id))
        message["event"].pop("tags")
        self.run_test(message)

    def test_valid_nan(self) -> None:
        # NaN is invalid in new event schema, but valid in legacy schema, so it emits only one of the metrics
        message = deepcopy(get_test_message(self.project.id))
        message["event"]["tags"]["nan-tag"] = float("nan")
        with mock.patch("sentry.issues.occurrence_consumer.metrics") as metrics:
            self.run_test(message)
            metrics.incr.assert_called_once_with(
                "occurrence_ingest.event_payload_invalid",
                sample_rate=mock.ANY,
                tags={"occurrence_type": mock.ANY},
            )

    def test_valid_nan_exception_log(self) -> None:
        # NaN is invalid in new event schema, but valid in legacy schema, so it emits logging, but doesn't raise
        message = deepcopy(get_test_message(self.project.id))
        message["event"]["tags"]["nan-tag"] = float("nan")
        with self.assertLogs("sentry.issues.occurrence_consumer", logging.ERROR) as cm:
            self.run_test(message)

        assert (
            "Error validating event payload, falling back to legacy validation" in cm.records[0].msg
        )
        assert cm.records[0].exc_info is not None

    def test_invalid_payload_emits_both_metrics(self) -> None:
        with mock.patch("sentry.issues.occurrence_consumer.metrics") as metrics:
            self.run_invalid_payload_test(
                remove_event_fields=["timestamp"], expected_error=ValidationError
            )
            metrics.incr.assert_has_calls(
                [
                    mock.call(
                        "occurrence_ingest.event_payload_invalid",
                        sample_rate=mock.ANY,
                        tags={"occurrence_type": mock.ANY},
                    ),
                    mock.call(
                        "occurrence_ingest.legacy_event_payload_invalid",
                        sample_rate=mock.ANY,
                        tags={"occurrence_type": mock.ANY},
                    ),
                ]
            )

    def test_missing_event_id_and_event_data(self) -> None:
        message = deepcopy(get_test_message(self.project.id))
        message.pop("event_id", None)
        message.pop("event", None)
        with pytest.raises(InvalidEventPayloadError):
            _get_kwargs(message)

    def test_event_id_mismatch(self) -> None:
        """
        if they're mismatched, we move forward and validate further down the line
        """
        message = deepcopy(get_test_message(self.project.id))
        message["event_id"] = uuid.uuid4().hex
        message["event"]["event_id"] = uuid.uuid4().hex
        kwargs = _get_kwargs(message)
        assert kwargs["occurrence_data"]["event_id"] == message["event_id"]
        assert kwargs["event_data"]["event_id"] == message["event"]["event_id"]

    def test_missing_top_level_event_id(self) -> None:
        message = deepcopy(get_test_message(self.project.id))
        event_id = uuid.uuid4().hex
        message.pop("event_id", None)
        message["event"]["event_id"] = event_id
        kwargs = _get_kwargs(message)
        assert kwargs is not None
        assert kwargs["occurrence_data"]["event_id"] == kwargs["event_data"]["event_id"] == event_id

    def test_missing_event_id_in_event_data(self) -> None:
        message = deepcopy(get_test_message(self.project.id))
        message["event_id"] = "id1"
        message["event"].pop("event_id", None)
        with pytest.raises(InvalidEventPayloadError):
            _get_kwargs(message)

    def test_project_ids_mismatch(self) -> None:
        message = deepcopy(get_test_message(self.project.id))
        message["project_id"] = 1
        message["event"]["project_id"] = 2
        with pytest.raises(InvalidEventPayloadError):
            _get_kwargs(message)

    def test_uuid_coercion(self) -> None:
        event_id = "0c6d75ac-3969-41e0-bc4b-33c2ff7f3657"
        occurrence_id = "b6e6e7d9-e582-40fd-8101-5666e96eb038"
        message = deepcopy(get_test_message(self.project.id, id=occurrence_id, event_id=event_id))
        message["event"]["event_id"] = event_id
        kwargs = _get_kwargs(message)
        assert kwargs["occurrence_data"]["id"] == occurrence_id.replace("-", "")
        assert kwargs["occurrence_data"]["event_id"] == event_id.replace("-", "")
        assert kwargs["event_data"]["event_id"] == event_id.replace("-", "")

    def test_invalid_uuid(self) -> None:
        with pytest.raises(InvalidEventPayloadError):
            _get_kwargs(deepcopy(get_test_message(self.project.id, id="hi")))
        with pytest.raises(InvalidEventPayloadError):
            _get_kwargs(deepcopy(get_test_message(self.project.id, event_id="hi")))
        with pytest.raises(InvalidEventPayloadError):
            message = deepcopy(get_test_message(self.project.id))
            message["event"]["event_id"] = "hi"
            _get_kwargs(message)

    def test_occurrence_title_on_event(self) -> None:
        message = deepcopy(get_test_message(self.project.id))
        kwargs = _get_kwargs(message)
        assert kwargs["occurrence_data"]["issue_title"] == kwargs["event_data"]["metadata"]["title"]

    def test_occurrence_level_on_event(self) -> None:
        message = deepcopy(get_test_message(self.project.id))
        kwargs = _get_kwargs(message)
        assert kwargs["occurrence_data"]["level"] == kwargs["event_data"]["level"]

    def test_debug_meta(self) -> None:
        debug_meta_cases = [
            {"debug_meta": {}},
            {"debug_meta": None},
            {"debug_meta": {"images": []}},
            {"debug_meta": {"images": None}},
            {"debug_meta": {"images": [{}]}},
        ]

        for case in debug_meta_cases:
            message = deepcopy(get_test_message(self.project.id, True))
            message["event"].update(**case)
            _get_kwargs(message)

    def test_culprit(self) -> None:
        message = deepcopy(get_test_message(self.project.id))
        message["culprit"] = "i did it"
        kwargs = _get_kwargs(message)
        assert kwargs["occurrence_data"]["culprit"] == "i did it"
