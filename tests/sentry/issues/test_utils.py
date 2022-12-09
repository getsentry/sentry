import uuid
from datetime import datetime
from typing import Any

from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.types.issues import GroupType
from sentry.utils.dates import ensure_aware


class OccurrenceTestMixin:
    def assert_occurrences_identical(self, o1: IssueOccurrence, o2: IssueOccurrence) -> None:
        assert o1.id == o2.id
        assert o1.event_id == o2.event_id
        assert o1.fingerprint == o2.fingerprint
        assert o1.issue_title == o2.issue_title
        assert o1.subtitle == o2.subtitle
        assert o1.resource_id == o2.resource_id
        assert o1.evidence_data == o2.evidence_data
        assert o1.evidence_display == o2.evidence_display
        assert o1.type == o2.type
        assert o1.detection_time == o2.detection_time

    def build_occurrence(self, **overrides: Any) -> IssueOccurrence:
        kwargs = {
            "id": uuid.uuid4().hex,
            "event_id": uuid.uuid4().hex,
            "fingerprint": ["some-fingerprint"],
            "issue_title": "something bad happened",
            "subtitle": "it was bad",
            "resource_id": "1234",
            "evidence_data": {"Test": 123},
            "evidence_display": [
                IssueEvidence("hi", "bye", True),
                IssueEvidence("what", "where", False),
            ],
            "type": GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
            "detection_time": ensure_aware(datetime.now()),
        }
        kwargs.update(overrides)
        return IssueOccurrence(**kwargs)
