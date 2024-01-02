from sentry.issues.issue_occurrence import DEFAULT_LEVEL, IssueEvidence, IssueOccurrence
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import region_silo_test
from tests.sentry.issues.test_utils import OccurrenceTestMixin


@region_silo_test
class IssueOccurrenceSerializeTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        occurrence = self.build_occurrence()
        self.assert_occurrences_identical(
            occurrence, IssueOccurrence.from_dict(occurrence.to_dict())
        )

    def test_level_default(self) -> None:
        occurrence_data = self.build_occurrence_data()
        occurrence_data["level"] = None
        occurrence = IssueOccurrence.from_dict(occurrence_data)
        assert occurrence.level == DEFAULT_LEVEL


@region_silo_test
class IssueOccurrenceSaveAndFetchTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        occurrence = self.build_occurrence()
        occurrence.save()
        fetched_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert fetched_occurrence is not None
        self.assert_occurrences_identical(occurrence, fetched_occurrence)


@region_silo_test
class IssueOccurrenceEvidenceDisplayPrimaryTest(OccurrenceTestMixin, TestCase):
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
