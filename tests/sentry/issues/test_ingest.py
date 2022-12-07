from sentry.issues.ingest import save_issue_occurrence
from sentry.testutils import TestCase
from sentry.testutils.silo import region_silo_test
from tests.sentry.issues.utils import OccurrenceTestMixin


@region_silo_test
class SaveIssueOccurrenceTest(OccurrenceTestMixin, TestCase):  # type: ignore
    def test(self) -> None:
        # TODO: We should make this a platform event once we have one
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence(event_id=event.event_id)
        self.assert_occurrences_identical(
            occurrence, save_issue_occurrence(occurrence.to_dict(), event)
        )

    def test_different_ids(self) -> None:
        # TODO: We should make this a platform event once we have one
        event = self.store_event(data={}, project_id=self.project.id)
        occurrence = self.build_occurrence()
        with self.assertRaisesMessage(
            ValueError, "IssueOccurrence must have the same event_id as the passed Event"
        ):
            save_issue_occurrence(occurrence.to_dict(), event)
