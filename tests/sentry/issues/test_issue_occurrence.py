import uuid
from datetime import datetime
from typing import Any

from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType
from sentry.utils.dates import ensure_aware


class BaseIssueOccurrenceTest:
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


@region_silo_test
class IssueOccurenceSerializeTest(BaseIssueOccurrenceTest, TestCase):  # type: ignore
    def test(self) -> None:
        occurrence = self.build_occurrence()
        self.assert_occurrences_identical(
            occurrence, IssueOccurrence.from_dict(occurrence.to_dict())
        )


@region_silo_test
class IssueOccurenceSaveAndFetchTest(BaseIssueOccurrenceTest, TestCase):  # type: ignore
    def test(self) -> None:
        occurrence = self.build_occurrence()
        occurrence.save()
        fetched_occurrence = IssueOccurrence.fetch(occurrence.id)
        assert fetched_occurrence is not None
        self.assert_occurrences_identical(occurrence, fetched_occurrence)


@region_silo_test
class IssueOccurrenceEvidenceDisplayPrimaryTest(BaseIssueOccurrenceTest, TestCase):  # type: ignore
    def test(self) -> None:
        important_evidence = IssueEvidence("Hello", "Hi", True)
        occurrence = self.build_occurrence(evidence_display=[important_evidence])
        assert occurrence.important_evidence_display == important_evidence

    def test_multiple_evidence_one_important(self) -> None:
        important_evidence = IssueEvidence("Hello", "Hi", True)
        occurrence = self.build_occurrence(
            evidence_display=[IssueEvidence("Evidence", "evidence", False), important_evidence]
        )
        assert occurrence.important_evidence_display == important_evidence

    def test_multiple_evidence_multiple_important(self) -> None:
        important_evidence = IssueEvidence("Hello", "Hi", True)
        occurrence = self.build_occurrence(
            evidence_display=[important_evidence, IssueEvidence("Evidence", "evidence", True)]
        )
        assert occurrence.important_evidence_display == important_evidence

    def test_multiple_evidence_no_important(self) -> None:
        occurrence = self.build_occurrence(
            evidence_display=[
                IssueEvidence("Hello", "Hi", False),
                IssueEvidence("Evidence", "evidence", False),
            ]
        )
        assert occurrence.important_evidence_display is None

    def test_none(self) -> None:
        occurrence = self.build_occurrence(evidence_display=[])
        assert occurrence.important_evidence_display is None
