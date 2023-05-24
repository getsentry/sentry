import uuid

from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.issues.producer import produce_occurrence_to_kafka
from sentry.testutils import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data
from tests.sentry.issues.test_utils import OccurrenceTestMixin


class TestProduceOccurrenceToKafka(TestCase, OccurrenceTestMixin):  # type: ignore
    def test_event_id_mismatch(self) -> None:
        with self.assertRaisesMessage(
            ValueError, "Event id on occurrence and event_data must be the same"
        ):
            produce_occurrence_to_kafka(self.build_occurrence(), {"event_id": uuid.uuid4().hex})

    def test_with_event(self) -> None:
        occurrence = self.build_occurrence()
        produce_occurrence_to_kafka(
            occurrence,
            {
                "event_id": occurrence.event_id,
                "project_id": self.project.id,
                "title": "some problem",
                "platform": "python",
                "tags": {"my_tag": "2"},
                "timestamp": before_now(minutes=1).isoformat(),
                "received": before_now(minutes=1).isoformat(),
            },
        )
        stored_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert stored_occurrence
        assert occurrence.event_id == stored_occurrence.event_id

    def test_with_only_occurrence(self) -> None:
        event = self.store_event(data=load_data("transaction"), project_id=self.project.id)
        occurrence = self.build_occurrence(event_id=event.event_id, project_id=self.project.id)
        produce_occurrence_to_kafka(
            occurrence,
        )
        stored_occurrence = IssueOccurrence.fetch(occurrence.id, occurrence.project_id)
        assert stored_occurrence
        assert occurrence.event_id == stored_occurrence.event_id
