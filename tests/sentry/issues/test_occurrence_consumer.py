import datetime
import logging
from typing import Any, Dict

import pytest

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.occurrence_consumer import _process_message

# from sentry.models import Group
from sentry.testutils import TestCase
from sentry.types.issues import GroupType
from tests.sentry.issues.test_utils import OccurrenceTestMixin

logger = logging.getLogger(__name__)


def get_test_message(
    project_id: str, include_event: bool = True, **overrides: Any
) -> Dict[str, Any]:
    now = datetime.datetime.now()
    payload = {
        "id": "{}".format(now.strftime("000000000000%Y%m%d%H%M%S%f")),
        "event_id": None,
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
            "project_id": project_id,
            "title": "code's broken",
            "platform": "genesis",
            "tags": {},
            "timestamp": now.isoformat(),
            "message_timestamp": now.isoformat(),
        }

    payload.update(overrides)
    return payload


class IssueOccurrenceTestMessage(OccurrenceTestMixin, TestCase):  # type: ignore
    @pytest.mark.django_db
    def test_occurrence_consumer_with_event(self) -> None:
        message = get_test_message(self.project.id)
        occurrence = _process_message(message)
        assert occurrence is not None

        fetched_occurrence = IssueOccurrence.fetch(occurrence.id, self.project.id)
        assert fetched_occurrence is not None
        self.assert_occurrences_identical(occurrence, fetched_occurrence)
        # TODO uncomment this when save_issue_from_occurrence() is merged
        # assert Group.objects.filter(grouphash__hash=occurrence.fingerprint[0]).exists()

    def test_invalid_event_payload(self) -> None:
        message = get_test_message(self.project.id, event={"title": "no project id"})
        occurrence = _process_message(message)
        assert occurrence is None

    def test_invalid_occurrence_payload(self) -> None:
        message = get_test_message(self.project.id, type=300)
        occurrence = _process_message(message)
        assert occurrence is None
