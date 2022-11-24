import uuid
from datetime import datetime

from sentry.issues.issue_occurrence import IssueEvidence, IssueOccurrence
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from sentry.types.issues import GroupType


@region_silo_test
class IssueOccurenceTest(TestCase):  # type: ignore
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

    def test_to_dict_from_dict(self) -> None:
        occurrence = IssueOccurrence(
            uuid.uuid4().hex,
            uuid.uuid4().hex,
            ["some-fingerprint"],
            "something bad happened",
            "it was bad",
            "1234",
            {"Test": 123},
            [IssueEvidence("hi", "bye", True), IssueEvidence("what", "where", False)],
            GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
            datetime.now(),
        )
        self.assert_occurrences_identical(
            occurrence, IssueOccurrence.from_dict(occurrence.to_dict())
        )

    def test_save_and_fetch(self) -> None:
        occurrence = IssueOccurrence(
            uuid.uuid4().hex,
            uuid.uuid4().hex,
            ["some-fingerprint"],
            "something bad happened",
            "it was bad",
            "1234",
            {"Test": 123},
            [IssueEvidence("hi", "bye", True), IssueEvidence("what", "where", False)],
            GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
            datetime.now(),
        )
        occurrence.save()
        fetched_occurrence = IssueOccurrence.fetch(occurrence.id)
        assert fetched_occurrence is not None
        self.assert_occurrences_identical(occurrence, fetched_occurrence)
