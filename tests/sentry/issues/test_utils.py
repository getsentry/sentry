import uuid
from datetime import datetime
from typing import Any

from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence, IssueOccurrenceData
from sentry.types.issues import GroupType


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

    def build_occurrence_data(self, **overrides: Any) -> IssueOccurrenceData:
        kwargs: IssueOccurrenceData = {
            "id": uuid.uuid4().hex,
            "event_id": uuid.uuid4().hex,
            "fingerprint": ["some-fingerprint"],
            "issue_title": "something bad happened",
            "subtitle": "it was bad",
            "resource_id": "1234",
            "evidence_data": {"Test": 123},
            "evidence_display": [
                {"name": "hi", "value": "bye", "important": True},
                {"name": "what", "value": "where", "important": False},
            ],
            "type": GroupType.PROFILE_BLOCKED_THREAD,
            "detection_time": datetime.now().timestamp(),
            "level": "warning",
        }
        kwargs.update(overrides)  # type: ignore
        return kwargs

    def build_occurrence(self, **overrides: Any) -> IssueOccurrence:
        if "evidence_display" in overrides:
            evidence_display = overrides["evidence_display"]
            overrides["evidence_display"] = [
                item.to_dict() if isinstance(item, IssueEvidence) else item
                for item in evidence_display
            ]

        return IssueOccurrence.from_dict(self.build_occurrence_data(**overrides))
