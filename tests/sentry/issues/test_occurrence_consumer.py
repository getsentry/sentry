import datetime
import logging
import uuid
from copy import deepcopy
from typing import Any, Dict, Optional, Sequence

import pytest

from sentry.eventstore.snuba.backend import SnubaEventStorage
from sentry.grouptype.grouptype import ProfileBlockedThreadGroupType
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_consumer import (
    InvalidEventPayloadError,
    _get_kwargs,
    _process_message,
)
from sentry.models import Group
from sentry.testutils import SnubaTestCase, TestCase
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin

logger = logging.getLogger(__name__)


def get_test_message(
    project_id: int, include_event: bool = True, **overrides: Any
) -> Dict[str, Any]:
    now = datetime.datetime.now()
    payload = {
        "id": uuid.uuid4().hex,
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
        "type": ProfileBlockedThreadGroupType.type_id,
        "detection_time": now.isoformat(),
    }

    if include_event:
        payload["event"] = {
            "event_id": uuid.uuid4().hex,
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


class IssueOccurrenceTestMessage(OccurrenceTestMixin, TestCase, SnubaTestCase):  # type: ignore
    def setUp(self) -> None:
        super().setUp()
        self.eventstore = SnubaEventStorage()

    @pytest.mark.django_db
    def test_occurrence_consumer_with_event(self) -> None:
        message = get_test_message(self.project.id)
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

    @pytest.mark.django_db
    def test_process_profiling_event(self) -> None:
        event_data = load_data("generic-event-profiling")
        result = _process_message(event_data)
        assert result is not None
        project_id = event_data["event"]["project_id"]
        occurrence = result[0]

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
        occurrence = _process_message(message)
        assert occurrence is None

    def test_invalid_occurrence_payload(self) -> None:
        message = get_test_message(self.project.id, type=300)
        occurrence = _process_message(message)
        assert occurrence is None


class ParseEventPayloadTest(IssueOccurrenceTestMessage):
    def run_test(self, message: Dict[str, Any]) -> None:
        _get_kwargs(message)

    def run_invalid_schema_test(self, message: Dict[str, Any]) -> None:
        with pytest.raises(InvalidEventPayloadError):
            self.run_test(message)

    def run_invalid_payload_test(
        self,
        remove_event_fields: Optional[Sequence[str]] = None,
        update_event_fields: Optional[Dict[str, Any]] = None,
    ) -> None:
        message = deepcopy(get_test_message(self.project.id))
        if remove_event_fields:
            for field in remove_event_fields:
                message["event"].pop(field)
        if update_event_fields:
            message["event"].update(update_event_fields)
        self.run_invalid_schema_test(message)

    def test_invalid_payload(self) -> None:
        self.run_invalid_payload_test(remove_event_fields=["event_id"])
        self.run_invalid_payload_test(remove_event_fields=["project_id"])
        self.run_invalid_payload_test(remove_event_fields=["timestamp"])
        self.run_invalid_payload_test(remove_event_fields=["platform"])
        self.run_invalid_payload_test(remove_event_fields=["tags"])
        self.run_invalid_payload_test(update_event_fields={"event_id": 0000})
        self.run_invalid_payload_test(update_event_fields={"project_id": "p_id"})
        self.run_invalid_payload_test(update_event_fields={"timestamp": 0000})
        self.run_invalid_payload_test(update_event_fields={"platform": 0000})
        self.run_invalid_payload_test(update_event_fields={"tags": "tagged"})

    def test_valid(self) -> None:
        self.run_test(get_test_message(self.project.id))

    def test_valid_nan(self) -> None:
        message = deepcopy(get_test_message(self.project.id))
        message["event"]["tags"]["nan-tag"] = float("nan")
        self.run_test(message)

    def test_project_ids_mismatch(self) -> None:
        message = deepcopy(get_test_message(self.project.id))
        message["project_id"] = 1
        message["event"]["project_id"] = 2
        with pytest.raises(InvalidEventPayloadError):
            _get_kwargs(message)
