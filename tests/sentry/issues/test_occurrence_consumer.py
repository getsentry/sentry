import datetime
import logging
import uuid
from typing import Any, Dict

import pytest

from sentry.eventstore.snuba.backend import SnubaEventStorage
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_consumer import _process_message
from sentry.models import Group
from sentry.testutils import SnubaTestCase, TestCase
from sentry.types.issues import GroupType
from tests.sentry.issues.test_utils import OccurrenceTestMixin

logger = logging.getLogger(__name__)


def get_test_message(
    project_id: int, include_event: bool = True, **overrides: Any
) -> Dict[str, Any]:
    now = datetime.datetime.now()
    payload = {
        "id": uuid.uuid4().hex,
        "fingerprint": ["touch-id"],
        "issue_title": "segfault",
        "subtitle": "buffer overflow",
        "resource_id": "12345",
        "evidence_data": {"Line": 40},
        "evidence_display": [
            {"name": "Line", "value": "40", "important": True},
            {"name": "Memory", "value": "breached", "important": False},
        ],
        "type": GroupType.PROFILE_BLOCKED_THREAD,
        "detection_time": now.isoformat(),
    }

    if include_event:
        payload["event"] = {
            "event_id": uuid.uuid4().hex,
            "project_id": project_id,
            "title": "code's broken",
            "platform": "genesis",
            "tags": {},
            "timestamp": now.isoformat(),
            "message_timestamp": now.isoformat(),
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

    def test_invalid_event_payload(self) -> None:
        message = get_test_message(self.project.id, event={"title": "no project id"})
        occurrence = _process_message(message)
        assert occurrence is None

    def test_invalid_occurrence_payload(self) -> None:
        message = get_test_message(self.project.id, type=300)
        occurrence = _process_message(message)
        assert occurrence is None
