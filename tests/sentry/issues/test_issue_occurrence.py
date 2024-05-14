from sentry.issues.issue_occurrence import DEFAULT_LEVEL, IssueEvidence, IssueOccurrence
from sentry.testutils.cases import TestCase
from sentry.types.actor import Actor, ActorType
from tests.sentry.issues.test_utils import OccurrenceTestMixin


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

    def test_assignee(self) -> None:
        occurrence_data = self.build_occurrence_data()
        occurrence_data["assignee"] = f"user:{self.user.id}"
        occurrence = IssueOccurrence.from_dict(occurrence_data)
        assert occurrence.assignee == Actor(id=self.user.id, actor_type=ActorType.USER)
        occurrence_data["assignee"] = f"{self.user.id}"
        occurrence = IssueOccurrence.from_dict(occurrence_data)
        assert occurrence.assignee == Actor(id=self.user.id, actor_type=ActorType.USER)
        occurrence_data["assignee"] = f"{self.user.email}"
        occurrence = IssueOccurrence.from_dict(occurrence_data)
        assert occurrence.assignee == Actor(id=self.user.id, actor_type=ActorType.USER)
        occurrence_data["assignee"] = f"{self.user.username}"
        occurrence = IssueOccurrence.from_dict(occurrence_data)
        assert occurrence.assignee == Actor(id=self.user.id, actor_type=ActorType.USER)
        occurrence_data["assignee"] = f"team:{self.team.id}"
        occurrence = IssueOccurrence.from_dict(occurrence_data)
        assert occurrence.assignee == Actor(id=self.team.id, actor_type=ActorType.TEAM)

    def test_assignee_none(self) -> None:
        occurrence_data = self.build_occurrence_data()
        occurrence = IssueOccurrence.from_dict(occurrence_data)
        assert occurrence.assignee is None
        occurrence_data["assignee"] = None
        occurrence = IssueOccurrence.from_dict(occurrence_data)
        assert occurrence.assignee is None
        occurrence_data["assignee"] = ""
        occurrence = IssueOccurrence.from_dict(occurrence_data)
        assert occurrence.assignee is None


class IssueOccurrenceSaveAndFetchTest(OccurrenceTestMixin, TestCase):
    def test(self) -> None:
        occurrence = self.build_occurrence()
        occurrence.save()
        fetched_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert fetched_occurrence is not None
        self.assert_occurrences_identical(occurrence, fetched_occurrence)


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
